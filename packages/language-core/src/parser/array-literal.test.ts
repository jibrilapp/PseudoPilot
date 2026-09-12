import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import type {
  ArrayLiteralExpression,
  AssignmentStatement,
  IndexExpression,
  Program,
} from '../ast/nodes.js';

function parseOk(source: string): Program {
  const result = parse(source);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  expect(result.ok).toBe(true);
  return result.ast;
}

describe('array literal expressions', () => {
  it('parses integer array literal assignment', () => {
    const ast = parseOk(`DECLARE list : ARRAY[1:6] OF INTEGER
list ← [1,2,3,4,5,6]
`);
    const assign = ast.body[1] as AssignmentStatement;
    expect(assign.value.kind).toBe('ArrayLiteralExpression');
    const lit = assign.value as ArrayLiteralExpression;
    expect(lit.elements).toHaveLength(6);
    expect(lit.elements[0]).toMatchObject({ kind: 'IntegerLiteral', value: 1 });
    expect(lit.elements[5]).toMatchObject({ kind: 'IntegerLiteral', value: 6 });
  });

  it('parses string and boolean literal elements', () => {
    const ast = parseOk(`DECLARE Names : ARRAY[1:2] OF STRING
Names ← ["Ada","Grace"]
DECLARE Flags : ARRAY[1:2] OF BOOLEAN
Flags ← [TRUE,FALSE]
`);
    const names = (ast.body[1] as AssignmentStatement).value as ArrayLiteralExpression;
    expect(names.elements[0]?.kind).toBe('StringLiteral');
    const flags = (ast.body[3] as AssignmentStatement).value as ArrayLiteralExpression;
    expect(flags.elements[0]?.kind).toBe('BooleanLiteral');
  });

  it('rejects empty array literal', () => {
    const result = parse(`DECLARE list : ARRAY[1:3] OF INTEGER
list ← []
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.message.includes('at least one element'))).toBe(
      true,
    );
  });

  it('rejects trailing comma in array literal', () => {
    const result = parse(`DECLARE list : ARRAY[1:2] OF INTEGER
list ← [1,2,]
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_TRAILING_COMMA')).toBe(true);
  });

  it('still parses indexed access after literal assignment', () => {
    const ast = parseOk(`DECLARE list : ARRAY[1:6] OF INTEGER
list ← [1,2,3,4,5,6]
OUTPUT list[1], list[6]
`);
    const out = ast.body[2];
    expect(out?.kind).toBe('OutputStatement');
  });

  it('parses bubble-sort style literal (10 elements)', () => {
    const ast = parseOk(`DECLARE list : ARRAY[1:10] OF INTEGER
list ← [5,4,3,1,2,6,7,8,9,0]
`);
    const lit = (ast.body[1] as AssignmentStatement).value as ArrayLiteralExpression;
    expect(lit.elements).toHaveLength(10);
    expect(lit.elements[9]).toMatchObject({ kind: 'IntegerLiteral', value: 0 });
  });
});

describe('array literal access after assignment', () => {
  it('index expressions reference declared array', () => {
    const ast = parseOk(`DECLARE list : ARRAY[1:6] OF INTEGER
list ← [1,2,3,4,5,6]
list[1] ← list[1] + 10
`);
    const idxAssign = ast.body[2] as AssignmentStatement;
    expect(idxAssign.target.kind).toBe('IndexExpression');
    expect((idxAssign.target as IndexExpression).array).toMatchObject({
      kind: 'Identifier',
      name: 'list',
    });
  });
});
