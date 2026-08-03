import type { Program, Diagnostic } from '@pseudopilot/language-core';
import type {
  CheckResult,
  CheckerDiagnostic,
  SymbolInfo,
} from '@pseudopilot/checker';
import type { DocumentUri } from './dependencies.js';
import type { StageFlags } from './stages.js';

export type { DocumentUri };

/** Per-stage work counters — used by tests and benchmarks. */
export type CompileStats = {
  /** Times parse() was invoked for this document. */
  parseRuns: number;
  /** Times check() was invoked for this document. */
  checkRuns: number;
  /** Times compile() returned a cache hit (no parse/check). */
  cacheHits: number;
  /** Times compile() ran at least one stage. */
  cacheMisses: number;
};

export type CompiledDocument = {
  readonly uri: DocumentUri;
  readonly version: number;
  readonly source: string;
/** FNV-1a fingerprint with length prefix — see {@link hashSource}. Not a sole cache key. */
  readonly hash: string;
  readonly compiledAt: number;
  readonly ast: Program | null;
  readonly parseDiagnostics: readonly Diagnostic[];
  readonly checkResult: CheckResult | null;
  /** Merged parse + check diagnostics. */
  readonly diagnostics: readonly CheckerDiagnostic[];
  readonly symbols: readonly SymbolInfo[];
  readonly stages: Readonly<StageFlags>;
  readonly stats: Readonly<CompileStats>;
};

/** Mutable internal entry — not exported from package root as a class. */
export type DocumentEntry = {
  uri: DocumentUri;
  version: number;
  source: string;
  hash: string;
  compiledAt: number;
  ast: Program | null;
  parseDiagnostics: Diagnostic[];
  checkResult: CheckResult | null;
  diagnostics: CheckerDiagnostic[];
  symbols: SymbolInfo[];
  stages: StageFlags;
  stats: CompileStats;
};

export function emptyStats(): CompileStats {
  return { parseRuns: 0, checkRuns: 0, cacheHits: 0, cacheMisses: 0 };
}

export function snapshot(entry: DocumentEntry): CompiledDocument {
  return {
    uri: entry.uri,
    version: entry.version,
    source: entry.source,
    hash: entry.hash,
    compiledAt: entry.compiledAt,
    // AST is shared read-only by contract (not cloned — too expensive).
    ast: entry.ast,
    parseDiagnostics: entry.parseDiagnostics.slice(),
    checkResult: entry.checkResult,
    diagnostics: entry.diagnostics.slice(),
    symbols: entry.symbols.slice(),
    stages: { ...entry.stages },
    stats: { ...entry.stats },
  };
}
