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
};

export type TranslationStatus = 'idle' | 'ok' | 'error';

export const TRANSLATE_DEBOUNCE_MS = 250;
