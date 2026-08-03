/**
 * @pseudopilot/language-service
 *
 * IDE language features over Cambridge 9618 AST + semantic checker.
 * Does not execute or translate. Consumes `@pseudopilot/compiler-service`
 * for incremental parse/check — no duplicate semantic analysis.
 */

export const PACKAGE_NAME = '@pseudopilot/language-service' as const;
export const PACKAGE_VERSION = '0.1.0' as const;

export {
  LanguageService,
  DocumentStore,
  analyzeDocument,
  hover,
  definition,
  references,
  documentSymbols,
  workspaceSymbols,
  prepareRename,
  rename,
  completion,
  signatureHelp,
  occurrenceAt,
  spanToRange,
  positionInSpan,
  offsetAt,
  positionAt,
  createCompilerSession,
} from './service.js';

export type {
  DocumentAnalysis,
  DocumentUri,
} from './analyze.js';

export type { LanguageServiceOptions } from './service.js';

export type {
  HoverInfo,
  DocumentSymbol,
  CompletionItem,
  SignatureHelp,
  TextEdit,
  RenameResult,
  PrepareRenameResult,
} from './features.js';

export type { LsPosition, LsRange, LsLocation } from './protocol.js';

export type { Occurrence, OccurrenceIndex, OccurrenceKind } from './index/occurrences.js';

export { CAMBRIDGE_KEYWORDS, isKeyword } from './keywords.js';
