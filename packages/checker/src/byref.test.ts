import { describe, expect, it } from 'vitest';
import { parse } from '@pseudopilot/language-core';
import { check } from './check.js';

function codes(source: string): string[] {
  const parsed = parse(source);
  return check(parsed.ast).diagnostics.map((d) => d.code);
}

describe('BYVAL / BYREF checker (Cambridge §8.3)', () => {
  it('accepts Guide SWAP with sticky BYREF', () => {
    expect(
      codes(`
PROCEDURE SWAP(BYREF X : INTEGER, Y : INTEGER)
    DECLARE Temp : INTEGER
    Temp ← X
    X ← Y
    Y ← Temp
ENDPROCEDURE
DECLARE A, B : INTEGER
A ← 1
B ← 2
CALL SWAP(A, B)
`),
    ).toEqual([]);
  });

  it('rejects BYREF on FUNCTION parameters', () => {
    expect(
      codes(`
FUNCTION F(BYREF A : INTEGER) RETURNS INTEGER
    RETURN A
ENDFUNCTION
`),
    ).toContain('C_BYREF_ON_FUNCTION');
  });

  it('rejects literal BYREF arguments', () => {
    expect(
      codes(`
PROCEDURE Inc(BYREF N : INTEGER)
    N ← N + 1
ENDPROCEDURE
CALL Inc(5)
`),
    ).toContain('C_BYREF_LITERAL');
  });

  it('rejects CONSTANT BYREF arguments', () => {
    expect(
      codes(`
CONSTANT Max = 10
PROCEDURE Inc(BYREF N : INTEGER)
    N ← N + 1
ENDPROCEDURE
CALL Inc(Max)
`),
    ).toContain('C_BYREF_CONSTANT');
  });

  it('rejects temporary / expression BYREF arguments', () => {
    expect(
      codes(`
DECLARE A, B : INTEGER
PROCEDURE Inc(BYREF N : INTEGER)
    N ← N + 1
ENDPROCEDURE
CALL Inc(A + B)
`),
    ).toContain('C_BYREF_TEMPORARY');
  });

  it('rejects function-call results as BYREF arguments', () => {
    expect(
      codes(`
FUNCTION F() RETURNS INTEGER
    RETURN 1
ENDFUNCTION
PROCEDURE Inc(BYREF N : INTEGER)
    N ← N + 1
ENDPROCEDURE
CALL Inc(F())
`),
    ).toContain('C_BYREF_TEMPORARY');
  });

  it('accepts array element and record field BYREF arguments', () => {
    expect(
      codes(`
TYPE Point
    DECLARE X : INTEGER
ENDTYPE
DECLARE Scores : ARRAY[1:3] OF INTEGER
DECLARE P : Point
PROCEDURE Inc(BYREF N : INTEGER)
    N ← N + 1
ENDPROCEDURE
CALL Inc(Scores[1])
CALL Inc(P.X)
`),
    ).toEqual([]);
  });

  it('accepts BYVAL explicitly and still clones by value at call sites', () => {
    expect(
      codes(`
PROCEDURE Show(BYVAL N : INTEGER)
    OUTPUT N
ENDPROCEDURE
CALL Show(3)
`),
    ).toEqual([]);
  });
});
