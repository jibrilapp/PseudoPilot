import type { SourceSpan } from '@pseudopilot/language-core';

export type TranslateDiagnostic = {
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly code: string;
  readonly span?: SourceSpan;
};

export type AssignmentArrow = 'unicode' | 'ascii';

export type TranslateOptions = {
  /** Cambridge assignment glyph when printing pseudocode. Default: unicode ← */
  readonly assignmentArrow?: AssignmentArrow;
  /**
   * Preserve line comments / blank lines as trivia on IR statements.
   * Default: true
   */
  readonly preserveTrivia?: boolean;
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
};

export function mergeOptions(
  options?: TranslateOptions,
): Required<TranslateOptions> {
  return {
    assignmentArrow: options?.assignmentArrow ?? DEFAULT_OPTIONS.assignmentArrow,
    preserveTrivia: options?.preserveTrivia ?? DEFAULT_OPTIONS.preserveTrivia,
  };
}
