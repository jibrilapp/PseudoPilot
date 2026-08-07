/**
 * @pseudopilot/conformance
 *
 * Quality suite only — no language features, no semantics changes.
 */

export const PACKAGE_NAME = '@pseudopilot/conformance' as const;
export const PACKAGE_VERSION = '1.0.0-beta.0' as const;

export {
  CORPUS,
  CORPUS_CATEGORIES,
  cleanCorpus,
  corpusByCategory,
  corpusByTag,
  corpusIds,
  corpusRoot,
  corpusStats,
  diagnosticCorpus,
  loadCorpusFromDisk,
  type CorpusCategory,
  type CorpusEntry,
  type ExpectedDiagnostic,
  type ReverseMode,
} from './corpus/index.js';

export {
  parseOk,
  checkOk,
  runOk,
  translateBothWays,
  normalizePseudo,
} from './helpers.js';
