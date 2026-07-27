import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import type { ForStatement } from '../ast/nodes.js';

function parseOk(source: string) {
  const result = parse(source);
  expect(result.ok, JSON.stringify(result.diagnostics, null, 2)).toBe(true);
  return result.ast;
}

describe('FOR parser', () => {
  it('parses minimal FOR … NEXT', () => {
    const ast = parseOk(`
FOR I ← 1 TO 10
    OUTPUT I
NEXT I
`);
    const stmt = ast.body[0] as ForStatement;
    expect(stmt.kind).toBe('ForStatement');
    expect(stmt.variable).toBe('I');
    expect(stmt.step).toBeNull();
    expect(stmt.body).toHaveLength(1);
  });

  it('parses FOR with STEP', () => {
    const ast = parseOk(`
FOR I ← 10 TO 1 STEP -1
    OUTPUT I
NEXT I
`);
    const stmt = ast.body[0] as ForStatement;
    expect(stmt.step).not.toBeNull();
  });

  it('parses FOR with positive STEP', () => {
    const ast = parseOk(`
FOR I ← 0 TO 100 STEP 5
    OUTPUT I
NEXT I
`);
    const stmt = ast.body[0] as ForStatement;
    expect(stmt.step).not.toBeNull();
  });

  it('parses FOR with empty body', () => {
    const ast = parseOk(`
FOR I ← 1 TO 1
NEXT I
`);
    const stmt = ast.body[0] as ForStatement;
    expect(stmt.body).toHaveLength(0);
  });

  it('parses nested FOR loops', () => {
    const ast = parseOk(`
FOR I ← 1 TO 3
    FOR J ← 1 TO 3
        OUTPUT I, J
    NEXT J
NEXT I
`);
    const outer = ast.body[0] as ForStatement;
    expect(outer.variable).toBe('I');
    const inner = outer.body[0] as ForStatement;
    expect(inner.kind).toBe('ForStatement');
    expect(inner.variable).toBe('J');
  });

  it('parses IF inside FOR', () => {
    const ast = parseOk(`
FOR I ← 1 TO 10
    IF I > 5 THEN
        OUTPUT I
    ENDIF
NEXT I
`);
    const stmt = ast.body[0] as ForStatement;
    expect(stmt.body[0]?.kind).toBe('IfStatement');
  });

  it('parses WHILE inside FOR', () => {
    const ast = parseOk(`
FOR I ← 1 TO 5
    WHILE X > 0
        X ← X - 1
    ENDWHILE
NEXT I
`);
    const stmt = ast.body[0] as ForStatement;
    expect(stmt.body[0]?.kind).toBe('WhileStatement');
  });

  it('parses REPEAT inside FOR', () => {
    const ast = parseOk(`
FOR I ← 1 TO 5
    REPEAT
        OUTPUT I
    UNTIL Done = TRUE
NEXT I
`);
    const stmt = ast.body[0] as ForStatement;
    expect(stmt.body[0]?.kind).toBe('RepeatStatement');
  });

  it('rejects missing NEXT', () => {
    const result = parse(`
FOR I ← 1 TO 10
    OUTPUT I
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_FOR_NEXT')).toBe(true);
  });

  it('rejects missing TO', () => {
    const result = parse(`
FOR I ← 1 10
    OUTPUT I
NEXT I
`);
    expect(result.ok).toBe(false);
  });

  it('rejects NEXT variable mismatch', () => {
    const result = parse(`
FOR I ← 1 TO 5
    OUTPUT I
NEXT J
`);
    expect(result.diagnostics.some((d) => d.code === 'E_FOR_NEXT_MISMATCH')).toBe(true);
  });

  it('parses expression bounds', () => {
    const ast = parseOk(`
FOR I ← Start + 1 TO End * 2
    OUTPUT I
NEXT I
`);
    const stmt = ast.body[0] as ForStatement;
    expect(stmt.start.kind).toBe('BinaryExpression');
    expect(stmt.end.kind).toBe('BinaryExpression');
  });

  it('parses lowercase for keywords', () => {
    const ast = parseOk(`
for i ← 1 to 5
    OUTPUT i
next i
`);
    expect(ast.body[0]?.kind).toBe('ForStatement');
  });
});
