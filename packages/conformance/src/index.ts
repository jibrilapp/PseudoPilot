/**
 * @pseudopilot/conformance
 *
 * Quality suite only — no language features, no semantics changes.
 */

export const PACKAGE_NAME = '@pseudopilot/conformance' as const;
export const PACKAGE_VERSION = '0.1.0' as const;

export {
  CORPUS,
  corpusByTag,
  corpusIds,
  type CorpusEntry,
} from './corpus/index.js';

export {
  parseOk,
  checkOk,
  runOk,
  translateBothWays,
  normalizePseudo,
} from './helpers.js';
