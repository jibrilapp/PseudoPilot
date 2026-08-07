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
  /** Parallel to `params` (Cambridge §8.3). */
  readonly paramModes?: readonly ('BYVAL' | 'BYREF')[];
  /** null for procedures. */
  readonly returns: PpType | null;
  readonly span: SourceSpan;
  readonly isConstructor: boolean;
};

/** Inclusive ARRAY dimension bounds when both ends are integer literals. */
export type ArrayBound = {
  readonly lower: number;
  readonly upper: number;
};

export type PpType =
  | { readonly kind: 'scalar'; readonly name: ScalarTypeName }
  | {
      readonly kind: 'array';
      /** Element type: scalar or record (not nested array). */
      readonly element: PpType;
      readonly dimensions: number;
      /**
       * Present when every dimension bound is an integer literal.
       * Used for whole-array assignability (matching lowers/uppers).
       */
      readonly bounds?: readonly ArrayBound[];
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
      readonly kind: 'enum';
      /** Display name from TYPE declaration. */
      readonly name: string;
      /** Display member names in declaration order. */
      readonly members: readonly string[];
    }
  | {
      readonly kind: 'pointer';
      /**
       * Display name from TYPE declaration, or `''` for an anonymous
       * address-of (`^place`) result used only during assignability checks.
       */
      readonly name: string;
      readonly target: PpType;
    }
  | {
      readonly kind: 'set';
      /** Display name from TYPE declaration. */
      readonly name: string;
      readonly element: PpType;
    }
  | {
      readonly kind: 'procedure';
      readonly params: readonly PpType[];
      /** Parallel to `params`; default all BYVAL when omitted (legacy). */
      readonly paramModes?: readonly ('BYVAL' | 'BYREF')[];
    }
  | {
      readonly kind: 'function';
      readonly params: readonly PpType[];
      readonly paramModes?: readonly ('BYVAL' | 'BYREF')[];
      readonly returns: PpType;
    }
  | { readonly kind: 'error' };

/**
 * Checker-level default for a declared variable (interpreter may mirror).
 * Pointers use an explicit nil sentinel — Cambridge pointers may be uninitialized.
 */
export type TypeDefaultHint =
  | { readonly kind: 'enumFirst'; readonly member: string }
  | { readonly kind: 'pointerNil' }
  | { readonly kind: 'emptySet' };

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

/**
 * Max nested compound statements (IF/WHILE/REPEAT/FOR/CASE) during check.
 * Aligns with parser {@link DEFAULT_MAX_BLOCK_NESTING} to avoid stack overflows.
 */
export const DEFAULT_MAX_STATEMENT_NESTING = 512;

export const C_NESTING_TOO_DEEP = 'C_NESTING_TOO_DEEP' as const;

export type CheckOptions = {
  /**
   * Stop emitting further diagnostics after this many (still finishes the walk).
   * Default: {@link DEFAULT_MAX_CHECKER_DIAGNOSTICS}.
   */
  readonly maxDiagnostics?: number;
  /**
   * Max nested compound-statement depth.
   * Default: {@link DEFAULT_MAX_STATEMENT_NESTING}.
   */
  readonly maxStatementNesting?: number;
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
