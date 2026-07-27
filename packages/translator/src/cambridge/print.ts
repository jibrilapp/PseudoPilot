import type {
  IrAssignTarget,
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
  escapeCambridgeChar,
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

/** Cambridge Guide typically uses ~3 spaces; we use 4 for clear nesting. */
const INDENT = '    ';

function printTarget(target: IrAssignTarget): string {
  if (target.kind === 'IrIdentifier') return target.name;
  const idxs = target.indices.map((i) => printExpr(i, 0)).join(', ');
  return `${target.array.name}[${idxs}]`;
}

function printExpr(expr: IrExpression, parentPrec: number): string {
  switch (expr.kind) {
    case 'IrIntegerLiteral':
      return String(expr.value);
    case 'IrRealLiteral':
      return formatRealLiteral(expr.value);
    case 'IrStringLiteral':
      return `"${escapeCambridgeString(expr.value)}"`;
    case 'IrCharLiteral':
      return `'${escapeCambridgeChar(expr.value)}'`;
    case 'IrBooleanLiteral':
      return formatBooleanCambridge(expr.value);
    case 'IrIdentifier':
      return expr.name;
    case 'IrIndexExpression':
      return printTarget(expr);
    case 'IrCallExpression':
      return `${expr.callee}(${expr.args.map((a) => printExpr(a, 0)).join(', ')})`;
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
  const right = printExpr(expr.right, prec + 1);
  const core = `${left} ${op} ${right}`;
  return prec < parentPrec ? `(${core})` : core;
}

function pad(level: number): string {
  return INDENT.repeat(level);
}

function printBlock(
  statements: readonly IrStatement[],
  arrow: string,
  level: number,
): string[] {
  const lines: string[] = [];
  for (const stmt of statements) {
    lines.push(...printStatement(stmt, arrow, level));
  }
  return lines;
}

function printStatement(
  stmt: IrStatement,
  arrow: string,
  level: number,
): string[] {
  const p = pad(level);
  const lines: string[] = [
    ...printTrivia(stmt.leadingTrivia, 'slash').map((l) =>
      l.length === 0 ? l : `${p}${l}`,
    ),
  ];

  switch (stmt.kind) {
    case 'IrAssignment':
      lines.push(`${p}${printTarget(stmt.target)} ${arrow} ${printExpr(stmt.value, 0)}`);
      break;
    case 'IrInput':
      if (stmt.prompt) {
        lines.push(`${p}OUTPUT ${printExpr(stmt.prompt, 0)}`);
      }
      lines.push(`${p}INPUT ${printTarget(stmt.target)}`);
      break;
    case 'IrOutput':
      lines.push(
        stmt.values.length === 0
          ? `${p}OUTPUT`
          : `${p}OUTPUT ${stmt.values.map((v) => printExpr(v, 0)).join(', ')}`,
      );
      break;
    case 'IrIfStatement': {
      lines.push(`${p}IF ${printExpr(stmt.condition, 0)} THEN`);
      lines.push(...printBlock(stmt.consequent, arrow, level + 1));
      for (const clause of stmt.elseIfClauses) {
        lines.push(`${p}ELSE IF ${printExpr(clause.condition, 0)} THEN`);
        lines.push(...printBlock(clause.consequent, arrow, level + 1));
      }
      if (stmt.alternate !== null) {
        lines.push(`${p}ELSE`);
        lines.push(...printBlock(stmt.alternate, arrow, level + 1));
      }
      lines.push(`${p}ENDIF`);
      break;
    }
    case 'IrCaseStatement': {
      lines.push(`${p}CASE OF ${printExpr(stmt.discriminant, 0)}`);
      for (const arm of stmt.arms) {
        const label =
          arm.label.kind === 'IrCaseValue'
            ? printExpr(arm.label.value, 0)
            : `${printExpr(arm.label.low, 0)} TO ${printExpr(arm.label.high, 0)}`;
        lines.push(`${p}    ${label} :`);
        lines.push(...printBlock(arm.body, arrow, level + 2));
      }
      if (stmt.otherwise !== null) {
        lines.push(`${p}    OTHERWISE`);
        lines.push(...printBlock(stmt.otherwise, arrow, level + 2));
      }
      lines.push(`${p}ENDCASE`);
      break;
    }
    case 'IrWhileStatement': {
      lines.push(`${p}WHILE ${printExpr(stmt.condition, 0)} DO`);
      lines.push(...printBlock(stmt.body, arrow, level + 1));
      lines.push(`${p}ENDWHILE`);
      break;
    }
    case 'IrRepeatStatement': {
      lines.push(`${p}REPEAT`);
      lines.push(...printBlock(stmt.body, arrow, level + 1));
      lines.push(`${p}UNTIL ${printExpr(stmt.condition, 0)}`);
      break;
    }
    case 'IrForStatement': {
      const stepPart = stmt.step ? ` STEP ${printExpr(stmt.step, 0)}` : '';
      lines.push(`${p}FOR ${stmt.variable} ${arrow} ${printExpr(stmt.start, 0)} TO ${printExpr(stmt.end, 0)}${stepPart}`);
      lines.push(...printBlock(stmt.body, arrow, level + 1));
      lines.push(`${p}NEXT ${stmt.variable}`);
      break;
    }
    case 'IrProcedureDeclaration': {
      const params = stmt.parameters
        .map((param) => `${param.name} : ${param.typeName}`)
        .join(', ');
      lines.push(`${p}PROCEDURE ${stmt.name}(${params})`);
      lines.push(...printBlock(stmt.body, arrow, level + 1));
      lines.push(`${p}ENDPROCEDURE`);
      break;
    }
    case 'IrFunctionDeclaration': {
      const params = stmt.parameters
        .map((param) => `${param.name} : ${param.typeName}`)
        .join(', ');
      lines.push(
        `${p}FUNCTION ${stmt.name}(${params}) RETURNS ${stmt.returnType}`,
      );
      lines.push(...printBlock(stmt.body, arrow, level + 1));
      lines.push(`${p}ENDFUNCTION`);
      break;
    }
    case 'IrCallStatement': {
      lines.push(
        `${p}CALL ${stmt.callee}(${stmt.args.map((a) => printExpr(a, 0)).join(', ')})`,
      );
      break;
    }
    case 'IrReturnStatement':
      lines.push(`${p}RETURN ${printExpr(stmt.value, 0)}`);
      break;
    case 'IrBreakStatement':
      break;
    default: {
      const _exhaustive: never = stmt;
      return _exhaustive;
    }
  }

  const trailing = printTrivia(stmt.trailingTrivia, 'slash');
  if (
    stmt.kind !== 'IrIfStatement' &&
    stmt.kind !== 'IrCaseStatement' &&
    stmt.kind !== 'IrWhileStatement' &&
    stmt.kind !== 'IrRepeatStatement' &&
    stmt.kind !== 'IrForStatement' &&
    stmt.kind !== 'IrProcedureDeclaration' &&
    stmt.kind !== 'IrFunctionDeclaration' &&
    trailing.length > 0 &&
    trailing[0]?.startsWith('//')
  ) {
    const last = lines.pop()!;
    lines.push(`${last} ${trailing[0]}`);
    lines.push(...trailing.slice(1).map((l) => (l.length === 0 ? l : `${p}${l}`)));
  } else {
    lines.push(
      ...trailing.map((l) => (l.length === 0 ? l : `${p}${l}`)),
    );
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
    lines.push(...printStatement(stmt, arrow, 0));
  }
  lines.push(...printTrivia(program.trailingTrivia, 'slash'));
  return finalizeOutput(lines);
}
