import type { SourceSpan } from '@pseudopilot/language-core';

export type CheckerSeverity = 'error' | 'warning';

export type CheckerDiagnostic = {
  readonly severity: CheckerSeverity;
  readonly code: string;
  readonly message: string;
  readonly span: SourceSpan;
  /** Optional short remediation hint for IDE / docs. */
  readonly help?: string;
};

/** Scalar Cambridge types. */
export type ScalarTypeName = 'INTEGER' | 'REAL' | 'STRING' | 'BOOLEAN' | 'CHAR';

export type PpType =
  | { readonly kind: 'scalar'; readonly name: ScalarTypeName }
  | {
      readonly kind: 'array';
      readonly element: ScalarTypeName;
      readonly dimensions: number;
    }
  | {
      readonly kind: 'procedure';
      readonly params: readonly PpType[];
    }
  | {
      readonly kind: 'function';
      readonly params: readonly PpType[];
      readonly returns: ScalarTypeName;
    }
  | { readonly kind: 'error' };

export type SymbolKind =
  | 'variable'
  | 'constant'
  | 'parameter'
  | 'procedure'
  | 'function';

export type SymbolInfo = {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly type: PpType;
  readonly span: SourceSpan;
  /** True when introduced implicitly by FOR (no prior DECLARE). */
  readonly implicit?: boolean;
  /** True for Core builtins seeded into the global scope. */
  readonly builtin?: boolean;
  /**
   * Owning scope name: `'global'` or the PROCEDURE/FUNCTION name.
   * Used by the language service for hover / symbols / rename.
   */
  readonly containerName?: string;
};

/** Soft cap so live IDE translate cannot flood the UI / memory with diag objects. */
export const DEFAULT_MAX_CHECKER_DIAGNOSTICS = 256;

export type CheckOptions = {
  /**
   * Stop emitting further diagnostics after this many (still finishes the walk).
   * Default: {@link DEFAULT_MAX_CHECKER_DIAGNOSTICS}.
   */
  readonly maxDiagnostics?: number;
};

export type CheckResult = {
  /** False when any error-severity diagnostic was produced. */
  readonly ok: boolean;
  readonly diagnostics: CheckerDiagnostic[];
  /**
   * Global symbols after checking (best-effort even when ok is false).
   * Intended for interpreter / debugger / variables panel.
   * Map keys are **case-folded** (`identKey`); display casing is `SymbolInfo.name`.
   * Prefer `lookupSymbol(globalSymbols, name)` for lookups.
   */
  readonly globalSymbols: ReadonlyMap<string, SymbolInfo>;
  /**
   * Every binding created during the check (globals, locals, params, builtins).
   * Order is definition order. Language service consumes this — no second binder.
   */
  readonly symbols: readonly SymbolInfo[];
};
