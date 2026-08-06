/**
 * Monaco editor integration for the student IDE.
 *
 * Providers adapt `@pseudopilot/language-service` — no duplicate parse/check.
 * See docs/ide/MONACO.md.
 */

export {
  PSEUDOCODE_LANGUAGE_ID,
  PYTHON_LANGUAGE_ID,
  MONACO_FONT,
  LS_DIAGNOSTICS_DEBOUNCE_MS,
  monacoToLs,
  lsPosToMonaco,
  lsRangeToMonaco,
} from './protocol';

export { ensurePseudocodeLanguage } from './registerPseudocode';
export {
  registerLanguageProviders,
  acquireLanguageProviders,
  resetLanguageProvidersForTests,
} from './providers';
export {
  mergeEditorDecorations,
  breakpointDecorations,
  activeLineDecoration,
} from './decorations';
export {
  diagnosticsToMarkers,
  ideDiagnosticsToMarkers,
  mapCompletions,
  mapSignatureHelp,
  hoverToMarkdown,
  MARKER_SEVERITY_ERROR,
  MARKER_SEVERITY_WARNING,
  type MarkerDiagnostic,
  type MonacoMarkerData,
} from './mapProviders';
export { createGenerationDebouncer } from './debounce';
export { nextDocumentVersion } from './documentSync';
export { applyExternalModelText } from './applyExternalText';
