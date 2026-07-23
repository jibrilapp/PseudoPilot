import type {
  IrAssignTarget,
  IrBinaryExpression,
  IrExpression,
  IrProgram,
  IrStatement,
  IrUnaryExpression,
} from '../ir/nodes.js';
import {
  escapePythonString,
  escapePythonChar,
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

const INDENT = '    ';

function printTarget(target: IrAssignTarget): string {
  if (target.kind === 'IrIdentifier') return target.name;
  return target.indices.reduce(
    (acc, idx) => `${acc}[${printExpr(idx, 0)}]`,
    target.array.name,
  );
}

function printExpr(expr: IrExpression, parentPrec: number): string {
  switch (expr.kind) {
    case 'IrIntegerLiteral':
      return String(expr.value);
    case 'IrRealLiteral':
      return formatRealLiteral(expr.value);
    case 'IrStringLiteral':
      return `"${escapePythonString(expr.value)}"`;
    case 'IrCharLiteral':
      return `'${escapePythonChar(expr.value)}'`;
    case 'IrBooleanLiteral':
      return formatBooleanPython(expr.value);
    case 'IrIdentifier':
      return expr.name;
    case 'IrIndexExpression':
      return printTarget(expr);
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

function pad(level: number): string {
  return INDENT.repeat(level);
}

function printBlock(
  statements: readonly IrStatement[],
  level: number,
): string[] {
  if (statements.length === 0) {
    return [`${pad(level)}pass`];
  }
  const lines: string[] = [];
  for (const stmt of statements) {
    lines.push(...printStatement(stmt, level));
  }
  return lines;
}

function printStatement(stmt: IrStatement, level: number): string[] {
  const p = pad(level);
  const lines: string[] = [
    ...printTrivia(stmt.leadingTrivia, 'hash').map((l) =>
      l.length === 0 ? l : `${p}${l}`,
    ),
  ];

  switch (stmt.kind) {
    case 'IrAssignment':
      lines.push(`${p}${printTarget(stmt.target)} = ${printExpr(stmt.value, 0)}`);
      break;
    case 'IrInput':
      if (stmt.prompt) {
        lines.push(
          `${p}${printTarget(stmt.target)} = input(${printExpr(stmt.prompt, 0)})`,
        );
      } else {
        lines.push(`${p}${printTarget(stmt.target)} = input()`);
      }
      break;
    case 'IrOutput':
      lines.push(
        `${p}print(${stmt.values.map((v) => printExpr(v, 0)).join(', ')})`,
      );
      break;
    case 'IrIfStatement': {
      lines.push(`${p}if ${printExpr(stmt.condition, 0)}:`);
      lines.push(...printBlock(stmt.consequent, level + 1));
      for (const clause of stmt.elseIfClauses) {
        lines.push(`${p}elif ${printExpr(clause.condition, 0)}:`);
        lines.push(...printBlock(clause.consequent, level + 1));
      }
      if (stmt.alternate !== null) {
        lines.push(`${p}else:`);
        lines.push(...printBlock(stmt.alternate, level + 1));
      }
      break;
    }
    default: {
      const _exhaustive: never = stmt;
      return _exhaustive;
    }
  }

  const trailing = printTrivia(stmt.trailingTrivia, 'hash');
  if (
    stmt.kind !== 'IrIfStatement' &&
    trailing.length > 0 &&
    trailing[0]?.startsWith('#')
  ) {
    const last = lines.pop()!;
    lines.push(`${last} ${trailing[0]}`);
    lines.push(...trailing.slice(1).map((l) => (l.length === 0 ? l : `${p}${l}`)));
  } else {
    lines.push(...trailing.map((l) => (l.length === 0 ? l : `${p}${l}`)));
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
    lines.push(...printStatement(stmt, 0));
  }
  lines.push(...printTrivia(program.trailingTrivia, 'hash'));
  return finalizeOutput(lines);
}
