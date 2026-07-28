/**
 * Cambridge text-file semantic checks (OPENFILE / READFILE / WRITEFILE / CLOSEFILE / EOF).
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

/** Resolve a constant string path for open-state tracking; null if dynamic. */
export function literalFilePath(expr: Expression): string | null {
  if (expr.kind === 'StringLiteral') return expr.value;
  if (expr.kind === 'CharLiteral') return expr.value;
  return null;
}

export function checkFileStatement(
  helpers: FileCheckHelpers,
  stmt: Extract<
    Statement,
    | { kind: 'OpenFileStatement' }
    | { kind: 'ReadFileStatement' }
    | { kind: 'WriteFileStatement' }
    | { kind: 'CloseFileStatement' }
  >,
): void {
  switch (stmt.kind) {
    case 'OpenFileStatement': {
      const pathType = helpers.inferExpr(stmt.fileName);
      if (!isStringy(pathType) && pathType.kind !== 'error') {
        helpers.diag({
          code: 'C_FILE_PATH_TYPE',
          message: `OPENFILE path has type ${pathType.kind === 'scalar' ? pathType.name : pathType.kind}; expected STRING.`,
          span: stmt.fileName.span,
        });
      }
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
      const pathType = helpers.inferExpr(stmt.fileName);
      if (!isStringy(pathType) && pathType.kind !== 'error') {
        helpers.diag({
          code: 'C_FILE_PATH_TYPE',
          message: `READFILE path has type ${pathType.kind === 'scalar' ? pathType.name : pathType.kind}; expected STRING.`,
          span: stmt.fileName.span,
        });
      }
      const path = literalFilePath(stmt.fileName);
      if (path !== null) {
        const st = helpers.openFiles.get(path);
        if (!st) {
          helpers.diag({
            code: 'C_FILE_NOT_OPEN',
            message: `READFILE '${path}' but the file is not open.`,
            span: stmt.span,
          });
        } else if (st.mode !== 'READ') {
          helpers.diag({
            code: 'C_FILE_MODE',
            message: `READFILE '${path}' requires OPENFILE FOR READ (open for ${st.mode}).`,
            span: stmt.span,
          });
        }
      }
      return;
    }
    case 'WriteFileStatement': {
      const pathType = helpers.inferExpr(stmt.fileName);
      if (!isStringy(pathType) && pathType.kind !== 'error') {
        helpers.diag({
          code: 'C_FILE_PATH_TYPE',
          message: `WRITEFILE path has type ${pathType.kind === 'scalar' ? pathType.name : pathType.kind}; expected STRING.`,
          span: stmt.fileName.span,
        });
      }
      // Values are formatted at runtime; any typed expression is accepted.
      helpers.inferExpr(stmt.value);
      const path = literalFilePath(stmt.fileName);
      if (path !== null) {
        const st = helpers.openFiles.get(path);
        if (!st) {
          helpers.diag({
            code: 'C_FILE_NOT_OPEN',
            message: `WRITEFILE '${path}' but the file is not open.`,
            span: stmt.span,
          });
        } else if (st.mode === 'READ') {
          helpers.diag({
            code: 'C_FILE_MODE',
            message: `WRITEFILE '${path}' requires OPENFILE FOR WRITE or APPEND.`,
            span: stmt.span,
          });
        }
      }
      return;
    }
    case 'CloseFileStatement': {
      const pathType = helpers.inferExpr(stmt.fileName);
      if (!isStringy(pathType) && pathType.kind !== 'error') {
        helpers.diag({
          code: 'C_FILE_PATH_TYPE',
          message: `CLOSEFILE path has type ${pathType.kind === 'scalar' ? pathType.name : pathType.kind}; expected STRING.`,
          span: stmt.fileName.span,
        });
      }
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
