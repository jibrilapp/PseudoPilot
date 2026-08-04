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
export type ScalarTypeName =
  | 'INTEGER'
  | 'REAL'
  | 'STRING'
  | 'BOOLEAN'
  | 'CHAR'
  | 'DATE';

export type RecordFieldInfo = {
  readonly name: string;
  readonly type: PpType;
  readonly span: SourceSpan;
};

export type ClassFieldInfo = {
  readonly name: string;
  readonly type: PpType;
  readonly visibility: 'PUBLIC' | 'PRIVATE';
  readonly span: SourceSpan;
};

export type ClassMethodInfo = {
  readonly name: string;
  readonly kind: 'procedure' | 'function';
  readonly visibility: 'PUBLIC' | 'PRIVATE';
  readonly params: readonly PpType[];
  /** null for procedures. */
  readonly returns: PpType | null;
  readonly span: SourceSpan;
  readonly isConstructor: boolean;
};

export type PpType =
  | { readonly kind: 'scalar'; readonly name: ScalarTypeName }
  | {
      readonly kind: 'array';
      /** Element type: scalar or record (not nested array). */
      readonly element: PpType;
      readonly dimensions: number;
    }
  | {
      readonly kind: 'record';
      /** Display name from TYPE declaration. */
      readonly name: string;
      readonly fields: readonly RecordFieldInfo[];
    }
  | {
      readonly kind: 'class';
      /** Display name from CLASS declaration. */
      readonly name: string;
      /** Parent class display name, or null when no INHERITS clause. */
      readonly inherits: string | null;
      /** Own fields only (not inherited). */
      readonly fields: readonly ClassFieldInfo[];
      /** Own methods only (not inherited). */
      readonly methods: readonly ClassMethodInfo[];
    }
  | {
      readonly kind: 'procedure';
      readonly params: readonly PpType[];
    }
  | {
      readonly kind: 'function';
      readonly params: readonly PpType[];
      readonly returns: PpType;
    }
  | { readonly kind: 'error' };

export type SymbolKind =
  | 'variable'
  | 'constant'
  | 'parameter'
  | 'procedure'
  | 'function'
  | 'type'
  | 'field'
  | 'class'
  | 'method';

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
   * Owning scope name: `'global'`, PROCEDURE/FUNCTION name, or TYPE name for fields.
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
