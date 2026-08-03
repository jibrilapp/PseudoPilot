/**
 * Compilation pipeline stages (coarsest → finest invalidation).
 *
 * source → parse (AST) → check (semantics) → consumers (LS / translate / interpret)
 *
 * Invalidating a stage also invalidates all downstream stages.
 */

export type CompileStage =
  | 'source'
  | 'parse'
  | 'check'
  | 'language'
  | 'translate'
  | 'interpret';

/** Downstream stages invalidated when `stage` changes. */
export const STAGE_ORDER: readonly CompileStage[] = [
  'source',
  'parse',
  'check',
  'language',
  'translate',
  'interpret',
] as const;

export function stagesFrom(stage: CompileStage): readonly CompileStage[] {
  const i = STAGE_ORDER.indexOf(stage);
  if (i < 0) return STAGE_ORDER;
  return STAGE_ORDER.slice(i);
}

export type StageFlags = {
  /** AST + parse diagnostics are valid for current hash. */
  parse: boolean;
  /** Checker symbols + check diagnostics are valid. */
  check: boolean;
  /**
   * Language-service occurrence index / feature inputs are valid.
   * Owned by language-service consumers; compiler marks dirty so they rebuild.
   */
  language: boolean;
  /** Reserved — translator may cache IR keyed off this document. */
  translate: boolean;
  /** Reserved — interpreter may cache prepared programs. */
  interpret: boolean;
};

export function freshStageFlags(valid = false): StageFlags {
  return {
    parse: valid,
    check: valid,
    language: valid,
    translate: valid,
    interpret: valid,
  };
}

/** Mark `from` and all downstream stages invalid. */
export function invalidateFlags(flags: StageFlags, from: CompileStage): void {
  for (const s of stagesFrom(from)) {
    if (s === 'source') continue;
    flags[s] = false;
  }
}
