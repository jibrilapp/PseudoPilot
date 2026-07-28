import type {
  IrAssignTarget,
  IrBinaryExpression,
  IrExpression,
  IrProgram,
  IrStatement,
  IrTypeReference,
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
import { tryPrintBuiltinPython } from '../builtins/emit.js';
import { printTrivia } from '../trivia/attach.js';
import {
  PP_EOF_HELPER,
  PP_FILES_INIT,
  fileHandleName,
  programUsesEof,
  programUsesFiles,
  pythonMode,
} from '../file/mapping.js';

const INDENT = '    ';

type FilePrintCtx = {
  /** literal path → Python handle identifier */
  readonly handles: Map<string, string>;
  needsDict: boolean;
};

/** Active while {@link printPython} runs — avoids threading ctx through every expr. */
let activeFileCtx: FilePrintCtx | null = null;

function fileRef(pathExpr: IrExpression): string {
  const ctx = activeFileCtx;
  if (!ctx) {
    return `_pp_files[${printExpr(pathExpr, 0)}]`;
  }
  if (pathExpr.kind === 'IrStringLiteral') {
    let h = ctx.handles.get(pathExpr.value);
    if (!h) {
      h = fileHandleName(pathExpr.value);
      ctx.handles.set(pathExpr.value, h);
    }
    return h;
  }
  ctx.needsDict = true;
  return `_pp_files[${printExpr(pathExpr, 0)}]`;
}

function isNegativeLiteral(expr: IrExpression | null): boolean {
  if (!expr) return false;
  if (expr.kind === 'IrIntegerLiteral' || expr.kind === 'IrRealLiteral') {
    return expr.value < 0;
  }
  if (
    expr.kind === 'IrUnaryExpression' &&
    expr.operator === '-' &&
    (expr.argument.kind === 'IrIntegerLiteral' || expr.argument.kind === 'IrRealLiteral')
  ) {
    return true;
  }
  return false;
}

function irTypeToPython(typeName: string): string {
  switch (typeName) {
    case 'INTEGER':
      return 'int';
    case 'REAL':
      return 'float';
    case 'STRING':
      return 'str';
    case 'BOOLEAN':
      return 'bool';
    case 'CHAR':
      return 'str';
    default:
      return 'int';
  }
}

/**
 * Python emission strategy (DECLARE / CONSTANT):
 * - Scalar DECLARE → `Name: pytype` (annotation only; CHAR adds `# CHAR`)
 * - Array DECLARE → `Name: list[elem]  # ARRAY[l:u, …]`
 * - Multi-name DECLARE → one annotation line per name
 * - CONSTANT → `Name = literal  # CONSTANT`
 */
function printDeclarePython(
  names: readonly string[],
  typeRef: IrTypeReference,
  level: number,
): string[] {
  const p = pad(level);
  if (typeRef.kind === 'IrScalarType') {
    const py = irTypeToPython(typeRef.name);
    const charTag = typeRef.name === 'CHAR' ? '  # CHAR' : '';
    return names.map((name) => `${p}${name}: ${py}${charTag}`);
  }
  const elem = irTypeToPython(typeRef.elementType);
  const dims = typeRef.dimensions
    .map((d) => `${printExpr(d.lower, 0)}:${printExpr(d.upper, 0)}`)
    .join(', ');
  return names.map(
    (name) => `${p}${name}: list[${elem}]  # ARRAY[${dims}]`,
  );
}

function pad(level: number): string {
  return INDENT.repeat(level);
}

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
    case 'IrCallExpression': {
      const builtin = tryPrintBuiltinPython(
        expr.callee,
        expr.args,
        printExpr,
      );
      if (builtin !== null) return builtin;
      return `${expr.callee}(${expr.args.map((a) => printExpr(a, 0)).join(', ')})`;
    }
    case 'IrEofExpression':
      return `_pp_eof(${fileRef(expr.fileName)})`;
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
    case 'IrCaseStatement': {
      lines.push(`${p}match ${printExpr(stmt.discriminant, 0)}:`);
      if (stmt.arms.length === 0 && stmt.otherwise === null) {
        lines.push(`${pad(level + 1)}case _:`);
        lines.push(`${pad(level + 2)}pass`);
      } else {
        for (const arm of stmt.arms) {
          if (arm.label.kind === 'IrCaseValue') {
            lines.push(`${pad(level + 1)}case ${printExpr(arm.label.value, 0)}:`);
          } else {
            // Guarded capture preserves inclusive Cambridge TO ranges.
            lines.push(
              `${pad(level + 1)}case _v if ${printExpr(arm.label.low, 0)} <= _v and _v <= ${printExpr(arm.label.high, 0)}:`,
            );
          }
          lines.push(...printBlock(arm.body, level + 2));
        }
        if (stmt.otherwise !== null) {
          lines.push(`${pad(level + 1)}case _:`);
          lines.push(...printBlock(stmt.otherwise, level + 2));
        }
      }
      break;
    }
    case 'IrWhileStatement': {
      lines.push(`${p}while ${printExpr(stmt.condition, 0)}:`);
      lines.push(...printBlock(stmt.body, level + 1));
      break;
    }
    case 'IrRepeatStatement': {
      lines.push(`${p}while True:`);
      if (stmt.body.length === 0) {
        lines.push(`${pad(level + 1)}pass`);
      } else {
        lines.push(...printBlock(stmt.body, level + 1));
      }
      lines.push(`${pad(level + 1)}if ${printExpr(stmt.condition, 0)}:`);
      lines.push(`${pad(level + 2)}break`);
      break;
    }
    case 'IrForStatement': {
      const startStr = printExpr(stmt.start, 0);
      const isDescending = isNegativeLiteral(stmt.step);
      const adjust = isDescending ? ' - 1' : ' + 1';
      const endStr = `${printExpr(stmt.end, 0)}${adjust}`;
      if (stmt.step) {
        lines.push(`${p}for ${stmt.variable} in range(${startStr}, ${endStr}, ${printExpr(stmt.step, 0)}):`);
      } else {
        lines.push(`${p}for ${stmt.variable} in range(${startStr}, ${endStr}):`);
      }
      lines.push(...printBlock(stmt.body, level + 1));
      break;
    }
    case 'IrDeclareStatement':
      lines.push(...printDeclarePython(stmt.names, stmt.typeRef, level));
      break;
    case 'IrConstantStatement':
      lines.push(`${p}${stmt.name} = ${printExpr(stmt.value, 0)}  # CONSTANT`);
      break;
    case 'IrProcedureDeclaration': {
      const params = stmt.parameters
        .map((param) => `${param.name}: ${irTypeToPython(param.typeName)}`)
        .join(', ');
      lines.push(`${p}def ${stmt.name}(${params}):`);
      lines.push(...printBlock(stmt.body, level + 1));
      break;
    }
    case 'IrFunctionDeclaration': {
      const params = stmt.parameters
        .map((param) => `${param.name}: ${irTypeToPython(param.typeName)}`)
        .join(', ');
      lines.push(
        `${p}def ${stmt.name}(${params}) -> ${irTypeToPython(stmt.returnType)}:`,
      );
      lines.push(...printBlock(stmt.body, level + 1));
      break;
    }
    case 'IrCallStatement': {
      lines.push(
        `${p}${stmt.callee}(${stmt.args.map((a) => printExpr(a, 0)).join(', ')})`,
      );
      break;
    }
    case 'IrReturnStatement':
      lines.push(`${p}return ${printExpr(stmt.value, 0)}`);
      break;
    case 'IrBreakStatement':
      lines.push(`${p}break`);
      break;
    case 'IrOpenFileStatement': {
      const handle = fileRef(stmt.fileName);
      const path = printExpr(stmt.fileName, 0);
      const mode = pythonMode(stmt.mode);
      lines.push(`${p}${handle} = open(${path}, "${mode}")`);
      break;
    }
    case 'IrReadFileStatement': {
      const handle = fileRef(stmt.fileName);
      lines.push(
        `${p}${printTarget(stmt.target)} = ${handle}.readline().rstrip("\\n")`,
      );
      break;
    }
    case 'IrWriteFileStatement': {
      const handle = fileRef(stmt.fileName);
      lines.push(
        `${p}${handle}.write(str(${printExpr(stmt.value, 0)}) + "\\n")`,
      );
      break;
    }
    case 'IrCloseFileStatement': {
      const handle = fileRef(stmt.fileName);
      lines.push(`${p}${handle}.close()`);
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
    stmt.kind !== 'IrCaseStatement' &&
    stmt.kind !== 'IrWhileStatement' &&
    stmt.kind !== 'IrRepeatStatement' &&
    stmt.kind !== 'IrForStatement' &&
    stmt.kind !== 'IrDeclareStatement' &&
    stmt.kind !== 'IrConstantStatement' &&
    stmt.kind !== 'IrProcedureDeclaration' &&
    stmt.kind !== 'IrFunctionDeclaration' &&
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
  const fileCtx: FilePrintCtx = { handles: new Map(), needsDict: false };
  activeFileCtx = fileCtx;
  try {
    // Pre-walk file ops so handle names are stable before EOF exprs print.
    if (programUsesFiles(program)) {
      seedFileHandles(program.body, fileCtx);
    }
    const lines: string[] = [...printTrivia(program.leadingTrivia, 'hash')];
    if (irUsesRand(program)) {
      lines.push('import random');
      lines.push('');
    }
    if (programUsesFiles(program)) {
      if (fileCtx.needsDict) {
        lines.push(PP_FILES_INIT);
      }
      if (programUsesEof(program)) {
        lines.push(PP_EOF_HELPER);
        lines.push('');
      } else if (fileCtx.needsDict) {
        lines.push('');
      }
    }
    for (const stmt of program.body) {
      lines.push(...printStatement(stmt, 0));
    }
    lines.push(...printTrivia(program.trailingTrivia, 'hash'));
    return finalizeOutput(lines);
  } finally {
    activeFileCtx = null;
  }
}

function seedFileHandles(
  stmts: readonly IrStatement[],
  ctx: FilePrintCtx,
): void {
  for (const stmt of stmts) {
    if (
      stmt.kind === 'IrOpenFileStatement' ||
      stmt.kind === 'IrReadFileStatement' ||
      stmt.kind === 'IrWriteFileStatement' ||
      stmt.kind === 'IrCloseFileStatement'
    ) {
      activeFileCtx = ctx;
      fileRef(stmt.fileName);
    }
    if (stmt.kind === 'IrIfStatement') {
      seedFileHandles(stmt.consequent, ctx);
      for (const c of stmt.elseIfClauses) seedFileHandles(c.consequent, ctx);
      if (stmt.alternate) seedFileHandles(stmt.alternate, ctx);
    } else if (
      stmt.kind === 'IrWhileStatement' ||
      stmt.kind === 'IrRepeatStatement' ||
      stmt.kind === 'IrForStatement'
    ) {
      seedFileHandles(stmt.body, ctx);
    } else if (stmt.kind === 'IrCaseStatement') {
      for (const arm of stmt.arms) seedFileHandles(arm.body, ctx);
      if (stmt.otherwise) seedFileHandles(stmt.otherwise, ctx);
    } else if (
      stmt.kind === 'IrProcedureDeclaration' ||
      stmt.kind === 'IrFunctionDeclaration'
    ) {
      seedFileHandles(stmt.body, ctx);
    }
  }
}

function irUsesRand(program: IrProgram): boolean {
  const walkExpr = (e: IrExpression): boolean => {
    switch (e.kind) {
      case 'IrCallExpression':
        if (e.callee.toLowerCase() === 'rand') return true;
        return e.args.some(walkExpr);
      case 'IrUnaryExpression':
        return walkExpr(e.argument);
      case 'IrBinaryExpression':
        return walkExpr(e.left) || walkExpr(e.right);
      case 'IrGroupingExpression':
        return walkExpr(e.expression);
      case 'IrIndexExpression':
        return e.indices.some(walkExpr);
      default:
        return false;
    }
  };
  const walkStmt = (s: IrStatement): boolean => {
    switch (s.kind) {
      case 'IrAssignment':
        return walkExpr(s.value);
      case 'IrOutput':
        return s.values.some(walkExpr);
      case 'IrInput':
        return s.prompt ? walkExpr(s.prompt) : false;
      case 'IrIfStatement':
        return (
          walkExpr(s.condition) ||
          s.consequent.some(walkStmt) ||
          s.elseIfClauses.some(
            (c) => walkExpr(c.condition) || c.consequent.some(walkStmt),
          ) ||
          (s.alternate?.some(walkStmt) ?? false)
        );
      case 'IrWhileStatement':
      case 'IrRepeatStatement':
        return walkExpr(s.condition) || s.body.some(walkStmt);
      case 'IrForStatement':
        return (
          walkExpr(s.start) ||
          walkExpr(s.end) ||
          (s.step ? walkExpr(s.step) : false) ||
          s.body.some(walkStmt)
        );
      case 'IrCaseStatement':
        return (
          walkExpr(s.discriminant) ||
          s.arms.some((a) => a.body.some(walkStmt)) ||
          (s.otherwise?.some(walkStmt) ?? false)
        );
      case 'IrProcedureDeclaration':
      case 'IrFunctionDeclaration':
        return s.body.some(walkStmt);
      case 'IrCallStatement':
        return (
          s.callee.toLowerCase() === 'rand' || s.args.some(walkExpr)
        );
      case 'IrReturnStatement':
        return walkExpr(s.value);
      case 'IrConstantStatement':
        return walkExpr(s.value);
      default:
        return false;
    }
  };
  return program.body.some(walkStmt);
}
