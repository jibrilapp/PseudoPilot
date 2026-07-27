import type { SourceSpan } from '@pseudopilot/language-core';

export type TranslateDiagnostic = {
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly code: string;
  readonly span?: SourceSpan;
  /** Optional remediation hint (from checker `help`, etc.). */
  readonly help?: string;
};

export type AssignmentArrow = 'unicode' | 'ascii';

/** Default per-call source budget for live IDE / public API (characters). */
export const DEFAULT_MAX_SOURCE_CHARS = 256_000;

/** Hard ceiling — callers cannot raise `maxSourceChars` above this. */
export const ABSOLUTE_MAX_SOURCE_CHARS = 2_000_000;

export type TranslateOptions = {
  /** Cambridge assignment glyph when printing pseudocode. Default: unicode ← */
  readonly assignmentArrow?: AssignmentArrow;
  /**
   * Preserve line comments / blank lines as trivia on IR statements.
   * Default: true
   */
  readonly preserveTrivia?: boolean;
  /**
   * Reject sources longer than this many UTF-16 code units.
   * Default: {@link DEFAULT_MAX_SOURCE_CHARS}. Capped by {@link ABSOLUTE_MAX_SOURCE_CHARS}.
   */
  readonly maxSourceChars?: number;
  /**
   * Run `@pseudopilot/checker` after parse (scopes, types, undeclared names).
   * Default: true. Set false only for low-level IR experiments.
   */
  readonly semanticCheck?: boolean;
};

export type TranslateResult = {
  /** False when any error-severity diagnostic was produced. */
  readonly ok: boolean;
  /** Printed target source (may be partial if ok is false). */
  readonly code: string;
  readonly diagnostics: TranslateDiagnostic[];
};

export const DEFAULT_OPTIONS: Required<TranslateOptions> = {
  assignmentArrow: 'unicode',
  preserveTrivia: true,
  maxSourceChars: DEFAULT_MAX_SOURCE_CHARS,
  semanticCheck: true,
};

export function mergeOptions(
  options?: TranslateOptions,
): Required<TranslateOptions> {
  const requested =
    options?.maxSourceChars ?? DEFAULT_OPTIONS.maxSourceChars;
  const maxSourceChars = Math.min(
    Math.max(0, requested),
    ABSOLUTE_MAX_SOURCE_CHARS,
  );
  return {
    assignmentArrow: options?.assignmentArrow ?? DEFAULT_OPTIONS.assignmentArrow,
    preserveTrivia: options?.preserveTrivia ?? DEFAULT_OPTIONS.preserveTrivia,
    maxSourceChars,
    semanticCheck: options?.semanticCheck ?? DEFAULT_OPTIONS.semanticCheck,
  };
}

export function sourceTooLargeDiagnostic(
  sourceLength: number,
  maxSourceChars: number,
): TranslateDiagnostic {
  return {
    severity: 'error',
    code: 'T_SOURCE_TOO_LARGE',
    message: `Source is ${sourceLength} characters; limit is ${maxSourceChars}. Split the program or raise maxSourceChars (max ${ABSOLUTE_MAX_SOURCE_CHARS}).`,
  };
}
