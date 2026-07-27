import { describe, expect, it } from 'vitest';
import { parse, lookupBuiltin } from '@pseudopilot/language-core';
import { check } from './check.js';

function checkSource(source: string) {
  const parsed = parse(source);
  return check(parsed.ast);
}

function codes(source: string): string[] {
  return checkSource(source).diagnostics.map((d) => d.code);
}

describe('builtins + &', () => {
  it('types LENGTH / LEFT / RIGHT / MID / LCASE / UCASE / INT / RAND', () => {
    const { ok, diagnostics } = checkSource(`
DECLARE Name : STRING
DECLARE N : INTEGER
DECLARE R : REAL
DECLARE C : CHAR
N ← LENGTH(Name)
Name ← LEFT(Name, 3)
Name ← RIGHT(Name, 2)
Name ← MID(Name, 2, 4)
Name ← LCASE(Name)
Name ← UCASE(Name)
C ← LCASE(C)
N ← INT(4.8)
R ← RAND(100)
`);
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(ok).toBe(true);
  });

  it('rejects wrong builtin arity and types', () => {
    expect(codes(`OUTPUT LENGTH()\n`)).toContain('C_BUILTIN_ARG_COUNT');
    expect(
      codes(`
DECLARE N : INTEGER
OUTPUT LENGTH(N)
`),
    ).toContain('C_BUILTIN_ARG_TYPE');
    expect(
      codes(`
DECLARE S : STRING
OUTPUT MID(S, 1)
`),
    ).toContain('C_BUILTIN_ARG_COUNT');
    expect(
      codes(`
DECLARE S : STRING
OUTPUT RIGHT(S, 1.5)
`),
    ).toContain('C_BUILTIN_ARG_TYPE');
    expect(
      codes(`
OUTPUT RAND(2.5)
`),
    ).toContain('C_BUILTIN_ARG_TYPE');
  });

  it('rejects redefining a Core builtin name', () => {
    expect(
      codes(`
DECLARE Length : INTEGER
`),
    ).toContain('C_DUP_FUNCTION');
    expect(
      codes(`
FUNCTION LENGTH(S : STRING) RETURNS INTEGER
  RETURN 0
ENDFUNCTION
`),
    ).toContain('C_DUP_FUNCTION');
  });

  it('supports & concatenation and rejects + for strings', () => {
    const ok = checkSource(`
DECLARE A : STRING
DECLARE B : STRING
OUTPUT A & " " & B
`);
    expect(ok.ok).toBe(true);

    expect(
      codes(`
DECLARE A : STRING
DECLARE B : STRING
OUTPUT A + B
`),
    ).toContain('C_BINARY_TYPE');

    expect(
      codes(`
DECLARE N : INTEGER
OUTPUT N & "x"
`),
    ).toContain('C_CONCAT_TYPE');
  });

  it('nests builtins', () => {
    const r = checkSource(`
OUTPUT LENGTH(UCASE(LEFT("abc", 2)))
`);
    expect(r.ok).toBe(true);
  });

  it('registry lookup is case-insensitive', () => {
    expect(lookupBuiltin('length')?.name).toBe('LENGTH');
    expect(lookupBuiltin('Mid')?.params).toHaveLength(3);
  });
});
