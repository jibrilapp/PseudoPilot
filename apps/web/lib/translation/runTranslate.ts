import {
  translatePseudocodeToPython,
  type TranslateDiagnostic,
  type TranslateResult,
} from '@pseudopilot/translator';
import type { IdeDiagnostic } from './types';

export type SafeTranslateResult = {
  readonly ok: boolean;
  readonly code: string;
  readonly diagnostics: IdeDiagnostic[];
};

function toIdeDiagnostic(d: TranslateDiagnostic, index: number): IdeDiagnostic {
  return {
    id: `t-${index}-${d.code}`,
    severity: d.severity,
    message: d.message,
    code: d.code,
    line: d.span?.start.line,
    column: d.span?.start.column,
  };
}

/**
 * Thin, crash-safe adapter around `translatePseudocodeToPython`.
 * Never throws — unexpected failures become UI diagnostics.
 */
export function runPseudocodeToPython(source: string): SafeTranslateResult {
  try {
    const result: TranslateResult = translatePseudocodeToPython(source);
    return {
      ok: result.ok,
      code: result.code,
      diagnostics: result.diagnostics.map(toIdeDiagnostic),
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unexpected translation failure.';
    return {
      ok: false,
      code: '',
      diagnostics: [
        {
          id: 'ui-translate-crash',
          severity: 'error',
          message: `Translation crashed: ${message}`,
          code: 'UI_TRANSLATE_CRASH',
        },
      ],
    };
  }
}
