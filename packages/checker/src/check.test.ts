import { describe, expect, it } from 'vitest';
import { parse } from '@pseudopilot/language-core';
import { check } from './check.js';
import { lookupSymbol } from './scope.js';

function checkSource(source: string) {
  const parsed = parse(source);
  const result = check(parsed.ast);
  return { parsed, result };
}

function codes(source: string): string[] {
  return checkSource(source).result.diagnostics.map((d) => d.code);
}

describe('@pseudopilot/checker', () => {
  it('accepts a well-typed program', () => {
    const { result } = checkSource(`
DECLARE Count : INTEGER
CONSTANT Limit = 10
Count ← Limit
OUTPUT Count
`);
    expect(result.ok).toBe(true);
    expect(lookupSymbol(result.globalSymbols, 'Count')).toBeDefined();
    expect(lookupSymbol(result.globalSymbols, 'Limit')?.kind).toBe('constant');
  });

  it('detects duplicate variables and constants', () => {
    expect(codes(`DECLARE X : INTEGER\nDECLARE X : REAL\n`)).toContain(
      'C_DUP_VARIABLE',
    );
    expect(codes(`CONSTANT A = 1\nCONSTANT A = 2\n`)).toContain(
      'C_DUP_CONSTANT',
    );
  });

  it('detects duplicate procedures and parameters', () => {
    expect(
      codes(`
PROCEDURE P()
ENDPROCEDURE
PROCEDURE P()
ENDPROCEDURE
`),
    ).toContain('C_DUP_PROCEDURE');
    expect(
      codes(`
PROCEDURE P(A : INTEGER, A : INTEGER)
ENDPROCEDURE
`),
    ).toContain('C_DUP_PARAMETER');
    expect(
      codes(`
PROCEDURE P(A, A : INTEGER)
ENDPROCEDURE
`),
    ).toContain('C_DUP_PARAMETER');
  });

  it('accepts Cambridge grouped parameters as distinct bindings', () => {
    const { result } = checkSource(`
FUNCTION Sum(a, b : INTEGER, c : INTEGER) RETURNS INTEGER
  RETURN a + b + c
ENDFUNCTION
OUTPUT Sum(1, 2, 3)
`);
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
    expect(lookupSymbol(result.globalSymbols, 'Sum')?.kind).toBe('function');
  });

  it('detects undeclared identifiers', () => {
    expect(codes(`OUTPUT X\n`)).toContain('C_UNDECL_IDENT');
  });

  it('detects assign to CONSTANT', () => {
    expect(codes(`CONSTANT Max = 1\nMax ← 2\n`)).toContain(
      'C_ASSIGN_TO_CONSTANT',
    );
  });

  it('detects incompatible assignment types', () => {
    expect(
      codes(`
DECLARE Flag : BOOLEAN
Flag ← 1
`),
    ).toContain('C_ASSIGN_TYPE');
  });

  it('allows INTEGER → REAL assignment', () => {
    const { result } = checkSource(`
DECLARE R : REAL
R ← 3
`);
    expect(result.ok).toBe(true);
  });

  it('rejects REAL → INTEGER assignment', () => {
    expect(
      codes(`
DECLARE I : INTEGER
I ← 3.5
`),
    ).toContain('C_ASSIGN_TYPE');
  });

  it('checks PROCEDURE/FUNCTION calls: arity and types', () => {
    expect(
      codes(`
PROCEDURE P(A : INTEGER)
ENDPROCEDURE
CALL P()
`),
    ).toContain('C_ARG_COUNT');

    expect(
      codes(`
PROCEDURE P(A : INTEGER)
ENDPROCEDURE
CALL P(TRUE)
`),
    ).toContain('C_ARG_TYPE');
  });

  it('rejects PROCEDURE used as expression', () => {
    expect(
      codes(`
PROCEDURE P()
ENDPROCEDURE
OUTPUT P()
`),
    ).toContain('C_PROC_AS_EXPR');
  });

  it('checks FUNCTION return type and missing RETURN', () => {
    const noRet = checkSource(`
FUNCTION F() RETURNS INTEGER
    OUTPUT 1
ENDFUNCTION
`);
    expect(noRet.result.diagnostics.some((d) => d.code === 'C_FUNC_NO_RETURN')).toBe(
      true,
    );

    expect(
      codes(`
FUNCTION F() RETURNS INTEGER
    RETURN TRUE
ENDFUNCTION
`),
    ).toContain('C_RETURN_TYPE');
  });

  it('supports nested scopes and shadowing', () => {
    const { result } = checkSource(`
DECLARE X : INTEGER
PROCEDURE P()
    DECLARE X : REAL
    X ← 1.5
ENDPROCEDURE
X ← 1
`);
    expect(result.ok).toBe(true);
  });

  it('checks arrays: undeclared, rank, index type', () => {
    expect(codes(`Scores[1] ← 1\n`)).toContain('C_UNDECL_ARRAY');
    expect(
      codes(`
DECLARE Scores : ARRAY[1:10] OF INTEGER
Scores[1, 2] ← 1
`),
    ).toContain('C_ARRAY_RANK');
    expect(
      codes(`
DECLARE Scores : ARRAY[1:10] OF INTEGER
Scores[TRUE] ← 1
`),
    ).toContain('C_INDEX_TYPE');
  });

  it('FOR introduces INTEGER when undeclared; rejects CONSTANT loop var', () => {
    const { result } = checkSource(`
FOR I ← 1 TO 5
    OUTPUT I
NEXT I
`);
    expect(result.ok).toBe(true);
    expect(lookupSymbol(result.globalSymbols, 'I')?.implicit).toBe(true);

    expect(
      codes(`
CONSTANT I = 1
FOR I ← 1 TO 5
    OUTPUT I
NEXT I
`),
    ).toContain('C_ASSIGN_TO_CONSTANT');
  });

  it('detects undeclared routines', () => {
    expect(codes(`CALL Missing()\n`)).toContain('C_UNDECL_ROUTINE');
  });

  it('allows CALL of FUNCTION (Cambridge CALL form)', () => {
    const { result } = checkSource(`
FUNCTION F() RETURNS INTEGER
    RETURN 1
ENDFUNCTION
CALL F()
`);
    expect(result.ok).toBe(true);
  });

  it('hoists routines so CALL before definition is ok', () => {
    const { result } = checkSource(`
CALL P()
PROCEDURE P()
ENDPROCEDURE
`);
    expect(result.ok).toBe(true);
  });

  it('detects duplicate functions and RETURN outside function', () => {
    expect(
      codes(`
FUNCTION F() RETURNS INTEGER
    RETURN 1
ENDFUNCTION
FUNCTION F() RETURNS INTEGER
    RETURN 2
ENDFUNCTION
`),
    ).toContain('C_DUP_FUNCTION');
    expect(codes(`RETURN 1\n`)).toContain('C_RETURN_OUTSIDE');
  });

  it('flags CASE label type mismatch and unreachable after RETURN', () => {
    expect(
      codes(`
DECLARE X : INTEGER
CASE OF X
    TRUE : OUTPUT 1
ENDCASE
`),
    ).toContain('C_CASE_LABEL_TYPE');

    const { result } = checkSource(`
FUNCTION F() RETURNS INTEGER
    RETURN 1
    OUTPUT 2
ENDFUNCTION
`);
    expect(result.diagnostics.some((d) => d.code === 'C_UNREACHABLE')).toBe(
      true,
    );
  });

  it('flags unreachable after RETURN inside nested IF', () => {
    const { result } = checkSource(`
FUNCTION F() RETURNS INTEGER
    IF TRUE THEN
        RETURN 1
        OUTPUT 2
    ENDIF
    RETURN 0
ENDFUNCTION
`);
    expect(result.diagnostics.some((d) => d.code === 'C_UNREACHABLE')).toBe(
      true,
    );
  });

  it('accepts a mixed valid program with arrays, routines, and control flow', () => {
    const { result } = checkSource(`
DECLARE Scores : ARRAY[1:3] OF INTEGER
DECLARE Total : INTEGER
CONSTANT N = 3

FUNCTION Sum(A : INTEGER) RETURNS INTEGER
    RETURN A + 1
ENDFUNCTION

PROCEDURE Show(Msg : STRING)
    OUTPUT Msg
ENDPROCEDURE

Total ← 0
FOR I ← 1 TO N
    Scores[I] ← Sum(I)
    Total ← Total + Scores[I]
NEXT I

IF Total > 0 THEN
    CALL Show("ok")
ENDIF
`);
    expect(result.ok).toBe(true);
  });

  it('treats identifiers as case-insensitive', () => {
    const { result } = checkSource(`
DECLARE Count : INTEGER
count ← 1
OUTPUT COUNT
`);
    expect(result.ok).toBe(true);
    expect(lookupSymbol(result.globalSymbols, 'Count')).toBeDefined();
    expect(lookupSymbol(result.globalSymbols, 'Count')?.name).toBe('Count');

    expect(
      codes(`
DECLARE X : INTEGER
DECLARE x : REAL
`),
    ).toContain('C_DUP_VARIABLE');

    expect(
      codes(`
CONSTANT Max = 1
max ← 2
`),
    ).toContain('C_ASSIGN_TO_CONSTANT');
  });

  it('emits a single C_DUP_PARAMETER for duplicate params', () => {
    const { result } = checkSource(`
PROCEDURE P(A : INTEGER, a : INTEGER)
ENDPROCEDURE
`);
    const dups = result.diagnostics.filter((d) => d.code === 'C_DUP_PARAMETER');
    expect(dups).toHaveLength(1);
  });

  it('warns on incomparable CASE / compare types', () => {
    expect(
      codes(`
DECLARE Flag : BOOLEAN
DECLARE N : INTEGER
OUTPUT Flag = N
`),
    ).toContain('C_COMPARE_TYPE');
  });

  it('caps diagnostics when maxDiagnostics is low', () => {
    const parsed = parse(`
OUTPUT A
OUTPUT B
OUTPUT C
`);
    const result = check(parsed.ast, { maxDiagnostics: 2 });
    expect(result.diagnostics.length).toBeLessThanOrEqual(3);
    expect(
      result.diagnostics.some((d) => d.code === 'C_TOO_MANY_DIAGNOSTICS'),
    ).toBe(true);
  });

  it('attaches help on undeclared assign targets', () => {
    const { result } = checkSource(`X ← 1\n`);
    const d = result.diagnostics.find((x) => x.code === 'C_UNDECL_IDENT');
    expect(d?.help).toMatch(/DECLARE/);
  });

  it('does not report C_FUNC_NO_RETURN when RETURN is nested in IF', () => {
    const { result } = checkSource(`
FUNCTION F() RETURNS INTEGER
    IF TRUE THEN
        RETURN 1
    ENDIF
ENDFUNCTION
`);
    expect(result.diagnostics.some((d) => d.code === 'C_FUNC_NO_RETURN')).toBe(
      false,
    );
  });

  it('rejects REAL or PROCEDURE as FOR control variable', () => {
    expect(
      codes(`
DECLARE R : REAL
FOR R ← 1 TO 5
NEXT R
`),
    ).toContain('C_FOR_VAR_TYPE');

    expect(
      codes(`
PROCEDURE P()
ENDPROCEDURE
FOR P ← 1 TO 5
NEXT P
`),
    ).toContain('C_FOR_VAR_TYPE');
  });

  it('detects case-insensitive duplicates in a single DECLARE list', () => {
    expect(codes(`DECLARE X, x : INTEGER\n`)).toContain('C_DUP_VARIABLE');
  });

  it('exposes globalSymbols with case-folded keys for interpreter lookup', () => {
    const { result } = checkSource(`DECLARE Count : INTEGER\n`);
    expect(result.globalSymbols.has('count')).toBe(true);
    expect(result.globalSymbols.has('Count')).toBe(false);
    expect(lookupSymbol(result.globalSymbols, 'COUNT')?.name).toBe('Count');
  });

  it('accepts a well-formed file I/O sequence', () => {
    const { result } = checkSource(`
OPENFILE "f.txt" FOR WRITE
WRITEFILE "f.txt", "hi"
CLOSEFILE "f.txt"
OPENFILE "f.txt" FOR READ
DECLARE Line : STRING
WHILE NOT EOF("f.txt")
  READFILE "f.txt", Line
ENDWHILE
CLOSEFILE "f.txt"
`);
    expect(result.ok).toBe(true);
  });

  it('flags READFILE / CLOSEFILE / EOF on unopened literal paths', () => {
    expect(
      codes(`
DECLARE L : STRING
READFILE "f.txt", L
`),
    ).toContain('C_FILE_NOT_OPEN');
    expect(codes(`CLOSEFILE "f.txt"\n`)).toContain('C_FILE_NOT_OPEN');
    expect(codes(`OUTPUT EOF("f.txt")\n`)).toContain('C_FILE_NOT_OPEN');
  });

  it('flags double open and mode mismatches', () => {
    expect(
      codes(`
OPENFILE "f.txt" FOR WRITE
OPENFILE "f.txt" FOR READ
`),
    ).toContain('C_FILE_ALREADY_OPEN');
    expect(
      codes(`
OPENFILE "f.txt" FOR WRITE
DECLARE L : STRING
READFILE "f.txt", L
`),
    ).toContain('C_FILE_MODE');
    expect(
      codes(`
OPENFILE "f.txt" FOR READ
WRITEFILE "f.txt", "x"
`),
    ).toContain('C_FILE_MODE');
  });

  it('flags non-STRING file paths', () => {
    expect(
      codes(`
OPENFILE 1 FOR READ
`),
    ).toContain('C_FILE_PATH_TYPE');
  });

  it('does not pollute top-level openFiles from PROCEDURE body analysis', () => {
    // Opening inside a procedure at definition time must not mark the file open
    // for subsequent top-level checks.
    expect(
      codes(`
PROCEDURE OpenIt
  OPENFILE "f.txt" FOR READ
ENDPROCEDURE
READFILE "f.txt", L
`),
    ).toContain('C_FILE_NOT_OPEN');
    expect(
      codes(`
PROCEDURE OpenIt
  OPENFILE "f.txt" FOR READ
ENDPROCEDURE
OPENFILE "f.txt" FOR READ
DECLARE L : STRING
READFILE "f.txt", L
CLOSEFILE "f.txt"
`),
    ).not.toContain('C_FILE_ALREADY_OPEN');
  });

  it('rejects READFILE into a non-STRING target', () => {
    expect(
      codes(`
DECLARE N : INTEGER
OPENFILE "f.txt" FOR READ
READFILE "f.txt", N
CLOSEFILE "f.txt"
`),
    ).toContain('C_ASSIGN_TYPE');
  });
});

describe('DATE', () => {
  it('accepts DATE declare, assignment, comparison, and builtins', () => {
    const { result } = checkSource(`
DECLARE D : DATE
D ← 04/10/2003
IF D = SETDATE(4, 10, 2003) THEN
  OUTPUT YEAR(D)
ENDIF
IF D < SETDATE(5, 10, 2003) THEN
  OUTPUT MONTH(D)
ENDIF
`);
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
  });

  it('rejects arithmetic on DATE', () => {
    expect(
      codes(`
DECLARE D : DATE
D ← 01/01/2000
OUTPUT D + 1
`),
    ).toContain('C_BINARY_TYPE');
  });

  it('rejects assigning INTEGER to DATE', () => {
    expect(
      codes(`
DECLARE D : DATE
D ← 1
`),
    ).toContain('C_ASSIGN_TYPE');
  });
});
