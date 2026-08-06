import { describe, expect, it } from 'vitest';
import { parse } from '@pseudopilot/language-core';
import { check } from './check.js';
import { typeDefaultHint } from './type-system.js';

function checkSrc(src: string) {
  const parsed = parse(src);
  expect(parsed.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return check(parsed.ast!);
}

function codes(src: string): string[] {
  return checkSrc(src).diagnostics.map((d) => d.code);
}

describe('enum / pointer / SET TYPE checking', () => {
  it('accepts enum declare, member assign, and CASE', () => {
    const result = checkSrc(`
TYPE Colour = (Red, Green, Blue)
DECLARE C : Colour
C ← Red
CASE OF C
  Red: OUTPUT "r"
  Green: OUTPUT "g"
  OTHERWISE: OUTPUT "other"
ENDCASE
C ← C + 1
`);
    expect(result.ok).toBe(true);
    expect(
      result.symbols.some(
        (s) => s.kind === 'constant' && s.name === 'Red' && s.type.kind === 'enum',
      ),
    ).toBe(true);
    const colour = result.globalSymbols.get('colour');
    expect(colour?.kind).toBe('type');
    expect(colour?.type.kind).toBe('enum');
  });

  it('rejects mismatched enum assign and allows same-enum compare', () => {
    expect(
      codes(`
TYPE Colour = (Red, Green)
TYPE Size = (Small, Large)
DECLARE C : Colour
C ← Small
`),
    ).toContain('C_ASSIGN_TYPE');

    const ok = checkSrc(`
TYPE Colour = (Red, Green)
DECLARE C : Colour
IF C = Red THEN
  OUTPUT "red"
ENDIF
IF C < Green THEN
  OUTPUT "before"
ENDIF
`);
    expect(ok.ok).toBe(true);
  });

  it('types pointer address-of and deref; rejects mismatched target', () => {
    const ok = checkSrc(`
TYPE TIntPtr = ^INTEGER
DECLARE N : INTEGER
DECLARE P : TIntPtr
N ← 10
P ← ^N
P^ ← 20
OUTPUT P^
`);
    expect(ok.ok).toBe(true);

    expect(
      codes(`
TYPE TIntPtr = ^INTEGER
DECLARE S : STRING
DECLARE P : TIntPtr
P ← ^S
`),
    ).toContain('C_ASSIGN_TYPE');

    expect(
      codes(`
DECLARE N : INTEGER
OUTPUT N^
`),
    ).toContain('C_NOT_POINTER');
  });

  it('allows recursive records via pointer fields', () => {
    const result = checkSrc(`
TYPE TNodePtr = ^Node
TYPE Node
  DECLARE Value : INTEGER
  DECLARE Succ : TNodePtr
ENDTYPE
DECLARE Head : TNodePtr
DECLARE N : Node
Head ← ^N
Head^.Value ← 1
`);
    expect(result.diagnostics.some((d) => d.code === 'C_RECURSIVE_TYPE')).toBe(
      false,
    );
    expect(result.ok).toBe(true);
  });

  it('still rejects direct recursive records', () => {
    const result = checkSrc(`
TYPE Node
  DECLARE Child : Node
ENDTYPE
`);
    expect(result.diagnostics.some((d) => d.code === 'C_RECURSIVE_TYPE')).toBe(
      true,
    );
  });

  it('checks SET + DEFINE', () => {
    const ok = checkSrc(`
TYPE Digits = SET OF INTEGER
DEFINE Odds (1, 3, 5) : Digits
DECLARE More : Digits
More ← Odds
`);
    expect(ok.ok).toBe(true);
    expect(ok.globalSymbols.get('odds')?.type.kind).toBe('set');

    expect(
      codes(`
TYPE Digits = SET OF INTEGER
DEFINE Bad ("x") : Digits
`),
    ).toContain('C_DEFINE_ELEMENT_TYPE');

    expect(
      codes(`
TYPE Colour = (Red, Green)
DEFINE Bad (Red) : Colour
`),
    ).toContain('C_NOT_SET');

    expect(
      codes(`
DEFINE Bad (1) : Ghost
`),
    ).toContain('C_UNKNOWN_TYPE');
  });

  it('exposes checker defaults for enum / pointer / set', () => {
    const result = checkSrc(`
TYPE Colour = (Red, Green)
TYPE TIntPtr = ^INTEGER
TYPE Digits = SET OF INTEGER
DECLARE C : Colour
DECLARE P : TIntPtr
DECLARE S : Digits
`);
    const c = [...result.globalSymbols.values()].find((s) => s.name === 'C');
    const p = [...result.globalSymbols.values()].find((s) => s.name === 'P');
    const s = [...result.globalSymbols.values()].find((s) => s.name === 'S');
    expect(typeDefaultHint(c!.type)).toEqual({
      kind: 'enumFirst',
      member: 'Red',
    });
    expect(typeDefaultHint(p!.type)).toEqual({ kind: 'pointerNil' });
    expect(typeDefaultHint(s!.type)).toEqual({ kind: 'emptySet' });
  });

  it('rejects whole-array assign when literal bounds differ (D5)', () => {
    expect(
      codes(`
DECLARE A : ARRAY[1:10] OF INTEGER
DECLARE B : ARRAY[1:5] OF INTEGER
A ← B
`),
    ).toContain('C_ASSIGN_TYPE');

    const ok = checkSrc(`
DECLARE A : ARRAY[1:5] OF INTEGER
DECLARE B : ARRAY[1:5] OF INTEGER
A ← B
`);
    expect(ok.ok).toBe(true);
  });
});
