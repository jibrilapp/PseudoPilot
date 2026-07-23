import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import type { Program, Statement, WhileStatement } from '../ast/nodes.js';

function parseOk(source: string): Program {
  const result = parse(source);
  expect(result.ok, JSON.stringify(result.diagnostics, null, 2)).toBe(true);
  return result.ast;
}

function asWhile(stmt: Statement | undefined): WhileStatement {
  expect(stmt?.kind).toBe('WhileStatement');
  return stmt as WhileStatement;
}

describe('WHILE / ENDWHILE', () => {
  it('parses WHILE without DO (Teacher Guide form)', () => {
    const ast = parseOk(`
WHILE Count < 10
    Count ← Count + 1
ENDWHILE
`);
    const w = asWhile(ast.body[0]);
    expect(w.hasDo).toBe(false);
    expect(w.body).toHaveLength(1);
    expect(w.condition).toMatchObject({
      kind: 'BinaryExpression',
      operator: '<',
    });
  });

  it('parses WHILE with DO (exam form)', () => {
    const ast = parseOk(`
WHILE Count < 10 DO
    Count ← Count + 1
ENDWHILE
`);
    const w = asWhile(ast.body[0]);
    expect(w.hasDo).toBe(true);
    expect(w.body).toHaveLength(1);
  });

  it('parses empty WHILE body', () => {
    const ast = parseOk(`
WHILE FALSE
ENDWHILE
`);
    expect(asWhile(ast.body[0]).body).toHaveLength(0);
  });

  it('parses nested WHILE', () => {
    const ast = parseOk(`
WHILE I < 3
    WHILE J < 3
        OUTPUT I, J
        J ← J + 1
    ENDWHILE
    I ← I + 1
ENDWHILE
`);
    const outer = asWhile(ast.body[0]);
    expect(outer.body[0]?.kind).toBe('WhileStatement');
  });

  it('parses WHILE containing IF', () => {
    const ast = parseOk(`
WHILE X > 0
    IF X = 1 THEN
        OUTPUT "one"
    ENDIF
    X ← X - 1
ENDWHILE
`);
    const w = asWhile(ast.body[0]);
    expect(w.body.some((s) => s.kind === 'IfStatement')).toBe(true);
  });

  it('parses IF containing WHILE', () => {
    const ast = parseOk(`
IF Run = TRUE THEN
    WHILE N > 0
        N ← N - 1
    ENDWHILE
ENDIF
`);
    expect(ast.body[0]?.kind).toBe('IfStatement');
    if (ast.body[0]?.kind === 'IfStatement') {
      expect(ast.body[0].consequent[0]?.kind).toBe('WhileStatement');
    }
  });

  it('rejects ENDWHILE without WHILE', () => {
    const result = parse(`ENDWHILE`);
    expect(result.ok).toBe(false);
  });

  it('rejects missing ENDWHILE', () => {
    const result = parse(`
WHILE TRUE
    OUTPUT 1
`);
    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some((d) => d.message.includes('ENDWHILE')),
    ).toBe(true);
  });
});
