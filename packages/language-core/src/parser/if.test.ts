import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import type {
  BinaryExpression,
  IfStatement,
  Program,
  Statement,
} from '../ast/nodes.js';

function parseOk(source: string): Program {
  const result = parse(source);
  expect(result.ok, JSON.stringify(result.diagnostics, null, 2)).toBe(true);
  return result.ast;
}

function asIf(stmt: Statement | undefined): IfStatement {
  expect(stmt?.kind).toBe('IfStatement');
  return stmt as IfStatement;
}

describe('IF / ELSE / ELSE IF', () => {
  it('parses IF-THEN-ENDIF', () => {
    const ast = parseOk(`
IF Score >= 50 THEN
    OUTPUT "Pass"
ENDIF
`);
    const iff = asIf(ast.body[0]);
    expect(iff.elseIfClauses).toEqual([]);
    expect(iff.alternate).toBeNull();
    expect(iff.consequent).toHaveLength(1);
    expect(iff.condition).toMatchObject({
      kind: 'BinaryExpression',
      operator: '>=',
    });
  });

  it('parses IF-THEN-ELSE-ENDIF', () => {
    const ast = parseOk(`
IF Flag = TRUE THEN
    OUTPUT "yes"
ELSE
    OUTPUT "no"
ENDIF
`);
    const iff = asIf(ast.body[0]);
    expect(iff.elseIfClauses).toEqual([]);
    expect(iff.alternate).toHaveLength(1);
    expect(iff.alternate?.[0]?.kind).toBe('OutputStatement');
  });

  it('parses ELSE IF chains with a final ELSE', () => {
    const ast = parseOk(`
IF Mark >= 70 THEN
    OUTPUT "A"
ELSE IF Mark >= 50 THEN
    OUTPUT "B"
ELSE IF Mark >= 40 THEN
    OUTPUT "C"
ELSE
    OUTPUT "F"
ENDIF
`);
    const iff = asIf(ast.body[0]);
    expect(iff.elseIfClauses).toHaveLength(2);
    expect(iff.elseIfClauses[0]?.kind).toBe('ElseIfClause');
    expect(iff.elseIfClauses[0]?.consequent[0]?.kind).toBe('OutputStatement');
    expect(iff.alternate).toHaveLength(1);
  });

  it('parses nested IF inside THEN', () => {
    const ast = parseOk(`
IF Outer = TRUE THEN
    IF Inner = TRUE THEN
        OUTPUT "both"
    ELSE
        OUTPUT "outer only"
    ENDIF
ENDIF
`);
    const outer = asIf(ast.body[0]);
    expect(outer.consequent).toHaveLength(1);
    const inner = asIf(outer.consequent[0]);
    expect(inner.alternate).toHaveLength(1);
    expect(outer.alternate).toBeNull();
  });

  it('parses nested IF inside ELSE (newline after ELSE)', () => {
    const ast = parseOk(`
IF A = 1 THEN
    OUTPUT "A"
ELSE
    IF B = 2 THEN
        OUTPUT "B"
    ENDIF
ENDIF
`);
    const outer = asIf(ast.body[0]);
    expect(outer.elseIfClauses).toEqual([]);
    expect(outer.alternate).toHaveLength(1);
    expect(outer.alternate?.[0]?.kind).toBe('IfStatement');
  });

  it('does not treat newline-separated ELSE + IF as ELSE IF', () => {
    const ast = parseOk(`
IF A = 1 THEN
    OUTPUT 1
ELSE
IF B = 2 THEN
    OUTPUT 2
ENDIF
ENDIF
`);
    const outer = asIf(ast.body[0]);
    // With only whitespace/newlines between ELSE and IF, tokens are Else, Newline, If —
    // peek(1) is Newline, so this is a nested IF in the ELSE block.
    expect(outer.elseIfClauses).toEqual([]);
    expect(outer.alternate?.[0]?.kind).toBe('IfStatement');
  });

  it('allows empty THEN block before ELSE', () => {
    const ast = parseOk(`
IF FALSE THEN
ELSE
    OUTPUT 1
ENDIF
`);
    const iff = asIf(ast.body[0]);
    expect(iff.consequent).toEqual([]);
    expect(iff.alternate).toHaveLength(1);
  });

  it('requires THEN', () => {
    const result = parse('IF TRUE\nOUTPUT 1\nENDIF');
    expect(result.ok).toBe(false);
  });

  it('requires ENDIF', () => {
    const result = parse('IF TRUE THEN\nOUTPUT 1\n');
    expect(result.ok).toBe(false);
  });

  it('rejects dangling ELSE', () => {
    const result = parse('ELSE\nOUTPUT 1\nENDIF');
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_UNEXPECTED_KW')).toBe(true);
  });

  it('parses relational and logical operators in conditions', () => {
    const ast = parseOk(`
IF NOT Done AND Count < 10 OR Flag <> FALSE THEN
    OUTPUT "go"
ENDIF
`);
    const condition = asIf(ast.body[0]).condition as BinaryExpression;
    // OR binds looser than AND, so top operator should be OR
    expect(condition.operator).toBe('OR');
  });

  it('parses multiple statements inside branches', () => {
    const ast = parseOk(`
IF Ready = TRUE THEN
    INPUT Name
    OUTPUT Name
    Total ← Total + 1
ENDIF
`);
    expect(asIf(ast.body[0]).consequent.map((s) => s.kind)).toEqual([
      'InputStatement',
      'OutputStatement',
      'AssignmentStatement',
    ]);
  });
});
