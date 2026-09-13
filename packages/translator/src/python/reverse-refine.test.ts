import { describe, expect, it } from 'vitest';
import type { IrExpression } from '../ir/nodes.js';
import {
  inferReturnTypeFromBody,
  inferSimpleTypeFromExpr,
  insertTopLevelDeclarations,
  insertRoutineLocalDeclarations,
  simplifyIrExpression,
} from './reverse-refine.js';
import type { IrParameter, IrStatement } from '../ir/nodes.js';

function int(n: number): IrExpression {
  return { kind: 'IrIntegerLiteral', value: n };
}

function bin(
  operator: '+' | '-' | '*' | '//',
  left: IrExpression,
  right: IrExpression,
): IrExpression {
  return { kind: 'IrBinaryExpression', operator, left, right };
}

describe('inferSimpleTypeFromExpr', () => {
  it('infers INTEGER from binary + on INTEGER params', () => {
    const x: IrExpression = { kind: 'IrIdentifier', name: 'x' };
    const expr = bin('+', x, int(1));
    const t = inferSimpleTypeFromExpr(expr, {
      paramTypes: new Map([['x', { kind: 'IrScalarType', name: 'INTEGER' }]]),
    });
    expect(t).toEqual({ kind: 'IrScalarType', name: 'INTEGER' });
  });

  it('infers element type from array parameter indexing', () => {
    const values: IrExpression = { kind: 'IrIdentifier', name: 'values' };
    const expr: IrExpression = {
      kind: 'IrIndexExpression',
      array: values,
      indices: [int(0)],
    };
    const t = inferSimpleTypeFromExpr(expr, {
      paramArrayElements: new Map([
        ['values', { kind: 'IrScalarType', name: 'INTEGER' }],
      ]),
    });
    expect(t).toEqual({ kind: 'IrScalarType', name: 'INTEGER' });
  });
});

describe('inferReturnTypeFromBody', () => {
  it('infers INTEGER from return mid after local assignment', () => {
    const body: IrStatement[] = [
      {
        kind: 'IrAssignment',
        target: { kind: 'IrIdentifier', name: 'mid' },
        value: bin('//', bin('+', { kind: 'IrIdentifier', name: 'low' }, { kind: 'IrIdentifier', name: 'high' }), int(2)),
      },
      { kind: 'IrReturnStatement', value: { kind: 'IrIdentifier', name: 'mid' } },
    ];
    expect(inferReturnTypeFromBody(body, [])).toEqual({
      kind: 'IrScalarType',
      name: 'INTEGER',
    });
  });

  it('infers INTEGER from return x + 1', () => {
    const params: IrParameter[] = [
      {
        kind: 'IrParameter',
        name: 'x',
        typeName: { kind: 'IrScalarType', name: 'INTEGER' },
        mode: 'BYVAL',
      },
    ];
    const body: IrStatement[] = [
      {
        kind: 'IrReturnStatement',
        value: bin('+', { kind: 'IrIdentifier', name: 'x' }, int(1)),
      },
    ];
    expect(inferReturnTypeFromBody(body, params)).toEqual({
      kind: 'IrScalarType',
      name: 'INTEGER',
    });
  });
});

describe('insertTopLevelDeclarations', () => {
  it('hoists DECLARE for assignments inside nested top-level blocks', () => {
    const body: IrStatement[] = [
      {
        kind: 'IrWhileStatement',
        condition: { kind: 'IrBooleanLiteral', value: true },
        body: [
          {
            kind: 'IrIfStatement',
            condition: { kind: 'IrBooleanLiteral', value: true },
            consequent: [
              {
                kind: 'IrAssignment',
                target: { kind: 'IrIdentifier', name: 'temp' },
                value: int(1),
              },
            ],
            elseIfClauses: [],
            alternate: null,
          },
        ],
      },
    ];
    const out = insertTopLevelDeclarations(body);
    expect(out[0]?.kind).toBe('IrDeclareStatement');
    if (out[0]?.kind === 'IrDeclareStatement') {
      expect(out[0].names).toEqual(['temp']);
      expect(out[0].typeRef).toEqual({ kind: 'IrScalarType', name: 'INTEGER' });
    }
    expect(out[1]?.kind).toBe('IrWhileStatement');
  });
});

describe('insertRoutineLocalDeclarations', () => {
  it('hoists DECLARE for assignments inside nested routine blocks', () => {
    const body: IrStatement[] = [
      {
        kind: 'IrProcedureDeclaration',
        name: 'test',
        parameters: [],
        body: [
          {
            kind: 'IrIfStatement',
            condition: { kind: 'IrBooleanLiteral', value: true },
            consequent: [
              {
                kind: 'IrAssignment',
                target: { kind: 'IrIdentifier', name: 'temp' },
                value: int(5),
              },
            ],
            elseIfClauses: [],
            alternate: [
              {
                kind: 'IrAssignment',
                target: { kind: 'IrIdentifier', name: 'other' },
                value: { kind: 'IrStringLiteral', value: 'hello' },
              },
            ],
          },
        ],
        leadingTrivia: [],
        trailingTrivia: [],
      },
    ];
    const out = insertRoutineLocalDeclarations(body);
    const proc = out[0];
    expect(proc?.kind).toBe('IrProcedureDeclaration');
    if (proc?.kind === 'IrProcedureDeclaration') {
      expect(proc.body[0]?.kind).toBe('IrDeclareStatement');
      expect(proc.body[1]?.kind).toBe('IrDeclareStatement');
    }
  });
});

describe('simplifyIrExpression', () => {
  it('folds literal integer arithmetic', () => {
    expect(simplifyIrExpression(bin('-', int(5), int(1)))).toEqual(int(4));
  });

  it('cancels redundant (x + 1) - 1', () => {
    const x: IrExpression = { kind: 'IrIdentifier', name: 'N' };
    const expr = bin('-', bin('+', x, int(1)), int(1));
    expect(simplifyIrExpression(expr)).toEqual(x);
  });

  it('cancels redundant (x - 1) + 1', () => {
    const x: IrExpression = { kind: 'IrIdentifier', name: 'N' };
    const expr = bin('+', bin('-', x, int(1)), int(1));
    expect(simplifyIrExpression(expr)).toEqual(x);
  });

  it('folds array-length style range end expressions', () => {
    const expr = bin(
      '-',
      bin('+', bin('-', int(5), int(1)), int(1)),
      int(1),
    );
    expect(simplifyIrExpression(expr)).toEqual(int(4));
  });
});
