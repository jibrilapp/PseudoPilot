/**
 * Map language-service / checker diagnostics into IDE Problems rows.
 * Does not change compiler behaviour — only reads existing LS analysis.
 */

import type { CheckerDiagnostic } from '@pseudopilot/checker';
import {
  getIdeLanguageService,
  IDE_DOCUMENT_URI,
} from '@/lib/languageService';
import type { IdeDiagnostic } from '@/lib/translation/types';

export function checkerDiagnosticsToIde(
  diags: readonly CheckerDiagnostic[],
): IdeDiagnostic[] {
  return diags.map((d, i) => ({
    id: `compiler-${i}-${d.code}-${d.span.start.line}-${d.span.start.column}`,
    severity: d.severity === 'warning' ? 'warning' : 'error',
    code: d.code,
    message: d.message,
    line: d.span.start.line,
    column: d.span.start.column,
    ...(d.help != null ? { help: d.help } : {}),
  }));
}

/**
 * Ensure the IDE document matches `source`, then return checker diagnostics
 * (including `C_*` codes) for the Problems panel / status count.
 */
export function collectCompilerIdeDiagnostics(
  source: string,
): IdeDiagnostic[] {
  const ls = getIdeLanguageService();
  const analysis = ls.getAnalysis(IDE_DOCUMENT_URI);
  if (!analysis || analysis.source !== source) {
    ls.analyze(IDE_DOCUMENT_URI, source);
  } else {
    // Warm compile stages if needed without bumping unnecessarily.
    ls.compile(IDE_DOCUMENT_URI);
  }
  return checkerDiagnosticsToIde(ls.diagnostics(IDE_DOCUMENT_URI));
}
