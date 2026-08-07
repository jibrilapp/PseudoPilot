/**
 * UI-facing translation types (IDE layer).
 * Keeps the web app decoupled from translator internals beyond the public API.
 */

export type IdeDiagnostic = {
  readonly id: string;
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly code: string;
  readonly line?: number;
  readonly column?: number;
  /** Optional remediation hint from the compiler. */
  readonly help?: string;
};

export type TranslationStatus = 'idle' | 'pending' | 'ok' | 'error';

export const TRANSLATE_DEBOUNCE_MS = 250;

/** Longer debounce once past this size — protects slow laptops during live translate. */
export const TRANSLATE_LARGE_SOURCE_CHARS = 32_000;
export const TRANSLATE_LARGE_DEBOUNCE_MS = 500;
