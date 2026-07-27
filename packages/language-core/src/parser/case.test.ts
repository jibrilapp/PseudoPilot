import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import type { CaseStatement } from '../ast/nodes.js';

function parseOk(source: string) {
  const result = parse(source);
  expect(result.ok, JSON.stringify(result.diagnostics, null, 2)).toBe(true);
  return result.ast;
}

describe('CASE parser', () => {
  it('parses simple CASE with value arms', () => {
    const ast = parseOk(`
CASE OF Choice
    1 :
        OUTPUT "one"
    2 :
        OUTPUT "two"
ENDCASE
`);
    const stmt = ast.body[0] as CaseStatement;
    expect(stmt.kind).toBe('CaseStatement');
    expect(stmt.arms).toHaveLength(2);
    expect(stmt.otherwise).toBeNull();
  });

  it('parses CASE with OTHERWISE', () => {
    const ast = parseOk(`
CASE OF Choice
    1 :
        OUTPUT "one"
    OTHERWISE
        OUTPUT "other"
ENDCASE
`);
    const stmt = ast.body[0] as CaseStatement;
    expect(stmt.otherwise).not.toBeNull();
    expect(stmt.otherwise).toHaveLength(1);
  });

  it('parses OTHERWISE with colon', () => {
    const ast = parseOk(`
CASE OF X
    1 :
        OUTPUT 1
    OTHERWISE :
        OUTPUT 0
ENDCASE
`);
    expect((ast.body[0] as CaseStatement).otherwise).toHaveLength(1);
  });

  it('parses CASE range labels', () => {
    const ast = parseOk(`
CASE OF N
    1 TO 5 :
        OUTPUT "low"
    6 TO 10 :
        OUTPUT "high"
ENDCASE
`);
    const stmt = ast.body[0] as CaseStatement;
    expect(stmt.arms[0]?.label.kind).toBe('Range');
    expect(stmt.arms[1]?.label.kind).toBe('Range');
  });

  it('parses empty arm bodies', () => {
    const ast = parseOk(`
CASE OF X
    1 :
    2 :
        OUTPUT 2
ENDCASE
`);
    const stmt = ast.body[0] as CaseStatement;
    expect(stmt.arms[0]?.body).toHaveLength(0);
    expect(stmt.arms[1]?.body).toHaveLength(1);
  });

  it('parses nested CASE', () => {
    const ast = parseOk(`
CASE OF Outer
    1 :
        CASE OF Inner
            2 :
                OUTPUT "nested"
        ENDCASE
ENDCASE
`);
    const outer = ast.body[0] as CaseStatement;
    expect(outer.arms[0]?.body[0]?.kind).toBe('CaseStatement');
  });

  it('parses CASE inside IF', () => {
    const ast = parseOk(`
IF Ready = TRUE THEN
    CASE OF X
        1 :
            OUTPUT 1
    ENDCASE
ENDIF
`);
    expect(ast.body[0]?.kind).toBe('IfStatement');
  });

  it('parses IF inside CASE', () => {
    const ast = parseOk(`
CASE OF X
    1 :
        IF Y > 0 THEN
            OUTPUT Y
        ENDIF
ENDCASE
`);
    const stmt = ast.body[0] as CaseStatement;
    expect(stmt.arms[0]?.body[0]?.kind).toBe('IfStatement');
  });

  it('parses CASE inside FOR', () => {
    const ast = parseOk(`
FOR I ← 1 TO 3
    CASE OF I
        1 :
            OUTPUT "one"
        OTHERWISE
            OUTPUT I
    ENDCASE
NEXT I
`);
    expect(ast.body[0]?.kind).toBe('ForStatement');
  });

  it('parses CASE inside WHILE', () => {
    const ast = parseOk(`
WHILE Going = TRUE
    CASE OF X
        0 :
            Going ← FALSE
    ENDCASE
ENDWHILE
`);
    expect(ast.body[0]?.kind).toBe('WhileStatement');
  });

  it('parses CASE inside REPEAT', () => {
    const ast = parseOk(`
REPEAT
    CASE OF X
        1 :
            OUTPUT 1
    ENDCASE
UNTIL Done = TRUE
`);
    expect(ast.body[0]?.kind).toBe('RepeatStatement');
  });

  it('rejects missing OF', () => {
    const result = parse(`
CASE Choice
    1 :
        OUTPUT 1
ENDCASE
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_CASE_OF')).toBe(true);
  });

  it('rejects missing ENDCASE', () => {
    const result = parse(`
CASE OF Choice
    1 :
        OUTPUT 1
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_CASE_END')).toBe(true);
  });

  it('rejects missing colon after label', () => {
    const result = parse(`
CASE OF Choice
    1
        OUTPUT 1
ENDCASE
`);
    expect(result.ok).toBe(false);
  });

  it('reports duplicate labels', () => {
    const result = parse(`
CASE OF Choice
    1 :
        OUTPUT "a"
    1 :
        OUTPUT "b"
ENDCASE
`);
    expect(result.diagnostics.some((d) => d.code === 'E_CASE_DUP')).toBe(true);
  });

  it('rejects OTHERWISE without ENDCASE', () => {
    const result = parse(`
CASE OF X
    OTHERWISE
        OUTPUT 0
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_CASE_END')).toBe(true);
  });

  it('parses CHAR and STRING labels', () => {
    const ast = parseOk(`
CASE OF Ch
    'A' :
        OUTPUT "letter A"
    "stop" :
        OUTPUT "string"
ENDCASE
`);
    expect((ast.body[0] as CaseStatement).arms).toHaveLength(2);
  });
});
