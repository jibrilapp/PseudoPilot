/**
 * Cambridge file semantic checks (§9.1 text + §9.2 random).
 * Open-state tracking is best-effort for string-literal paths (control-flow insensitive).
 */
import type {
  Expression,
  FileMode,
  SourceSpan,
  Statement,
} from '@pseudopilot/language-core';
import type { CheckerDiagnostic, PpType } from '../types.js';

export type FileOpenState = {
  readonly mode: FileMode;
};

export type FileCheckHelpers = {
  readonly openFiles: Map<string, FileOpenState>;
  diag: (partial: {
    severity?: CheckerDiagnostic['severity'];
    code: string;
    message: string;
    span: SourceSpan;
    help?: string;
  }) => void;
  inferExpr: (expr: Expression) => PpType;
  checkAssignableTarget: (
    target: import('@pseudopilot/language-core').AssignTarget,
    span: SourceSpan,
    via: string,
  ) => PpType;
  formatType: (t: PpType) => string;
  isAssignable: (to: PpType, from: PpType) => boolean;
};

function isStringy(t: PpType): boolean {
  return t.kind === 'scalar' && (t.name === 'STRING' || t.name === 'CHAR');
}

function isIntegerType(t: PpType): boolean {
  return t.kind === 'scalar' && t.name === 'INTEGER';
}

function isRecordType(t: PpType): boolean {
  return t.kind === 'record';
}

/** Resolve a constant string path for open-state tracking; null if dynamic. */
export function literalFilePath(expr: Expression): string | null {
  if (expr.kind === 'StringLiteral') return expr.value;
  if (expr.kind === 'CharLiteral') return expr.value;
  return null;
}

function checkPathType(
  helpers: FileCheckHelpers,
  fileName: Expression,
  via: string,
): void {
  const pathType = helpers.inferExpr(fileName);
  if (!isStringy(pathType) && pathType.kind !== 'error') {
    helpers.diag({
      code: 'C_FILE_PATH_TYPE',
      message: `${via} path has type ${pathType.kind === 'scalar' ? pathType.name : pathType.kind}; expected STRING.`,
      span: fileName.span,
    });
  }
}

function requireOpenMode(
  helpers: FileCheckHelpers,
  path: string | null,
  span: SourceSpan,
  via: string,
  allowed: readonly FileMode[],
): FileOpenState | null {
  if (path === null) return null;
  const st = helpers.openFiles.get(path);
  if (!st) {
    helpers.diag({
      code: 'C_FILE_NOT_OPEN',
      message: `${via} '${path}' but the file is not open.`,
      span,
    });
    return null;
  }
  if (!allowed.includes(st.mode)) {
    const want =
      allowed.length === 1
        ? `OPENFILE FOR ${allowed[0]}`
        : `OPENFILE FOR ${allowed.join(' or ')}`;
    helpers.diag({
      code: 'C_FILE_MODE',
      message: `${via} '${path}' requires ${want} (open for ${st.mode}).`,
      span,
    });
  }
  return st;
}

export function checkFileStatement(
  helpers: FileCheckHelpers,
  stmt: Extract<
    Statement,
    | { kind: 'OpenFileStatement' }
    | { kind: 'ReadFileStatement' }
    | { kind: 'WriteFileStatement' }
    | { kind: 'CloseFileStatement' }
    | { kind: 'SeekStatement' }
    | { kind: 'GetRecordStatement' }
    | { kind: 'PutRecordStatement' }
  >,
): void {
  switch (stmt.kind) {
    case 'OpenFileStatement': {
      checkPathType(helpers, stmt.fileName, 'OPENFILE');
      const path = literalFilePath(stmt.fileName);
      if (path !== null) {
        if (helpers.openFiles.has(path)) {
          helpers.diag({
            code: 'C_FILE_ALREADY_OPEN',
            message: `File '${path}' is already open.`,
            span: stmt.span,
            help: 'CLOSEFILE before opening again.',
          });
        } else {
          helpers.openFiles.set(path, { mode: stmt.mode });
        }
      }
      return;
    }
    case 'ReadFileStatement': {
      const lhs = helpers.checkAssignableTarget(
        stmt.target,
        stmt.span,
        'READFILE',
      );
      // Cambridge READFILE yields a STRING line.
      if (
        lhs.kind !== 'error' &&
        !helpers.isAssignable(lhs, { kind: 'scalar', name: 'STRING' })
      ) {
        helpers.diag({
          code: 'C_ASSIGN_TYPE',
          message: `Cannot assign STRING from READFILE to ${helpers.formatType(lhs)}.`,
          span: stmt.span,
          help: 'READFILE targets must be STRING (or a STRING array element).',
        });
      }
      checkPathType(helpers, stmt.fileName, 'READFILE');
      requireOpenMode(helpers, literalFilePath(stmt.fileName), stmt.span, 'READFILE', [
        'READ',
      ]);
      return;
    }
    case 'WriteFileStatement': {
      checkPathType(helpers, stmt.fileName, 'WRITEFILE');
      // Values are formatted at runtime; any typed expression is accepted.
      helpers.inferExpr(stmt.value);
      requireOpenMode(
        helpers,
        literalFilePath(stmt.fileName),
        stmt.span,
        'WRITEFILE',
        ['WRITE', 'APPEND'],
      );
      return;
    }
    case 'CloseFileStatement': {
      checkPathType(helpers, stmt.fileName, 'CLOSEFILE');
      const path = literalFilePath(stmt.fileName);
      if (path !== null) {
        if (!helpers.openFiles.has(path)) {
          helpers.diag({
            code: 'C_FILE_NOT_OPEN',
            message: `CLOSEFILE '${path}' but the file is not open.`,
            span: stmt.span,
          });
        } else {
          helpers.openFiles.delete(path);
        }
      }
      return;
    }
    case 'SeekStatement': {
      checkPathType(helpers, stmt.fileName, 'SEEK');
      const addrType = helpers.inferExpr(stmt.address);
      if (!isIntegerType(addrType) && addrType.kind !== 'error') {
        helpers.diag({
          code: 'C_FILE_SEEK_TYPE',
          message: `SEEK address has type ${helpers.formatType(addrType)}; expected INTEGER.`,
          span: stmt.address.span,
          help: 'Cambridge §9.2: the address is an INTEGER record number (records from the start of the file).',
        });
      }
      requireOpenMode(helpers, literalFilePath(stmt.fileName), stmt.span, 'SEEK', [
        'RANDOM',
      ]);
      return;
    }
    case 'GetRecordStatement': {
      const lhs = helpers.checkAssignableTarget(
        stmt.target,
        stmt.span,
        'GETRECORD',
      );
      if (lhs.kind !== 'error' && !isRecordType(lhs)) {
        helpers.diag({
          code: 'C_FILE_RECORD_TYPE',
          message: `GETRECORD target has type ${helpers.formatType(lhs)}; expected a TYPE record.`,
          span: stmt.target.span,
          help: 'Cambridge §9.2: the variable must be of the appropriate record data type (usually a user-defined TYPE). CLASS objects are not records.',
        });
      }
      checkPathType(helpers, stmt.fileName, 'GETRECORD');
      requireOpenMode(
        helpers,
        literalFilePath(stmt.fileName),
        stmt.span,
        'GETRECORD',
        ['RANDOM'],
      );
      return;
    }
    case 'PutRecordStatement': {
      checkPathType(helpers, stmt.fileName, 'PUTRECORD');
      const valueType = helpers.inferExpr(stmt.value);
      if (valueType.kind !== 'error' && !isRecordType(valueType)) {
        helpers.diag({
          code: 'C_FILE_RECORD_TYPE',
          message: `PUTRECORD value has type ${helpers.formatType(valueType)}; expected a TYPE record.`,
          span: stmt.value.span,
          help: 'Cambridge §9.2: PUTRECORD writes a record value (usually a user-defined TYPE). CLASS objects are not records.',
        });
      }
      requireOpenMode(
        helpers,
        literalFilePath(stmt.fileName),
        stmt.span,
        'PUTRECORD',
        ['RANDOM'],
      );
      return;
    }
    default: {
      const _exhaustive: never = stmt;
      return _exhaustive;
    }
  }
}

export function checkEofExpression(
  helpers: Pick<FileCheckHelpers, 'diag' | 'inferExpr' | 'openFiles'>,
  fileName: Expression,
  span: SourceSpan,
): PpType {
  const pathType = helpers.inferExpr(fileName);
  if (!isStringy(pathType) && pathType.kind !== 'error') {
    helpers.diag({
      code: 'C_FILE_PATH_TYPE',
      message: `EOF() path has type ${pathType.kind === 'scalar' ? pathType.name : pathType.kind}; expected STRING.`,
      span: fileName.span,
    });
  }
  const path = literalFilePath(fileName);
  if (path !== null && !helpers.openFiles.has(path)) {
    helpers.diag({
      code: 'C_FILE_NOT_OPEN',
      message: `EOF('${path}') but the file is not open.`,
      span,
    });
  }
  return { kind: 'scalar', name: 'BOOLEAN' };
}
