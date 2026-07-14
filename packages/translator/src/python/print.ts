import type {
  IrBinaryExpression,
  IrExpression,
  IrProgram,
  IrStatement,
  IrUnaryExpression,
} from '../ir/nodes.js';
import {
  escapePythonString,
  formatBooleanPython,
  formatRealLiteral,
} from '../rules/literals.js';
import {
  BINARY_PRECEDENCE,
  UNARY_PRECEDENCE,
  irBinaryToPython,
  irUnaryToPython,
  isWordOperator,
} from '../rules/operators.js';
import { printTrivia } from '../trivia/attach.js';

function printExpr(expr: IrExpression, parentPrec: number): string {
  switch (expr.kind) {
    case 'IrIntegerLiteral':
      return String(expr.value);
    case 'IrRealLiteral':
      return formatRealLiteral(expr.value);
    case 'IrStringLiteral':
      return `"${escapePythonString(expr.value)}"`;
    case 'IrBooleanLiteral':
      return formatBooleanPython(expr.value);
    case 'IrIdentifier':
      return expr.name;
    case 'IrGroupingExpression':
      return `(${printExpr(expr.expression, 0)})`;
    case 'IrUnaryExpression':
      return printUnary(expr, parentPrec);
    case 'IrBinaryExpression':
      return printBinary(expr, parentPrec);
    default: {
      const _exhaustive: never = expr;
      return _exhaustive;
    }
  }
}

function printUnary(expr: IrUnaryExpression, parentPrec: number): string {
  const prec = UNARY_PRECEDENCE;
  const op = irUnaryToPython(expr.operator);
  const arg = printExpr(expr.argument, prec);
  const gap = isWordOperator(op) ? ' ' : '';
  const core = `${op}${gap}${arg}`;
  return prec < parentPrec ? `(${core})` : core;
}

function printBinary(expr: IrBinaryExpression, parentPrec: number): string {
  const prec = BINARY_PRECEDENCE[expr.operator];
  const op = irBinaryToPython(expr.operator);
  const left = printExpr(expr.left, prec);
  const right = printExpr(expr.right, prec + 1);
  const core = `${left} ${op} ${right}`;
  return prec < parentPrec ? `(${core})` : core;
}

/**
 * Expand IrInput with prompt into OUTPUT then INPUT semantics for Cambridge;
 * for Python, emit assignment from input(...).
 */
function printStatement(stmt: IrStatement): string[] {
  const lines: string[] = [...printTrivia(stmt.leadingTrivia, 'hash')];
  let code: string;
  switch (stmt.kind) {
    case 'IrAssignment':
      code = `${stmt.target.name} = ${printExpr(stmt.value, 0)}`;
      break;
    case 'IrInput':
      if (stmt.prompt) {
        code = `${stmt.target.name} = input(${printExpr(stmt.prompt, 0)})`;
      } else {
        code = `${stmt.target.name} = input()`;
      }
      break;
    case 'IrOutput':
      code = `print(${stmt.values.map((v) => printExpr(v, 0)).join(', ')})`;
      break;
    default: {
      const _exhaustive: never = stmt;
      return _exhaustive;
    }
  }
  const trailing = printTrivia(stmt.trailingTrivia, 'hash');
  if (trailing.length > 0 && trailing[0]?.startsWith('#')) {
    lines.push(`${code} ${trailing[0]}`);
    lines.push(...trailing.slice(1));
  } else {
    lines.push(code);
    lines.push(...trailing);
  }
  return lines;
}

function finalizeOutput(lines: string[]): string {
  while (lines.length > 0 && lines[0] === '') {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.length === 0 ? '' : `${lines.join('\n')}\n`;
}

export function printPython(program: IrProgram): string {
  const lines: string[] = [...printTrivia(program.leadingTrivia, 'hash')];
  for (const stmt of program.body) {
    lines.push(...printStatement(stmt));
  }
  lines.push(...printTrivia(program.trailingTrivia, 'hash'));
  return finalizeOutput(lines);
}
