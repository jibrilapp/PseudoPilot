/**
 * Keep LanguageService document versions monotonic across React remounts.
 * CompilerService ignores `version < current` (LSP stale-update rule).
 */

import type { LanguageService } from '@pseudopilot/language-service';

/**
 * Next document version strictly greater than both the local counter and the
 * analysis already stored for `uri` (if any).
 */
export function nextDocumentVersion(
  ls: LanguageService,
  uri: string,
  localVersion: number,
): number {
  const stored = ls.getAnalysis(uri)?.version ?? 0;
  return Math.max(localVersion, stored) + 1;
}
