/**
 * Lift Python open()/readline()/write()/close() and PseudoPilot random-file
 * helpers into IR file statements.
 * Best-effort reverse of our Cambridge→Python file emission.
 */
import {
  withEmptyTrivia,
  type IrExpression,
  type IrProgram,
  type IrStatement,
} from '../ir/nodes.js';
import { cambridgeModeFromPython } from './mapping.js';

type HandleMap = Map<
  string,
  { path: IrExpression; mode: 'READ' | 'WRITE' | 'APPEND' | 'RANDOM' }
>;

export function liftPythonFilePatterns(program: IrProgram): IrProgram {
  const handles: HandleMap = new Map();
  return {
    ...program,
    body: liftStmts(program.body, handles),
  };
}

function liftStmts(
  stmts: readonly IrStatement[],
  handles: HandleMap,
): IrStatement[] {
  const out: IrStatement[] = [];
  for (const stmt of stmts) {
    const lifted = liftOne(stmt, handles);
    if (lifted === null) continue; // dropped helper
    if (Array.isArray(lifted)) out.push(...lifted);
    else out.push(lifted);
  }
  return out;
}

function liftOne(
  stmt: IrStatement,
  handles: HandleMap,
): IrStatement | IrStatement[] | null {
  // Skip `_pp_files = dict()` / `_pp_random_files = dict()` and helpers.
  if (
    stmt.kind === 'IrAssignment' &&
    stmt.target.kind === 'IrIdentifier' &&
    (stmt.target.name === '_pp_files' ||
      stmt.target.name === '_pp_random_files') &&
    stmt.value.kind === 'IrCallExpression' &&
    stmt.value.callee === 'dict' &&
    stmt.value.args.length === 0
  ) {
    return null;
  }
  if (
    stmt.kind === 'IrFunctionDeclaration' &&
    (stmt.name === '_pp_eof' ||
      stmt.name === '_pp_random_open' ||
      stmt.name === '_pp_random_seek' ||
      stmt.name === '_pp_random_get' ||
      stmt.name === '_pp_random_put' ||
      stmt.name === '_pp_random_close')
  ) {
    return null;
  }

  // h = _pp_random_open("path")
  if (
    stmt.kind === 'IrAssignment' &&
    stmt.target.kind === 'IrIdentifier' &&
    stmt.value.kind === 'IrCallExpression' &&
    stmt.value.callee === '_pp_random_open' &&
    stmt.value.args.length === 1
  ) {
    const path = stmt.value.args[0]!;
    handles.set(stmt.target.name, { path, mode: 'RANDOM' });
    return withEmptyTrivia({
      kind: 'IrOpenFileStatement' as const,
      fileName: path,
      mode: 'RANDOM' as const,
    });
  }

  // _pp_random_open(path)  — dynamic-path side-effect open
  if (
    stmt.kind === 'IrCallStatement' &&
    stmt.callee === '_pp_random_open' &&
    stmt.args.length === 1
  ) {
    return withEmptyTrivia({
      kind: 'IrOpenFileStatement' as const,
      fileName: stmt.args[0]!,
      mode: 'RANDOM' as const,
    });
  }

  // _pp_random_seek(h, n) / _pp_random_put(h, rec)
  if (stmt.kind === 'IrCallStatement') {
    if (stmt.callee === '_pp_random_seek' && stmt.args.length === 2) {
      const path = resolveRandomHandle(stmt.args[0]!, handles);
      if (path) {
        return withEmptyTrivia({
          kind: 'IrSeekStatement' as const,
          fileName: path,
          address: stmt.args[1]!,
        });
      }
    }
    if (stmt.callee === '_pp_random_put' && stmt.args.length === 2) {
      const path = resolveRandomHandle(stmt.args[0]!, handles);
      if (path) {
        return withEmptyTrivia({
          kind: 'IrPutRecordStatement' as const,
          fileName: path,
          value: stmt.args[1]!,
        });
      }
    }
    if (stmt.callee === '_pp_random_close' && stmt.args.length === 1) {
      const path = resolveRandomHandle(stmt.args[0]!, handles);
      if (path) {
        return withEmptyTrivia({
          kind: 'IrCloseFileStatement' as const,
          fileName: path,
        });
      }
    }
  }

  // target = _pp_random_get(h)
  if (
    stmt.kind === 'IrAssignment' &&
    stmt.value.kind === 'IrCallExpression' &&
    stmt.value.callee === '_pp_random_get' &&
    stmt.value.args.length === 1
  ) {
    const path = resolveRandomHandle(stmt.value.args[0]!, handles);
    if (path) {
      return withEmptyTrivia({
        kind: 'IrGetRecordStatement' as const,
        fileName: path,
        target: stmt.target,
      });
    }
  }

  // h = open("path", "r")
  if (
    stmt.kind === 'IrAssignment' &&
    stmt.target.kind === 'IrIdentifier' &&
    stmt.value.kind === 'IrCallExpression' &&
    stmt.value.callee === 'open' &&
    stmt.value.args.length >= 2 &&
    stmt.value.args[1]!.kind === 'IrStringLiteral'
  ) {
    const mode = cambridgeModeFromPython(stmt.value.args[1]!.value);
    if (mode) {
      const path = stmt.value.args[0]!;
      handles.set(stmt.target.name, { path, mode });
      return withEmptyTrivia({
        kind: 'IrOpenFileStatement' as const,
        fileName: path,
        mode,
      });
    }
  }

  // _pp_files[path] = open(path, mode)  — dynamic-path forward emit
  if (
    stmt.kind === 'IrAssignment' &&
    stmt.target.kind === 'IrIndexExpression' &&
    stmt.target.array.kind === 'IrIdentifier' &&
    stmt.target.array.name === '_pp_files' &&
    stmt.target.indices.length === 1 &&
    stmt.value.kind === 'IrCallExpression' &&
    stmt.value.callee === 'open' &&
    stmt.value.args.length >= 2 &&
    stmt.value.args[1]!.kind === 'IrStringLiteral'
  ) {
    const mode = cambridgeModeFromPython(stmt.value.args[1]!.value);
    if (mode) {
      const path = stmt.target.indices[0]!;
      return withEmptyTrivia({
        kind: 'IrOpenFileStatement' as const,
        fileName: path,
        mode,
      });
    }
  }

  // target = h.readline().rstrip("\n")
  if (stmt.kind === 'IrAssignment') {
    const read = matchReadlineAssign(stmt.value);
    if (read) {
      if (read.handle && handles.has(read.handle)) {
        const info = handles.get(read.handle)!;
        return withEmptyTrivia({
          kind: 'IrReadFileStatement' as const,
          fileName: info.path,
          target: stmt.target,
        });
      }
      if (read.path) {
        return withEmptyTrivia({
          kind: 'IrReadFileStatement' as const,
          fileName: read.path,
          target: stmt.target,
        });
      }
    }
  }

  // h.write(value) / h.close() as IrCallStatement
  if (stmt.kind === 'IrCallStatement') {
    if (stmt.callee === 'close' && stmt.args.length === 1) {
      const arg = stmt.args[0]!;
      if (arg.kind === 'IrIdentifier' && handles.has(arg.name)) {
        return withEmptyTrivia({
          kind: 'IrCloseFileStatement' as const,
          fileName: handles.get(arg.name)!.path,
        });
      }
      const dyn = filesDictPath(arg);
      if (dyn) {
        return withEmptyTrivia({
          kind: 'IrCloseFileStatement' as const,
          fileName: dyn,
        });
      }
    }
    if (stmt.callee === 'write' && stmt.args.length === 2) {
      const arg = stmt.args[0]!;
      if (arg.kind === 'IrIdentifier' && handles.has(arg.name)) {
        const value = unwrapWritePayload(stmt.args[1]!);
        return withEmptyTrivia({
          kind: 'IrWriteFileStatement' as const,
          fileName: handles.get(arg.name)!.path,
          value,
        });
      }
      const dyn = filesDictPath(arg);
      if (dyn) {
        return withEmptyTrivia({
          kind: 'IrWriteFileStatement' as const,
          fileName: dyn,
          value: unwrapWritePayload(stmt.args[1]!),
        });
      }
    }
  }

  // Structural recursion
  if (stmt.kind === 'IrIfStatement') {
    return {
      ...stmt,
      consequent: liftStmts(stmt.consequent, handles),
      elseIfClauses: stmt.elseIfClauses.map((c) => ({
        ...c,
        consequent: liftStmts(c.consequent, handles),
      })),
      alternate:
        stmt.alternate === null ? null : liftStmts(stmt.alternate, handles),
    };
  }
  if (
    stmt.kind === 'IrWhileStatement' ||
    stmt.kind === 'IrRepeatStatement' ||
    stmt.kind === 'IrForStatement'
  ) {
    return { ...stmt, body: liftStmts(stmt.body, handles) };
  }
  if (stmt.kind === 'IrCaseStatement') {
    return {
      ...stmt,
      arms: stmt.arms.map((a) => ({ ...a, body: liftStmts(a.body, handles) })),
      otherwise:
        stmt.otherwise === null ? null : liftStmts(stmt.otherwise, handles),
    };
  }
  if (
    stmt.kind === 'IrProcedureDeclaration' ||
    stmt.kind === 'IrFunctionDeclaration'
  ) {
    return { ...stmt, body: liftStmts(stmt.body, handles) };
  }

  // EOF: _pp_eof(h) or _pp_eof(_pp_files[path])
  return rewriteEofExprs(stmt, handles);
}

function resolveRandomHandle(
  arg: IrExpression,
  handles: HandleMap,
): IrExpression | null {
  if (arg.kind === 'IrIdentifier' && handles.has(arg.name)) {
    return handles.get(arg.name)!.path;
  }
  if (
    arg.kind === 'IrIndexExpression' &&
    arg.array.kind === 'IrIdentifier' &&
    arg.array.name === '_pp_random_files' &&
    arg.indices.length === 1
  ) {
    return arg.indices[0]!;
  }
  return null;
}

function unwrapWritePayload(value: IrExpression): IrExpression {
  // str(x) + "\n"  (newline may be real \n or the two-char escape form)
  if (
    value.kind === 'IrBinaryExpression' &&
    (value.operator === '+' || value.operator === '&') &&
    value.right.kind === 'IrStringLiteral' &&
    (value.right.value === '\n' || value.right.value === '\\n') &&
    value.left.kind === 'IrCallExpression' &&
    value.left.callee === 'str' &&
    value.left.args.length === 1
  ) {
    return value.left.args[0]!;
  }
  return value;
}

function matchReadlineAssign(
  value: IrExpression,
): { handle?: string; path?: IrExpression } | null {
  // rstrip(readline(h), "\n") after attribute lowering
  if (
    value.kind === 'IrCallExpression' &&
    value.callee === 'rstrip' &&
    value.args.length >= 1
  ) {
    const inner = value.args[0]!;
    if (
      inner.kind === 'IrCallExpression' &&
      inner.callee === 'readline' &&
      inner.args.length === 1
    ) {
      const arg = inner.args[0]!;
      if (arg.kind === 'IrIdentifier') return { handle: arg.name };
      const path = filesDictPath(arg);
      if (path) return { path };
    }
  }
  if (
    value.kind === 'IrCallExpression' &&
    value.callee === 'readline' &&
    value.args.length === 1
  ) {
    const arg = value.args[0]!;
    if (arg.kind === 'IrIdentifier') return { handle: arg.name };
    const path = filesDictPath(arg);
    if (path) return { path };
  }
  return null;
}

/** `_pp_files[path]` → path expression */
function filesDictPath(expr: IrExpression): IrExpression | null {
  if (
    expr.kind === 'IrIndexExpression' &&
    expr.array.kind === 'IrIdentifier' &&
    expr.array.name === '_pp_files' &&
    expr.indices.length === 1
  ) {
    return expr.indices[0]!;
  }
  return null;
}

function rewriteEofExprs(
  stmt: IrStatement,
  handles: HandleMap,
): IrStatement {
  const walk = (e: IrExpression): IrExpression => {
    if (
      e.kind === 'IrCallExpression' &&
      e.callee === '_pp_eof' &&
      e.args.length === 1
    ) {
      const arg = e.args[0]!;
      if (arg.kind === 'IrIdentifier' && handles.has(arg.name)) {
        return {
          kind: 'IrEofExpression',
          fileName: handles.get(arg.name)!.path,
        };
      }
      return { kind: 'IrEofExpression', fileName: walk(arg) };
    }
    switch (e.kind) {
      case 'IrBinaryExpression':
        return { ...e, left: walk(e.left), right: walk(e.right) };
      case 'IrUnaryExpression':
        return { ...e, argument: walk(e.argument) };
      case 'IrCallExpression':
        return { ...e, args: e.args.map(walk) };
      case 'IrIndexExpression':
        return { ...e, array: walk(e.array), indices: e.indices.map(walk) };
      case 'IrMemberExpression':
        return { ...e, object: walk(e.object) };
      case 'IrGroupingExpression':
        return { ...e, expression: walk(e.expression) };
      case 'IrEofExpression':
        return { ...e, fileName: walk(e.fileName) };
      default:
        return e;
    }
  };

  switch (stmt.kind) {
    case 'IrAssignment':
      return { ...stmt, value: walk(stmt.value) };
    case 'IrOutput':
      return { ...stmt, values: stmt.values.map(walk) };
    case 'IrIfStatement':
      return {
        ...stmt,
        condition: walk(stmt.condition),
        elseIfClauses: stmt.elseIfClauses.map((c) => ({
          ...c,
          condition: walk(c.condition),
        })),
      };
    case 'IrWhileStatement':
    case 'IrRepeatStatement':
      return { ...stmt, condition: walk(stmt.condition) };
    case 'IrReturnStatement':
      return { ...stmt, value: walk(stmt.value) };
    case 'IrCallStatement':
      return { ...stmt, args: stmt.args.map(walk) };
    default:
      return stmt;
  }
}
