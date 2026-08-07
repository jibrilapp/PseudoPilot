/**
 * Growing Cambridge 9618–style corpus — Cambridge Regression Suite.
 *
 * Authoritative fixtures: `packages/conformance/corpus/<category>/<id>/`
 * Loaded at runtime; this module is the public API for tests and consumers.
 */

import { loadCorpusFromDisk, corpusStats, corpusRoot } from './load.js';
import {
  CORPUS_CATEGORIES,
  type CorpusCategory,
  type CorpusEntry,
  type ExpectedDiagnostic,
  type ReverseMode,
} from './types.js';

export {
  CORPUS_CATEGORIES,
  corpusRoot,
  corpusStats,
  loadCorpusFromDisk,
  type CorpusCategory,
  type CorpusEntry,
  type ExpectedDiagnostic,
  type ReverseMode,
};

/** All on-disk Cambridge Regression Suite entries (sorted by category then id). */
export const CORPUS: readonly CorpusEntry[] = loadCorpusFromDisk();

export function corpusByTag(tag: string): readonly CorpusEntry[] {
  return CORPUS.filter((e) => e.tags.includes(tag));
}

export function corpusByCategory(category: CorpusCategory): readonly CorpusEntry[] {
  return CORPUS.filter((e) => e.category === category);
}

export function corpusIds(): readonly string[] {
  return CORPUS.map((e) => e.id);
}

/** Entries expected to parse + check cleanly. */
export function cleanCorpus(): readonly CorpusEntry[] {
  return CORPUS.filter((e) => e.expectClean !== false);
}

/** Entries that assert specific failure diagnostics. */
export function diagnosticCorpus(): readonly CorpusEntry[] {
  return CORPUS.filter((e) => e.expectClean === false);
}
