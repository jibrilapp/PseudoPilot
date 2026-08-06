import { describe, expect, it } from 'vitest';
import {
  translatePseudocodeToPython,
  translatePythonToPseudocode,
} from './index.js';

function norm(s: string): string {
  return s.replace(/\r\n/g, '\n').trimEnd() + '\n';
}

describe('enum / pointer / SET TYPE translation', () => {
  it('emits IntEnum for enum TYPE and aliases members', () => {
    const source = `TYPE Season = (Spring, Summer, Autumn, Winter)
DECLARE ThisSeason : Season
ThisSeason ← Spring
OUTPUT ThisSeason
`;
    const result = translatePseudocodeToPython(source);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.code).toContain('from enum import IntEnum');
    expect(result.code).toContain('class Season(IntEnum):');
    expect(result.code).toContain('Spring = 0');
    expect(result.code).toContain('Spring = Season.Spring');
    expect(result.code).toContain('ThisSeason: Season = Season.Spring');
    expect(result.code).toContain('ThisSeason = Spring');
    expect(result.code).toContain('_pp_show(ThisSeason)');
  });

  it('round-trips enum TYPE through Python', () => {
    const source = `TYPE Season = (Spring, Summer, Autumn, Winter)
DECLARE ThisSeason : Season
ThisSeason ← Spring
OUTPUT ThisSeason
`;
    const py = translatePseudocodeToPython(source);
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(norm(back.code)).toContain(
      'TYPE Season = (Spring, Summer, Autumn, Winter)',
    );
    expect(norm(back.code)).toContain('ThisSeason ← Spring');
  });

  it('emits pointer TYPE, address-of, and deref', () => {
    const source = `TYPE TIntPointer = ^INTEGER
DECLARE X : INTEGER
DECLARE P : TIntPointer
X ← 10
P ← ^X
P^ ← 20
OUTPUT X
`;
    const result = translatePseudocodeToPython(source);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.code).toContain(
      'TIntPointer = object  # TYPE TIntPointer = ^INTEGER',
    );
    expect(result.code).toContain('def _pp_cell(value):');
    expect(result.code).toContain('X = _pp_cell(0)');
    expect(result.code).toContain('_pp_store(X, 10)');
    expect(result.code).toContain('P = _pp_addr(X)');
    expect(result.code).toContain('_pp_pstore(P, 20)');
    expect(result.code).toContain('_pp_load(X)');
  });

  it('round-trips pointer TYPE address/deref shapes', () => {
    const source = `TYPE TIntPointer = ^INTEGER
DECLARE X : INTEGER
DECLARE P : TIntPointer
X ← 10
P ← ^X
P^ ← 20
OUTPUT X
`;
    const py = translatePseudocodeToPython(source);
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(norm(back.code)).toContain('TYPE TIntPointer = ^INTEGER');
    expect(norm(back.code)).toContain('P ← ^X');
    expect(norm(back.code)).toContain('P^ ← 20');
  });

  it('emits SET TYPE and DEFINE', () => {
    const source = `TYPE LetterSet = SET OF CHAR
DEFINE Vowels ('A','E','I','O','U'): LetterSet
OUTPUT Vowels
`;
    const result = translatePseudocodeToPython(source);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.code).toContain(
      'LetterSet = set  # TYPE LetterSet = SET OF CHAR',
    );
    expect(result.code).toContain('def _pp_define(_type, *values):');
    expect(result.code).toContain(
      `_pp_define("LetterSet", 'A', 'E', 'I', 'O', 'U')`,
    );
  });

  it('round-trips SET DEFINE', () => {
    const source = `TYPE LetterSet = SET OF CHAR
DEFINE Vowels ('A','E','I','O','U'): LetterSet
OUTPUT Vowels
`;
    const py = translatePseudocodeToPython(source);
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(norm(back.code)).toContain('TYPE LetterSet = SET OF CHAR');
    expect(norm(back.code)).toContain(
      "DEFINE Vowels ('A', 'E', 'I', 'O', 'U'): LetterSet",
    );
  });

  it('emits enum ordinal +1 via pointer deref', () => {
    const source = `TYPE Season = (Spring, Summer, Autumn, Winter)
TYPE TSeasonPointer = ^Season
DECLARE ThisSeason : Season
DECLARE NextSeason : Season
DECLARE MyPointer : TSeasonPointer
ThisSeason ← Spring
MyPointer ← ^ThisSeason
NextSeason ← MyPointer^ + 1
OUTPUT NextSeason
`;
    const result = translatePseudocodeToPython(source);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.code).toContain('_pp_enum_add');
    expect(result.code).toContain('_pp_enum_add(_pp_pload(MyPointer), 1)');
  });

  it('Cambridge printer emits bare NEXT when nextVariable is null', async () => {
    const { lowerCambridgeProgram } = await import('./cambridge/lower.js');
    const { printCambridge } = await import('./cambridge/print.js');
    const { parse } = await import('@pseudopilot/language-core');
    const source = `FOR I ← 1 TO 2
    OUTPUT I
NEXT
`;
    const parsed = parse(source);
    expect(parsed.ok).toBe(true);
    const lowered = lowerCambridgeProgram(parsed.ast, source, false);
    const printed = printCambridge(lowered.ir, 'unicode');
    expect(printed).toMatch(/NEXT\n/);
    expect(printed).not.toMatch(/NEXT I/);
  });

  it('Cambridge printer emits NEXT binder when present', async () => {
    const { lowerCambridgeProgram } = await import('./cambridge/lower.js');
    const { printCambridge } = await import('./cambridge/print.js');
    const { parse } = await import('@pseudopilot/language-core');
    const source = `FOR I ← 1 TO 2
    OUTPUT I
NEXT I
`;
    const parsed = parse(source);
    const lowered = lowerCambridgeProgram(parsed.ast, source, false);
    const printed = printCambridge(lowered.ir, 'unicode');
    expect(printed).toContain('NEXT I');
  });
});

describe('DIV/MOD and RIGHT fidelity', () => {
  it('emits truncating _pp_div / _pp_mod helpers', () => {
    const result = translatePseudocodeToPython(
      `
DECLARE Q, R : INTEGER
Q ← 10 DIV 3
R ← 10 MOD 3
`,
      { semanticCheck: true },
    );
    expect(result.ok).toBe(true);
    expect(result.code).toContain('def _pp_div(a, b):');
    expect(result.code).toContain('def _pp_mod(a, b):');
    expect(norm(result.code)).toContain('Q = _pp_div(10, 3)');
    expect(norm(result.code)).toContain('R = _pp_mod(10, 3)');
  });

  it('round-trips DIV/MOD via helpers', () => {
    const source = `A ← 17 DIV 5
B ← 17 MOD 5
`;
    const py = translatePseudocodeToPython(source);
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toBe(norm(source));
  });

  it('emits _pp_right so RIGHT(s, 0) is empty', () => {
    const result = translatePseudocodeToPython(
      `
DECLARE Name : STRING
OUTPUT RIGHT(Name, 2)
OUTPUT RIGHT(Name, 0)
`,
      { semanticCheck: true },
    );
    expect(result.ok).toBe(true);
    expect(result.code).toContain('def _pp_right(s, n):');
    expect(result.code).toContain('_pp_right(Name, 2)');
    expect(result.code).toContain('_pp_right(Name, 0)');
    expect(result.code).not.toContain('Name[-2:]');
  });
});
