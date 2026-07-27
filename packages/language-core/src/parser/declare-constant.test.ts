import { describe, expect, it } from 'vitest';
import type { ConstantStatement, DeclareStatement } from '../ast/nodes.js';
import { parse } from '../parse.js';

function parseOk(source: string) {
  const result = parse(source);
  expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
  return result.ast;
}

describe('DECLARE (parser)', () => {
  it('parses scalar types', () => {
    const cases: Array<[string, string]> = [
      ['INTEGER', 'INTEGER'],
      ['REAL', 'REAL'],
      ['STRING', 'STRING'],
      ['BOOLEAN', 'BOOLEAN'],
      ['CHAR', 'CHAR'],
    ];
    for (const [typeName, expected] of cases) {
      const ast = parseOk(`DECLARE Count : ${typeName}\n`);
      const d = ast.body[0] as DeclareStatement;
      expect(d.kind).toBe('DeclareStatement');
      expect(d.names.map((n) => n.name)).toEqual(['Count']);
      expect(d.typeRef.kind).toBe('TypeName');
      if (d.typeRef.kind === 'TypeName') expect(d.typeRef.name).toBe(expected);
    }
  });

  it('parses multi-name DECLARE', () => {
    const d = parseOk(`DECLARE A, B, C : INTEGER\n`).body[0] as DeclareStatement;
    expect(d.names.map((n) => n.name)).toEqual(['A', 'B', 'C']);
  });

  it('parses array DECLARE', () => {
    const d = parseOk(`DECLARE Scores : ARRAY[1:10] OF INTEGER\n`)
      .body[0] as DeclareStatement;
    expect(d.typeRef.kind).toBe('ArrayType');
  });

  it('parses DECLARE inside PROCEDURE and FUNCTION', () => {
    const ast = parseOk(`
PROCEDURE P()
    DECLARE X : INTEGER
ENDPROCEDURE

FUNCTION F() RETURNS INTEGER
    DECLARE Y : REAL
    RETURN 1
ENDFUNCTION
`);
    expect(ast.body[0]?.kind).toBe('ProcedureDeclaration');
    expect(ast.body[1]?.kind).toBe('FunctionDeclaration');
  });

  it('rejects missing type', () => {
    const result = parse(`DECLARE X\n`);
    expect(result.ok).toBe(false);
  });

  it('rejects missing colon', () => {
    const result = parse(`DECLARE X INTEGER\n`);
    expect(result.ok).toBe(false);
  });
});

describe('CONSTANT (parser)', () => {
  it('parses numeric, string, char, boolean constants', () => {
    const ast = parseOk(`
CONSTANT PI = 3.14159
CONSTANT Greeting = "Hello"
CONSTANT Letter = 'A'
CONSTANT Flag = TRUE
CONSTANT Neg = -2
`);
    expect(ast.body).toHaveLength(5);
    for (const stmt of ast.body) {
      expect(stmt.kind).toBe('ConstantStatement');
    }
    const pi = ast.body[0] as ConstantStatement;
    expect(pi.name.name).toBe('PI');
    expect(pi.value.kind).toBe('RealLiteral');
  });

  it('rejects non-literal CONSTANT values', () => {
    const result = parse(`CONSTANT X = A + 1\n`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_CONSTANT_LITERAL')).toBe(
      true,
    );
  });

  it('rejects missing equals', () => {
    const result = parse(`CONSTANT X 1\n`);
    expect(result.ok).toBe(false);
  });

  it('parses CONSTANT inside routines', () => {
    const ast = parseOk(`
PROCEDURE P()
    CONSTANT Max = 10
ENDPROCEDURE
`);
    expect(ast.body[0]?.kind).toBe('ProcedureDeclaration');
  });
});
