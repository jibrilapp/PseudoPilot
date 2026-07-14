import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import type {
  AssignmentStatement,
  BinaryExpression,
  GroupingExpression,
  InputStatement,
  OutputStatement,
  Program,
  UnaryExpression,
} from '../ast/nodes.js';

function parseOk(source: string): Program {
  const result = parse(source);
  expect(result.ok, JSON.stringify(result.diagnostics, null, 2)).toBe(true);
  return result.ast;
}

describe('parser — statements', () => {
  it('parses assignment with ←', () => {
    const ast = parseOk('Total ← 0');
    expect(ast.body).toHaveLength(1);
    const stmt = ast.body[0] as AssignmentStatement;
    expect(stmt.kind).toBe('AssignmentStatement');
    expect(stmt.target).toMatchObject({ kind: 'Identifier', name: 'Total' });
    expect(stmt.value).toMatchObject({ kind: 'IntegerLiteral', value: 0 });
  });

  it('parses INPUT', () => {
    const ast = parseOk('INPUT Name');
    const stmt = ast.body[0] as InputStatement;
    expect(stmt).toMatchObject({
      kind: 'InputStatement',
      target: { kind: 'Identifier', name: 'Name' },
    });
  });

  it('parses OUTPUT with one expression', () => {
    const ast = parseOk('OUTPUT "Hello"');
    const stmt = ast.body[0] as OutputStatement;
    expect(stmt.kind).toBe('OutputStatement');
    expect(stmt.expressions).toHaveLength(1);
    expect(stmt.expressions[0]).toMatchObject({ kind: 'StringLiteral', value: 'Hello' });
  });

  it('parses OUTPUT with multiple expressions', () => {
    const ast = parseOk('OUTPUT "Sum = ", Total');
    const stmt = ast.body[0] as OutputStatement;
    expect(stmt.expressions).toHaveLength(2);
    expect(stmt.expressions[0]).toMatchObject({ kind: 'StringLiteral', value: 'Sum = ' });
    expect(stmt.expressions[1]).toMatchObject({ kind: 'Identifier', name: 'Total' });
  });

  it('parses a multi-statement program and ignores comments', () => {
    const source = `
// warm-up
Count ← 0
INPUT Count
Total ← Count + 1
OUTPUT "n = ", Total
`;
    const ast = parseOk(source);
    expect(ast.body.map((s) => s.kind)).toEqual([
      'AssignmentStatement',
      'InputStatement',
      'AssignmentStatement',
      'OutputStatement',
    ]);
  });

  it('parses IF with THEN and ENDIF', () => {
    const ast = parseOk(`
IF TRUE THEN
    OUTPUT 1
ENDIF
`);
    expect(ast.body[0]?.kind).toBe('IfStatement');
  });
});

describe('parser — expressions', () => {
  it('parses literals: integer, real, string, boolean, identifier', () => {
    const ast = parseOk(`
A ← 7
B ← 2.5
C ← "x"
D ← TRUE
E ← Name
`);
    expect(ast.body[0]).toMatchObject({ value: { kind: 'IntegerLiteral', value: 7 } });
    expect(ast.body[1]).toMatchObject({ value: { kind: 'RealLiteral', value: 2.5 } });
    expect(ast.body[2]).toMatchObject({ value: { kind: 'StringLiteral', value: 'x' } });
    expect(ast.body[3]).toMatchObject({ value: { kind: 'BooleanLiteral', value: true } });
    expect(ast.body[4]).toMatchObject({ value: { kind: 'Identifier', name: 'Name' } });
  });

  it('respects operator precedence: * before +', () => {
    const ast = parseOk('X ← 1 + 2 * 3');
    const value = (ast.body[0] as AssignmentStatement).value as BinaryExpression;
    expect(value).toMatchObject({ kind: 'BinaryExpression', operator: '+' });
    expect(value.left).toMatchObject({ kind: 'IntegerLiteral', value: 1 });
    expect(value.right).toMatchObject({ kind: 'BinaryExpression', operator: '*' });
  });

  it('parses parentheses to override precedence', () => {
    const ast = parseOk('X ← (1 + 2) * 3');
    const value = (ast.body[0] as AssignmentStatement).value as BinaryExpression;
    expect(value.operator).toBe('*');
    expect(value.left.kind).toBe('GroupingExpression');
    const inner = (value.left as GroupingExpression).expression as BinaryExpression;
    expect(inner.operator).toBe('+');
  });

  it('parses unary minus', () => {
    const ast = parseOk('X ← -5');
    const value = (ast.body[0] as AssignmentStatement).value as UnaryExpression;
    expect(value).toMatchObject({
      kind: 'UnaryExpression',
      operator: '-',
      argument: { kind: 'IntegerLiteral', value: 5 },
    });
  });

  it('parses DIV and MOD', () => {
    const ast = parseOk('X ← 17 DIV 5\nY ← 17 MOD 5');
    expect((ast.body[0] as AssignmentStatement).value).toMatchObject({
      kind: 'BinaryExpression',
      operator: 'DIV',
    });
    expect((ast.body[1] as AssignmentStatement).value).toMatchObject({
      kind: 'BinaryExpression',
      operator: 'MOD',
    });
  });

  it('parses left-associative subtraction chains', () => {
    const ast = parseOk('X ← 10 - 3 - 2');
    const value = (ast.body[0] as AssignmentStatement).value as BinaryExpression;
    expect(value.operator).toBe('-');
    expect(value.right).toMatchObject({ kind: 'IntegerLiteral', value: 2 });
    expect(value.left).toMatchObject({ kind: 'BinaryExpression', operator: '-' });
  });

  it('reports missing assign operator', () => {
    const result = parse('Total 0');
    expect(result.ok).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it('reports missing OUTPUT expression', () => {
    const result = parse('OUTPUT');
    expect(result.ok).toBe(false);
  });
});

describe('parser — AST spans', () => {
  it('attaches source spans to statements', () => {
    const ast = parseOk('OUTPUT 1');
    expect(ast.body[0]?.span.start.line).toBe(1);
    expect(ast.body[0]?.span.start.column).toBe(1);
  });
});
