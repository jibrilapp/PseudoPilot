import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import type {
  ArrayType,
  AssignmentStatement,
  DeclareStatement,
  EofExpression,
  IndexExpression,
  OpenFileStatement,
  Program,
  ReadFileStatement,
  WriteFileStatement,
} from '../ast/nodes.js';

function parseOk(source: string): Program {
  const result = parse(source);
  expect(result.ok, JSON.stringify(result.diagnostics, null, 2)).toBe(true);
  return result.ast;
}

describe('arrays', () => {
  it('parses 1D ARRAY DECLARE', () => {
    const stmt = parseOk(`DECLARE Scores : ARRAY[1:10] OF INTEGER`).body[0] as DeclareStatement;
    expect(stmt.typeRef.kind).toBe('ArrayType');
    const arr = stmt.typeRef as ArrayType;
    expect(arr.dimensions).toHaveLength(1);
    expect(arr.elementType.name).toBe('INTEGER');
    expect(arr.dimensions[0]?.lower).toMatchObject({ kind: 'IntegerLiteral', value: 1 });
    expect(arr.dimensions[0]?.upper).toMatchObject({ kind: 'IntegerLiteral', value: 10 });
  });

  it('parses 2D ARRAY DECLARE', () => {
    const stmt = parseOk(`DECLARE Grid : ARRAY[1:5, 1:3] OF REAL`).body[0] as DeclareStatement;
    const arr = stmt.typeRef as ArrayType;
    expect(arr.dimensions).toHaveLength(2);
    expect(arr.elementType.name).toBe('REAL');
  });

  it('parses expression bounds in ARRAY DECLARE', () => {
    parseOk(`DECLARE Dyn : ARRAY[0:N-1] OF STRING`);
  });

  it('parses indexed assignment and OUTPUT', () => {
    const ast = parseOk(`
DECLARE Scores : ARRAY[1:3] OF INTEGER
Scores[1] ← 10
Scores[I] ← Scores[I] + 1
OUTPUT Scores[1], Scores[I]
`);
    const assign = ast.body[1] as AssignmentStatement;
    expect(assign.target.kind).toBe('IndexExpression');
    expect((assign.target as IndexExpression).indices).toHaveLength(1);

    const assign2 = ast.body[2] as AssignmentStatement;
    expect(assign2.value.kind).toBe('BinaryExpression');
  });

  it('parses 2D indexing', () => {
    const assign = parseOk(`
DECLARE Grid : ARRAY[1:2, 1:2] OF INTEGER
Grid[1, 2] ← 9
`).body[1] as AssignmentStatement;
    expect(assign.target).toMatchObject({
      kind: 'IndexExpression',
      indices: [{ kind: 'IntegerLiteral', value: 1 }, { kind: 'IntegerLiteral', value: 2 }],
    });
  });

  it('parses INPUT into an array element', () => {
    const ast = parseOk(`
DECLARE Scores : ARRAY[1:5] OF INTEGER
INPUT Scores[3]
`);
    expect(ast.body[1]).toMatchObject({
      kind: 'InputStatement',
      target: { kind: 'IndexExpression' },
    });
  });

  it('rejects ARRAY without OF type', () => {
    expect(parse(`DECLARE A : ARRAY[1:5]`).ok).toBe(false);
  });

  it('rejects trailing comma in index list', () => {
    expect(parse(`OUTPUT A[1,]`).ok).toBe(false);
  });

  it('rejects missing upper bound', () => {
    expect(parse(`DECLARE A : ARRAY[1:] OF INTEGER`).ok).toBe(false);
  });
});

describe('file handling', () => {
  it('parses OPENFILE FOR READ / WRITE / APPEND', () => {
    const ast = parseOk(`
OPENFILE "data.txt" FOR READ
OPENFILE "out.txt" FOR WRITE
OPENFILE Path FOR APPEND
`);
    expect(ast.body.map((s) => (s as OpenFileStatement).mode)).toEqual([
      'READ',
      'WRITE',
      'APPEND',
    ]);
  });

  it('parses READFILE into a variable and array element', () => {
    const ast = parseOk(`
DECLARE Line : STRING
DECLARE Lines : ARRAY[1:10] OF STRING
READFILE "data.txt", Line
READFILE "data.txt", Lines[1]
`);
    expect(ast.body[2]).toMatchObject({
      kind: 'ReadFileStatement',
      target: { kind: 'Identifier', name: 'Line' },
    });
    expect((ast.body[3] as ReadFileStatement).target.kind).toBe('IndexExpression');
  });

  it('parses WRITEFILE (write or append content)', () => {
    const stmt = parseOk(`WRITEFILE "log.txt", "hello"`).body[0] as WriteFileStatement;
    expect(stmt).toMatchObject({
      kind: 'WriteFileStatement',
      fileName: { kind: 'StringLiteral', value: 'log.txt' },
      value: { kind: 'StringLiteral', value: 'hello' },
    });
  });

  it('parses CLOSEFILE', () => {
    expect(parseOk(`CLOSEFILE "data.txt"`).body[0]?.kind).toBe('CloseFileStatement');
  });

  it('parses EOF as an expression with string path', () => {
    const ast = parseOk(`
IF NOT EOF("data.txt") THEN
    OUTPUT "more"
ENDIF
`);
    const iff = ast.body[0];
    expect(iff?.kind).toBe('IfStatement');
    if (iff?.kind === 'IfStatement') {
      expect(iff.condition.kind).toBe('UnaryExpression');
    }
  });

  it('parses EOF as an expression in IF', () => {
    const ast = parseOk(`
IF EOF(Path) THEN
    OUTPUT "done"
ENDIF
`);
    const iff = ast.body[0];
    expect(iff).toMatchObject({ kind: 'IfStatement' });
    if (iff?.kind === 'IfStatement') {
      expect(iff.condition.kind).toBe('EofExpression');
      expect((iff.condition as EofExpression).fileName).toMatchObject({
        kind: 'Identifier',
        name: 'Path',
      });
    }
  });

  it('parses a full write-then-append session', () => {
    parseOk(`
OPENFILE "log.txt" FOR WRITE
WRITEFILE "log.txt", "start"
CLOSEFILE "log.txt"
OPENFILE "log.txt" FOR APPEND
WRITEFILE "log.txt", "more"
CLOSEFILE "log.txt"
`);
  });

  it('rejects OPENFILE without mode', () => {
    expect(parse(`OPENFILE "x.txt" FOR`).ok).toBe(false);
  });

  it('rejects READFILE without comma/target', () => {
    expect(parse(`READFILE "x.txt"`).ok).toBe(false);
  });

  it('rejects WRITEFILE without value', () => {
    expect(parse(`WRITEFILE "x.txt",`).ok).toBe(false);
  });

  it('rejects EOF without parentheses', () => {
    expect(parse(`IF EOF THEN\nOUTPUT 1\nENDIF`).ok).toBe(false);
  });
});

describe('arrays + files integration', () => {
  it('reads file lines into an array element in a loop-shaped IF nest', () => {
    parseOk(`
DECLARE Lines : ARRAY[1:100] OF STRING
DECLARE I : INTEGER
I ← 1
OPENFILE "data.txt" FOR READ
IF NOT EOF("data.txt") THEN
    READFILE "data.txt", Lines[I]
    I ← I + 1
ENDIF
CLOSEFILE "data.txt"
OPENFILE "copy.txt" FOR WRITE
WRITEFILE "copy.txt", Lines[1]
CLOSEFILE "copy.txt"
`);
  });
});
