/**
 * Cambridge Regression Suite — corpus entry types.
 *
 * On-disk fixtures live under `packages/conformance/corpus/<category>/<id>/`.
 * This module is the in-memory shape consumed by conformance tests.
 */

export const CORPUS_CATEGORIES = [
  'variables',
  'selection',
  'iteration',
  'arrays',
  'strings',
  'procedures',
  'functions',
  'byref',
  'records',
  'classes',
  'files',
  'random-files',
  'date',
  'algorithms',
  'past-papers',
  'edge-cases',
  'regressions',
] as const;

export type CorpusCategory = (typeof CORPUS_CATEGORIES)[number];

export type ExpectedDiagnostic = {
  readonly code: string;
  /** When omitted, only the diagnostic code is asserted. */
  readonly severity?: 'error' | 'warning' | 'info' | 'hint';
};

/**
 * How reverse (Python → Pseudocode) verification is handled for an entry.
 * Prefer `skip` with an explicit reason over weakening global assertions.
 */
export type ReverseMode = 'check' | 'skip';

export type CorpusEntry = {
  readonly id: string;
  readonly title: string;
  readonly category: CorpusCategory;
  readonly source: string;
  /** Expected console outputs when run with `inputs` (if runnable). */
  readonly expectOutput?: readonly string[];
  readonly inputs?: readonly string[];
  /**
   * Expected diagnostics after lex → parse → check (and optionally run).
   * Empty / omitted means a clean program (no error diagnostics from check).
   */
  readonly expectDiagnostics?: readonly ExpectedDiagnostic[];
  /** Gold Python translation; compared exactly (newline-normalized). */
  readonly expectPython?: string;
  /** Gold reverse Pseudocode; compared with {@link normalizePseudo} when present. */
  readonly expectReverse?: string;
  /** Skip interpreter (e.g. interactive-only edge, or non-runnable diagnostic fixture). */
  readonly skipRun?: boolean;
  /**
   * When false, the program is expected to fail parse and/or check.
   * Default true for runnable Cambridge programs.
   */
  readonly expectClean?: boolean;
  /**
   * Reverse translator policy.
   * @deprecated Prefer {@link reverse}; still honored by older tests.
   */
  readonly skipRoundTrip?: boolean;
  readonly reverse?: ReverseMode;
  readonly reverseSkipReason?: string;
  readonly tags: readonly string[];
  /** Free-form notes (licensing, cross-refs, web-only bugs). */
  readonly notes?: string;
  /** Absolute or package-relative path to the fixture directory. */
  readonly fixtureDir?: string;
};

export type CorpusMetaFile = {
  readonly title: string;
  readonly tags?: readonly string[];
  readonly inputs?: readonly string[];
  readonly expectOutput?: readonly string[];
  readonly expectDiagnostics?: readonly ExpectedDiagnostic[];
  readonly skipRun?: boolean;
  readonly expectClean?: boolean;
  readonly skipRoundTrip?: boolean;
  readonly reverse?: ReverseMode;
  readonly reverseSkipReason?: string;
  readonly notes?: string;
};
