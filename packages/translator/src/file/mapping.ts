/**
 * Cambridge ↔ Python file I/O mapping.
 *
 * Forward emission (string-literal paths):
 *   OPENFILE "f.txt" FOR READ
 *   → _f_f_txt = open("f.txt", "r", encoding="utf-8")
 *
 * Dynamic paths use `_pp_files[path] = open(path, …)`.
 *
 * Random files (Cambridge §9.2) use an in-memory store + helpers:
 *   OPENFILE "f.dat" FOR RANDOM
 *   → _f_f_dat = _pp_random_open("f.dat")
 *   SEEK / GETRECORD / PUTRECORD → _pp_random_seek / get / put
 *
 * EOF uses tell/read(1)/seek via `_pp_eof(handle)`.
 */
import type { IrExpression, IrProgram, IrStatement } from '../ir/nodes.js';

export const PP_FILES_INIT = '_pp_files = dict()';

export const PP_RANDOM_FILES_INIT = '_pp_random_files = dict()';

export const PP_EOF_HELPER = [
  'def _pp_eof(f):',
  '    pos = f.tell()',
  '    ch = f.read(1)',
  '    if ch == "":',
  '        return True',
  '    f.seek(pos)',
  '    return False',
].join('\n');

/** In-memory RANDOM file helpers (teaching mapping; not OS binary files). */
export const PP_RANDOM_HELPERS = [
  'def _pp_random_open(path):',
  '    if path not in _pp_random_files:',
  '        _pp_random_files[path] = [dict(), 0]',
  '    return _pp_random_files[path]',
  '',
  'def _pp_random_seek(f, n):',
  '    f[1] = n',
  '',
  'def _pp_random_get(f):',
  '    return copy.deepcopy(f[0][f[1]])',
  '',
  'def _pp_random_put(f, rec):',
  '    f[0][f[1]] = copy.deepcopy(rec)',
  '',
  'def _pp_random_close(f):',
  '    pass',
].join('\n');

export function pythonMode(mode: 'READ' | 'WRITE' | 'APPEND'): string {
  if (mode === 'READ') return 'r';
  if (mode === 'WRITE') return 'w';
  return 'a';
}

export function cambridgeModeFromPython(
  mode: string,
): 'READ' | 'WRITE' | 'APPEND' | null {
  if (mode === 'r' || mode === 'rt') return 'READ';
  if (mode === 'w' || mode === 'wt') return 'WRITE';
  if (mode === 'a' || mode === 'at') return 'APPEND';
  return null;
}

/** Stable Python identifier for a literal Cambridge file path. */
export function fileHandleName(path: string): string {
  const sanitized = path.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  const body = sanitized.length > 0 ? sanitized : 'file';
  const start = /^[a-zA-Z]/.test(body) ? body : `f_${body}`;
  return `_f_${start}`;
}

export function programUsesFiles(program: IrProgram): boolean {
  return statementsUseFiles(program.body);
}

export function programUsesRandomFiles(program: IrProgram): boolean {
  return statementsUseRandomFiles(program.body);
}

export function programUsesEof(program: IrProgram): boolean {
  return statementsUseEof(program.body);
}

function statementsUseEof(stmts: readonly IrStatement[]): boolean {
  for (const stmt of stmts) {
    if (stmtHasEof(stmt)) return true;
    if (stmt.kind === 'IrIfStatement') {
      if (statementsUseEof(stmt.consequent)) return true;
      for (const c of stmt.elseIfClauses) {
        if (statementsUseEof(c.consequent)) return true;
      }
      if (stmt.alternate && statementsUseEof(stmt.alternate)) return true;
    } else if (
      stmt.kind === 'IrWhileStatement' ||
      stmt.kind === 'IrRepeatStatement' ||
      stmt.kind === 'IrForStatement'
    ) {
      if (statementsUseEof(stmt.body)) return true;
    } else if (stmt.kind === 'IrCaseStatement') {
      for (const arm of stmt.arms) {
        if (statementsUseEof(arm.body)) return true;
      }
      if (stmt.otherwise && statementsUseEof(stmt.otherwise)) return true;
    } else if (
      stmt.kind === 'IrProcedureDeclaration' ||
      stmt.kind === 'IrFunctionDeclaration'
    ) {
      if (statementsUseEof(stmt.body)) return true;
    }
  }
  return false;
}

function statementsUseFiles(stmts: readonly IrStatement[]): boolean {
  for (const stmt of stmts) {
    if (
      stmt.kind === 'IrOpenFileStatement' ||
      stmt.kind === 'IrReadFileStatement' ||
      stmt.kind === 'IrWriteFileStatement' ||
      stmt.kind === 'IrCloseFileStatement' ||
      stmt.kind === 'IrSeekStatement' ||
      stmt.kind === 'IrGetRecordStatement' ||
      stmt.kind === 'IrPutRecordStatement'
    ) {
      return true;
    }
    if (stmt.kind === 'IrIfStatement') {
      if (statementsUseFiles(stmt.consequent)) return true;
      for (const c of stmt.elseIfClauses) {
        if (statementsUseFiles(c.consequent)) return true;
      }
      if (stmt.alternate && statementsUseFiles(stmt.alternate)) return true;
    } else if (
      stmt.kind === 'IrWhileStatement' ||
      stmt.kind === 'IrRepeatStatement' ||
      stmt.kind === 'IrForStatement'
    ) {
      if (statementsUseFiles(stmt.body)) return true;
    } else if (stmt.kind === 'IrCaseStatement') {
      for (const arm of stmt.arms) {
        if (statementsUseFiles(arm.body)) return true;
      }
      if (stmt.otherwise && statementsUseFiles(stmt.otherwise)) return true;
    } else if (
      stmt.kind === 'IrProcedureDeclaration' ||
      stmt.kind === 'IrFunctionDeclaration'
    ) {
      if (statementsUseFiles(stmt.body)) return true;
    }
    if (stmtHasEof(stmt)) return true;
  }
  return false;
}

function statementsUseRandomFiles(stmts: readonly IrStatement[]): boolean {
  for (const stmt of stmts) {
    if (
      stmt.kind === 'IrSeekStatement' ||
      stmt.kind === 'IrGetRecordStatement' ||
      stmt.kind === 'IrPutRecordStatement' ||
      (stmt.kind === 'IrOpenFileStatement' && stmt.mode === 'RANDOM')
    ) {
      return true;
    }
    if (stmt.kind === 'IrIfStatement') {
      if (statementsUseRandomFiles(stmt.consequent)) return true;
      for (const c of stmt.elseIfClauses) {
        if (statementsUseRandomFiles(c.consequent)) return true;
      }
      if (stmt.alternate && statementsUseRandomFiles(stmt.alternate)) return true;
    } else if (
      stmt.kind === 'IrWhileStatement' ||
      stmt.kind === 'IrRepeatStatement' ||
      stmt.kind === 'IrForStatement'
    ) {
      if (statementsUseRandomFiles(stmt.body)) return true;
    } else if (stmt.kind === 'IrCaseStatement') {
      for (const arm of stmt.arms) {
        if (statementsUseRandomFiles(arm.body)) return true;
      }
      if (stmt.otherwise && statementsUseRandomFiles(stmt.otherwise)) {
        return true;
      }
    } else if (
      stmt.kind === 'IrProcedureDeclaration' ||
      stmt.kind === 'IrFunctionDeclaration'
    ) {
      if (statementsUseRandomFiles(stmt.body)) return true;
    }
  }
  return false;
}

function stmtHasEof(stmt: IrStatement): boolean {
  const walk = (e: IrExpression | null | undefined): boolean => {
    if (!e) return false;
    switch (e.kind) {
      case 'IrEofExpression':
        return true;
      case 'IrBinaryExpression':
        return walk(e.left) || walk(e.right);
      case 'IrUnaryExpression':
        return walk(e.argument);
      case 'IrCallExpression':
        return e.args.some(walk);
      case 'IrIndexExpression':
        return e.indices.some(walk);
      case 'IrGroupingExpression':
        return walk(e.expression);
      default:
        return false;
    }
  };

  switch (stmt.kind) {
    case 'IrAssignment':
      return walk(stmt.value);
    case 'IrOutput':
      return stmt.values.some(walk);
    case 'IrIfStatement':
      return (
        walk(stmt.condition) ||
        stmt.elseIfClauses.some((c) => walk(c.condition))
      );
    case 'IrWhileStatement':
    case 'IrRepeatStatement':
      return walk(stmt.condition);
    case 'IrReturnStatement':
      return walk(stmt.value);
    case 'IrCallStatement':
      return stmt.args.some(walk);
    case 'IrOpenFileStatement':
    case 'IrReadFileStatement':
    case 'IrCloseFileStatement':
    case 'IrSeekStatement':
    case 'IrGetRecordStatement':
      return walk(stmt.fileName);
    case 'IrWriteFileStatement':
    case 'IrPutRecordStatement':
      return walk(stmt.fileName) || walk(stmt.value);
    default:
      return false;
  }
}
