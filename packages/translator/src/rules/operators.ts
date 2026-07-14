import type { IrBinaryOp, IrUnaryOp } from '../ir/nodes.js';
import type { BinaryOperator, UnaryOperator } from '@pseudopilot/language-core';

/** Higher number = tighter binding. */
export const PRECEDENCE: Readonly<Record<IrBinaryOp | IrUnaryOp, number>> = {
  or: 1,
  and: 2,
  '==': 3,
  '!=': 3,
  '<': 3,
  '<=': 3,
  '>': 3,
  '>=': 3,
  '+': 4,
  '-': 4,
  '*': 5,
  '/': 5,
  '//': 5,
  '%': 5,
  not: 6,
};

export const BINARY_PRECEDENCE: Readonly<Record<IrBinaryOp, number>> = {
  or: 1,
  and: 2,
  '==': 3,
  '!=': 3,
  '<': 3,
  '<=': 3,
  '>': 3,
  '>=': 3,
  '+': 4,
  '-': 4,
  '*': 5,
  '/': 5,
  '//': 5,
  '%': 5,
};

export const UNARY_PRECEDENCE = 6;

const CAMBRIDGE_TO_IR_BINARY: Readonly<Record<BinaryOperator, IrBinaryOp>> = {
  '+': '+',
  '-': '-',
  '*': '*',
  '/': '/',
  DIV: '//',
  MOD: '%',
  '=': '==',
  '<>': '!=',
  '<': '<',
  '<=': '<=',
  '>': '>',
  '>=': '>=',
  AND: 'and',
  OR: 'or',
};

const IR_TO_CAMBRIDGE_BINARY: Readonly<Record<IrBinaryOp, string>> = {
  '+': '+',
  '-': '-',
  '*': '*',
  '/': '/',
  '//': 'DIV',
  '%': 'MOD',
  '==': '=',
  '!=': '<>',
  '<': '<',
  '<=': '<=',
  '>': '>',
  '>=': '>=',
  and: 'AND',
  or: 'OR',
};

const IR_TO_PYTHON_BINARY: Readonly<Record<IrBinaryOp, string>> = {
  '+': '+',
  '-': '-',
  '*': '*',
  '/': '/',
  '//': '//',
  '%': '%',
  '==': '==',
  '!=': '!=',
  '<': '<',
  '<=': '<=',
  '>': '>',
  '>=': '>=',
  and: 'and',
  or: 'or',
};

export function cambridgeBinaryToIr(op: BinaryOperator): IrBinaryOp {
  return CAMBRIDGE_TO_IR_BINARY[op];
}

export function irBinaryToCambridge(op: IrBinaryOp): string {
  return IR_TO_CAMBRIDGE_BINARY[op];
}

export function irBinaryToPython(op: IrBinaryOp): string {
  return IR_TO_PYTHON_BINARY[op];
}

export function cambridgeUnaryToIr(op: UnaryOperator): IrUnaryOp {
  if (op === 'NOT') return 'not';
  return op;
}

export function irUnaryToCambridge(op: IrUnaryOp): string {
  if (op === 'not') return 'NOT';
  return op;
}

export function irUnaryToPython(op: IrUnaryOp): string {
  return op;
}

/** Word operators need spaces: DIV, MOD, AND, OR, and, or, not */
export function isWordOperator(op: string): boolean {
  return /^[A-Za-z]+$/.test(op);
}
