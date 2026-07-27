import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import type { Program, RepeatStatement, Statement } from '../ast/nodes.js';

function parseOk(source: string): Program {
  const result = parse(source);
  expect(result.ok, JSON.stringify(result.diagnostics, null, 2)).toBe(true);
  return result.ast;
}

function asRepeat(stmt: Statement | undefined): RepeatStatement {
  expect(stmt?.kind).toBe('RepeatStatement');
  return stmt as RepeatStatement;
}

describe('REPEAT / UNTIL', () => {
  it('parses REPEAT UNTIL', () => {
    const ast = parseOk(`
REPEAT
    OUTPUT Count
    Count ← Count + 1
UNTIL Count > 10
`);
    const repeat = asRepeat(ast.body[0]);
    expect(repeat.body).toHaveLength(2);
    expect(repeat.condition).toMatchObject({
      kind: 'BinaryExpression',
      operator: '>',
    });
  });

  it('parses empty REPEAT body', () => {
    const ast = parseOk(`
REPEAT
UNTIL TRUE
`);
    expect(asRepeat(ast.body[0]).body).toHaveLength(0);
  });

  it('parses nested REPEAT', () => {
    const ast = parseOk(`
REPEAT
    REPEAT
        OUTPUT "inner"
    UNTIL InnerDone = TRUE
UNTIL OuterDone = TRUE
`);
    const outer = asRepeat(ast.body[0]);
    expect(outer.body[0]?.kind).toBe('RepeatStatement');
  });

  it('parses REPEAT containing WHILE and IF', () => {
    const ast = parseOk(`
REPEAT
    WHILE Temp > 0
        Temp ← Temp - 1
    ENDWHILE
    IF Temp = 0 THEN
        OUTPUT "zero"
    ENDIF
UNTIL Finished = TRUE
`);
    const repeat = asRepeat(ast.body[0]);
    expect(repeat.body[0]?.kind).toBe('WhileStatement');
    expect(repeat.body[1]?.kind).toBe('IfStatement');
  });

  it('parses WHILE containing REPEAT', () => {
    const ast = parseOk(`
WHILE KeepGoing = TRUE
    REPEAT
        OUTPUT 1
    UNTIL Done = TRUE
ENDWHILE
`);
    expect(ast.body[0]?.kind).toBe('WhileStatement');
    if (ast.body[0]?.kind === 'WhileStatement') {
      expect(ast.body[0].body[0]?.kind).toBe('RepeatStatement');
    }
  });

  it('rejects missing UNTIL', () => {
    const result = parse(`
REPEAT
    OUTPUT 1
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.message.includes('UNTIL'))).toBe(true);
  });

  it('rejects malformed UNTIL condition', () => {
    const result = parse(`
REPEAT
    OUTPUT 1
UNTIL
`);
    expect(result.ok).toBe(false);
  });
});
