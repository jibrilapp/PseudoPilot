import type {
  IrBinaryExpression,
  IrExpression,
  IrProgram,
  IrStatement,
  IrUnaryExpression,
} from '../ir/nodes.js';
import {
  formatBooleanCambridge,
  formatRealLiteral,
  escapeCambridgeString,
} from '../rules/literals.js';
import {
  BINARY_PRECEDENCE,
  UNARY_PRECEDENCE,
  irBinaryToCambridge,
  irUnaryToCambridge,
  isWordOperator,
} from '../rules/operators.js';
import { printTrivia } from '../trivia/attach.js';
import type { AssignmentArrow } from '../types.js';

function printExpr(expr: IrExpression, parentPrec: number): string {
  switch (expr.kind) {
    case 'IrIntegerLiteral':
      return String(expr.value);
    case 'IrRealLiteral':
      return formatRealLiteral(expr.value);
    case 'IrStringLiteral':
      return `"${escapeCambridgeString(expr.value)}"`;
    case 'IrBooleanLiteral':
      return formatBooleanCambridge(expr.value);
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
  const op = irUnaryToCambridge(expr.operator);
  const arg = printExpr(expr.argument, prec);
  const gap = isWordOperator(op) ? ' ' : '';
  const core = `${op}${gap}${arg}`;
  return prec < parentPrec ? `(${core})` : core;
}

function printBinary(expr: IrBinaryExpression, parentPrec: number): string {
  const prec = BINARY_PRECEDENCE[expr.operator];
  const op = irBinaryToCambridge(expr.operator);
  const left = printExpr(expr.left, prec);
  const right = printExpr(expr.right, prec + 1); // left-assoc
  const gap = isWordOperator(op) ? ` ${op} ` : ` ${op} `;
  const core = `${left}${gap}${right}`;
  return prec < parentPrec ? `(${core})` : core;
}

function printStatement(stmt: IrStatement, arrow: string): string[] {
  const lines: string[] = [...printTrivia(stmt.leadingTrivia, 'slash')];
  const codes: string[] = [];
  switch (stmt.kind) {
    case 'IrAssignment':
      codes.push(`${stmt.target.name} ${arrow} ${printExpr(stmt.value, 0)}`);
      break;
    case 'IrInput':
      // Python input(prompt) lowers to IrInput with prompt — emit Guide-faithful pair.
      if (stmt.prompt) {
        codes.push(`OUTPUT ${printExpr(stmt.prompt, 0)}`);
      }
      codes.push(`INPUT ${stmt.target.name}`);
      break;
    case 'IrOutput':
      codes.push(`OUTPUT ${stmt.values.map((v) => printExpr(v, 0)).join(', ')}`);
      break;
    default: {
      const _exhaustive: never = stmt;
      return _exhaustive;
    }
  }
  const trailing = printTrivia(stmt.trailingTrivia, 'slash');
  if (codes.length === 1 && trailing.length > 0 && trailing[0]?.startsWith('//')) {
    lines.push(`${codes[0]} ${trailing[0]}`);
    lines.push(...trailing.slice(1));
  } else {
    lines.push(...codes);
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

export function printCambridge(
  program: IrProgram,
  assignmentArrow: AssignmentArrow,
): string {
  const arrow = assignmentArrow === 'ascii' ? '<-' : '←';
  const lines: string[] = [
    ...printTrivia(program.leadingTrivia, 'slash'),
  ];
  for (const stmt of program.body) {
    lines.push(...printStatement(stmt, arrow));
  }
  lines.push(...printTrivia(program.trailingTrivia, 'slash'));
  return finalizeOutput(lines);
}
