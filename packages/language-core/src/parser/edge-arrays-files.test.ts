import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import type {
  ArrayType,
  AssignmentStatement,
  DeclareStatement,
  IndexExpression,
  OpenFileStatement,
  Program,
  WriteFileStatement,
} from '../ast/nodes.js';

/**
 * Adversarial edge cases for arrays + file handling.
 * Goal: break DECLARE bounds, indexing, OPEN/READ/WRITE/APPEND/CLOSE, EOF.
 */

function parseOk(source: string): Program {
  const result = parse(source);
  expect(result.ok, JSON.stringify(result.diagnostics, null, 2)).toBe(true);
  return result.ast;
}

describe('edge cases — arrays & files', () => {
  it('1. ARRAY with zero-based bounds', () => {
    const d = parseOk(`DECLARE A : ARRAY[0:9] OF INTEGER`).body[0] as DeclareStatement;
    expect((d.typeRef as ArrayType).dimensions[0]).toMatchObject({
      lower: { value: 0 },
      upper: { value: 9 },
    });
  });

  it('2. ARRAY bounds from identifiers and arithmetic', () => {
    parseOk(`DECLARE A : ARRAY[Start:Start+Len-1] OF STRING`);
  });

  it('3. 3D ARRAY declare', () => {
    const d = parseOk(`DECLARE Cube : ARRAY[1:2, 1:2, 1:2] OF BOOLEAN`).body[0] as DeclareStatement;
    expect((d.typeRef as ArrayType).dimensions).toHaveLength(3);
  });

  it('4. multi-name DECLARE sharing one ARRAY type', () => {
    const d = parseOk(`DECLARE A, B : ARRAY[1:5] OF INTEGER`).body[0] as DeclareStatement;
    expect(d.names.map((n) => n.name)).toEqual(['A', 'B']);
    expect(d.typeRef.kind).toBe('ArrayType');
  });

  it('5. nested index expressions in RHS', () => {
    const a = parseOk(`
DECLARE A : ARRAY[1:5] OF INTEGER
DECLARE B : ARRAY[1:5] OF INTEGER
A[B[1]] ← B[A[2] + 1]
`).body[2] as AssignmentStatement;
    expect(a.target.kind).toBe('IndexExpression');
    expect(a.value.kind).toBe('IndexExpression');
  });

  it('6. 2D index with expression coordinates', () => {
    const a = parseOk(`
DECLARE G : ARRAY[1:10, 1:10] OF INTEGER
G[I+1, J*2] ← 0
`).body[1] as AssignmentStatement;
    expect((a.target as IndexExpression).indices).toHaveLength(2);
  });

  it('7. INDEX inside OUTPUT and IF conditions', () => {
    parseOk(`
DECLARE A : ARRAY[1:3] OF INTEGER
IF A[1] > A[2] THEN
    OUTPUT A[3]
ENDIF
`);
  });

  it('8. CALL and function results as indexes', () => {
    parseOk(`
FUNCTION Idx() RETURNS INTEGER
    RETURN 1
ENDFUNCTION
DECLARE A : ARRAY[1:5] OF INTEGER
A[Idx()] ← 7
OUTPUT A[Idx()]
`);
  });

  it('9. array declare + file read into element + write element', () => {
    const ast = parseOk(`
DECLARE Lines : ARRAY[1:100] OF STRING
OPENFILE "in.txt" FOR READ
READFILE "in.txt", Lines[1]
CLOSEFILE "in.txt"
OPENFILE "out.txt" FOR WRITE
WRITEFILE "out.txt", Lines[1]
CLOSEFILE "out.txt"
`);
    expect(ast.body.some((s) => s.kind === 'ReadFileStatement')).toBe(true);
    expect(ast.body.some((s) => s.kind === 'WriteFileStatement')).toBe(true);
  });

  it('10. OPENFILE with identifier path and all three modes', () => {
    const ast = parseOk(`
OPENFILE Path FOR READ
OPENFILE Path FOR WRITE
OPENFILE Path FOR APPEND
`);
    expect(ast.body.map((s) => (s as OpenFileStatement).mode)).toEqual([
      'READ',
      'WRITE',
      'APPEND',
    ]);
  });

  it('11. WRITEFILE value can be any expression', () => {
    const w = parseOk(`WRITEFILE "f.txt", A + B * 2`).body[0] as WriteFileStatement;
    expect(w.value.kind).toBe('BinaryExpression');
  });

  it('12. EOF with string and with identifier, including NOT EOF', () => {
    const ast = parseOk(`
IF EOF("a.txt") OR NOT EOF(Path) THEN
    OUTPUT "x"
ENDIF
`);
    const iff = ast.body[0];
    expect(iff?.kind).toBe('IfStatement');
  });

  it('13. lowercase array/file keywords', () => {
    parseOk(`
declare scores : array[1:3] of integer
scores[1] ← 1
openfile "f.txt" for append
writefile "f.txt", scores[1]
closefile "f.txt"
if eof("f.txt") then
    output "done"
endif
`);
  });

  it('14. comments around array brackets and file commas', () => {
    parseOk(`
DECLARE A : ARRAY[1:2] OF INTEGER // arr
A[1] ← 1 // set
OPENFILE "f.txt" FOR READ // open
READFILE "f.txt", A[1] // read
CLOSEFILE "f.txt" // close
`);
  });

  it('15. blank lines between file ops', () => {
    parseOk(`
OPENFILE "f.txt" FOR WRITE

WRITEFILE "f.txt", "x"

CLOSEFILE "f.txt"
`);
  });

  it('16. READFILE into scalar after DECLARE in procedure', () => {
    parseOk(`
PROCEDURE Load(Path : STRING)
    DECLARE Line : STRING
    OPENFILE Path FOR READ
    READFILE Path, Line
    CLOSEFILE Path
ENDPROCEDURE
`);
  });

  it('17. append session after write session', () => {
    parseOk(`
OPENFILE "log.txt" FOR WRITE
WRITEFILE "log.txt", "a"
CLOSEFILE "log.txt"
OPENFILE "log.txt" FOR APPEND
WRITEFILE "log.txt", "b"
CLOSEFILE "log.txt"
`);
  });

  it('18. EOF used as WHILE-shaped IF guard with READFILE', () => {
    parseOk(`
DECLARE Line : STRING
OPENFILE "f.txt" FOR READ
IF NOT EOF("f.txt") THEN
    READFILE "f.txt", Line
    OUTPUT Line
ENDIF
CLOSEFILE "f.txt"
`);
  });

  it('19. rejects ARRAY without brackets', () => {
    expect(parse(`DECLARE A : ARRAY OF INTEGER`).ok).toBe(false);
  });

  it('20. rejects ARRAY without OF', () => {
    expect(parse(`DECLARE A : ARRAY[1:5]`).ok).toBe(false);
  });

  it('21. rejects empty index list A[]', () => {
    expect(parse(`OUTPUT A[]`).ok).toBe(false);
  });

  it('22. rejects trailing comma in indexes A[1,]', () => {
    const result = parse(`OUTPUT A[1,]`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_TRAILING_COMMA')).toBe(true);
  });

  it('23. rejects missing colon in bounds ARRAY[1 10]', () => {
    expect(parse(`DECLARE A : ARRAY[1 10] OF INTEGER`).ok).toBe(false);
  });

  it('24. rejects OPENFILE without FOR', () => {
    expect(parse(`OPENFILE "f.txt" READ`).ok).toBe(false);
  });

  it('25. rejects OPENFILE FOR with invalid mode', () => {
    expect(parse(`OPENFILE "f.txt" FOR UPDATE`).ok).toBe(false);
  });

  it('26. rejects READFILE without comma', () => {
    expect(parse(`READFILE "f.txt" Line`).ok).toBe(false);
  });

  it('27. rejects WRITEFILE without value', () => {
    expect(parse(`WRITEFILE "f.txt",`).ok).toBe(false);
  });

  it('28. rejects CLOSEFILE without filename', () => {
    expect(parse(`CLOSEFILE`).ok).toBe(false);
  });

  it('29. rejects EOF without argument list', () => {
    expect(parse(`IF EOF THEN\nOUTPUT 1\nENDIF`).ok).toBe(false);
  });

  it('30. rejects EOF()', () => {
    expect(parse(`IF EOF() THEN\nOUTPUT 1\nENDIF`).ok).toBe(false);
  });

  it('31. rejects assigning to bare CALL-like F() with brackets confusion', () => {
    // F[1] is index, F() ← is invalid assign-to-call
    expect(
      parse(`
FUNCTION F() RETURNS INTEGER
    RETURN 1
ENDFUNCTION
F() ← 2
`).ok,
    ).toBe(false);
  });

  it('32. rejects unclosed index A[1', () => {
    expect(parse(`OUTPUT A[1`).ok).toBe(false);
  });

  it('33. rejects unclosed ARRAY bounds', () => {
    expect(parse(`DECLARE A : ARRAY[1:5 OF INTEGER`).ok).toBe(false);
  });

  it('34. recovers: bad OPENFILE then a valid CLOSEFILE later', () => {
    const result = parse(`
OPENFILE
CLOSEFILE "ok.txt"
`);
    expect(result.ok).toBe(false);
    expect(result.ast.body.some((s) => s.kind === 'CloseFileStatement')).toBe(true);
  });
});
