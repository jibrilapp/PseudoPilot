import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import type { AssignmentStatement, BinaryExpression, Program } from '../ast/nodes.js';

function parseOk(source: string): Program {
  const result = parse(source);
  expect(result.ok, JSON.stringify(result.diagnostics, null, 2)).toBe(true);
  return result.ast;
}

describe('parser hardening — statement boundaries', () => {
  it('rejects two statements on one line', () => {
    const result = parse('X ← 1 OUTPUT X');
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_STMT_END')).toBe(true);
  });

  it('rejects junk after a complete assignment', () => {
    const result = parse('X ← 1 2');
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_STMT_END')).toBe(true);
  });

  it('rejects trailing comma in OUTPUT', () => {
    const result = parse('OUTPUT 1,');
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_TRAILING_COMMA')).toBe(true);
  });

  it('still accepts blank lines between statements', () => {
    const ast = parseOk('X ← 1\n\n\nOUTPUT X\n');
    expect(ast.body).toHaveLength(2);
  });

  it('recovers to parse a later valid line after an error', () => {
    const result = parse('← 1\nY ← 2');
    expect(result.ok).toBe(false);
    expect(result.ast.body.some((s) => s.kind === 'AssignmentStatement')).toBe(true);
  });
});

describe('parser hardening — expression edges', () => {
  it('rejects incomplete binary expression at end of line', () => {
    const result = parse('X ← 1 +');
    expect(result.ok).toBe(false);
  });

  it('rejects missing closing parenthesis', () => {
    const result = parse('X ← (1 + 2');
    expect(result.ok).toBe(false);
  });

  it('parses nested parentheses', () => {
    const ast = parseOk('X ← ((1 + 2) * (3))');
    expect((ast.body[0] as AssignmentStatement).value.kind).toBe('GroupingExpression');
  });

  it('parses unary minus binding tighter than multiplication', () => {
    // -2 * 3  =>  (-2) * 3
    const ast = parseOk('X ← -2 * 3');
    const value = (ast.body[0] as AssignmentStatement).value as BinaryExpression;
    expect(value.operator).toBe('*');
    expect(value.left.kind).toBe('UnaryExpression');
  });

  it('parses double unary', () => {
    const ast = parseOk('X ← --5');
    expect((ast.body[0] as AssignmentStatement).value.kind).toBe('UnaryExpression');
  });
});

describe('lexer hardening', () => {
  it('rejects glued number and identifier', () => {
    const result = parse('X ← 2y');
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_NUMBER_IDENT')).toBe(true);
  });

  it('rejects unsafe integers that lose precision in JS Number', () => {
    const result = parse('X ← 9007199254740993');
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_INT_RANGE')).toBe(true);
  });

  it('lexes leading-dot reals with a Cambridge warning', () => {
    const result = parse('X ← .5');
    expect(result.ok).toBe(true);
    expect(result.diagnostics.some((d) => d.code === 'W_REAL_LITERAL')).toBe(true);
    expect((result.ast.body[0] as AssignmentStatement).value).toMatchObject({
      kind: 'RealLiteral',
      value: 0.5,
    });
  });

  it('rejects leading-dot reals in strictCambridge mode', () => {
    const result = parse('X ← .5', { strictCambridge: true });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_REAL_LITERAL')).toBe(true);
  });

  it('lexes trailing-dot reals with a Cambridge warning', () => {
    const result = parse('X ← 5.');
    expect(result.ok).toBe(true);
    expect(result.diagnostics.some((d) => d.code === 'W_REAL_LITERAL')).toBe(true);
    expect((result.ast.body[0] as AssignmentStatement).value).toMatchObject({
      kind: 'RealLiteral',
      value: 5.0,
    });
  });
});
