/**
 * Incremental compiler — staged document cache between editor and frontend.
 *
 * Does not execute or translate. Reuses language-core parse + checker check.
 * Invalidates only the changed document (and its dependents via DependencyGraph).
 *
 * Cache identity is **full source text** (not hash alone). Hash is a fingerprint
 * for consumers; collisions cannot cause reuse of the wrong AST/diagnostics.
 *
 * AST / checker results are treated as **immutable** after publish. Callers must
 * not mutate returned `ast` graphs. Diagnostic/symbol arrays from getters are
 * shallow-copied so callers cannot corrupt the cache via `.push`.
 */

import { parse, type Diagnostic } from '@pseudopilot/language-core';
import {
  check,
  type CheckerDiagnostic,
} from '@pseudopilot/checker';
import { DependencyGraph, type DocumentUri } from './dependencies.js';
import {
  emptyStats,
  snapshot,
  type CompiledDocument,
  type DocumentEntry,
} from './document.js';
import { hashSource } from './hash.js';
import {
  freshStageFlags,
  invalidateFlags,
  type CompileStage,
} from './stages.js';

export type CompileOptions = {
  /** Force parse+check even when hash/version caches hit. */
  readonly force?: boolean;
  /**
   * Recompute only up through this stage (`parse` skips check when already valid).
   * Default: `check` (full frontend compile).
   */
  readonly upTo?: 'parse' | 'check';
};

export type CompileResult = {
  readonly document: CompiledDocument;
  /** True when neither parse nor check ran. */
  readonly cacheHit: boolean;
  readonly ranParse: boolean;
  readonly ranCheck: boolean;
  /** True when the update was ignored (stale editor version). */
  readonly ignored?: boolean;
};

/**
 * Multi-document incremental compilation cache.
 *
 * Concurrency note: this class is synchronous and not internally locked.
 * Hosts (LSP / worker) should serialize updates per URI or use one instance
 * per worker thread.
 */
export class IncrementalCompiler {
  private readonly docs = new Map<DocumentUri, DocumentEntry>();
  readonly dependencies = new DependencyGraph();

  openDocument(
    uri: DocumentUri,
    source: string,
    version = 0,
  ): CompileResult {
    return this.updateDocument(uri, source, version);
  }

  /**
   * Update source.
   * - Same text → reuse AST/semantics even if version changes.
   * - Different text → invalidate parse + downstream (and dependents).
   * - `version < current` → ignored (LSP stale-update rule); cache unchanged.
   *
   * Invalidation uses **source equality**, not hash alone (collision-safe).
   */
  updateDocument(
    uri: DocumentUri,
    source: string,
    version: number,
  ): CompileResult {
    const existing = this.docs.get(uri);

    if (!existing) {
      const hash = hashSource(source);
      const entry = createEntry(uri, source, version, hash);
      this.docs.set(uri, entry);
      return this.compile(uri, { force: true });
    }

    // LSP: ignore outdated versions so a delayed message cannot clobber newer state.
    if (version < existing.version) {
      const result = this.compile(uri);
      return { ...result, ignored: true };
    }

    const contentChanged = existing.source !== source;
    existing.version = version;

    if (contentChanged) {
      existing.source = source;
      existing.hash = hashSource(source);
      invalidateFlags(existing.stages, 'parse');
      clearSemanticOutputs(existing);
      for (const dep of this.dependencies.transitiveDependents(uri)) {
        const d = this.docs.get(dep);
        if (d) {
          invalidateFlags(d.stages, 'parse');
          clearSemanticOutputs(d);
        }
      }
    }

    return this.compile(uri);
  }

  closeDocument(uri: DocumentUri): void {
    this.docs.delete(uri);
    this.dependencies.remove(uri);
  }

  hasDocument(uri: DocumentUri): boolean {
    return this.docs.has(uri);
  }

  getDocument(uri: DocumentUri): CompiledDocument | undefined {
    const e = this.docs.get(uri);
    return e ? snapshot(e) : undefined;
  }

  allDocuments(): readonly CompiledDocument[] {
    return [...this.docs.values()].map(snapshot);
  }

  /**
   * Ensure stages are valid through `upTo` (default check).
   * Idempotent — warm / unchanged calls are cache hits.
   */
  compile(uri: DocumentUri, options: CompileOptions = {}): CompileResult {
    const entry = this.docs.get(uri);
    if (!entry) {
      throw new Error(`Document not open: ${uri}`);
    }

    const upTo = options.upTo ?? 'check';
    const force = options.force === true;

    if (force) {
      invalidateFlags(entry.stages, 'parse');
      clearSemanticOutputs(entry);
    }

    let ranParse = false;
    let ranCheck = false;

    const needParse = force || !entry.stages.parse;
    const needCheck =
      upTo === 'check' && (force || !entry.stages.check || needParse);

    if (!needParse && !needCheck) {
      entry.stats.cacheHits += 1;
      entry.compiledAt = Date.now();
      return {
        document: snapshot(entry),
        cacheHit: true,
        ranParse: false,
        ranCheck: false,
      };
    }

    entry.stats.cacheMisses += 1;

    if (needParse) {
      const parsed = parse(entry.source);
      entry.ast = parsed.ast;
      entry.parseDiagnostics = [...parsed.diagnostics];
      entry.stages.parse = true;
      entry.stages.check = false;
      entry.stages.language = false;
      entry.stages.translate = false;
      entry.stages.interpret = false;
      // Parse without check must not advertise previous semantics as current.
      clearSemanticOutputs(entry);
      entry.stats.parseRuns += 1;
      ranParse = true;
    }

    if (needCheck) {
      if (!entry.ast) {
        const parsed = parse(entry.source);
        entry.ast = parsed.ast;
        entry.parseDiagnostics = [...parsed.diagnostics];
        entry.stats.parseRuns += 1;
        ranParse = true;
        entry.stages.parse = true;
      }
      const checkResult = check(entry.ast);
      entry.checkResult = checkResult;
      entry.symbols = [...checkResult.symbols];
      entry.diagnostics = [
        ...entry.parseDiagnostics.map(mapParseDiag),
        ...checkResult.diagnostics,
      ];
      entry.stages.check = true;
      entry.stages.language = false;
      entry.stages.translate = false;
      entry.stages.interpret = false;
      entry.stats.checkRuns += 1;
      ranCheck = true;
    }

    entry.compiledAt = Date.now();
    return {
      document: snapshot(entry),
      cacheHit: false,
      ranParse,
      ranCheck,
    };
  }

  getDiagnostics(uri: DocumentUri): readonly CheckerDiagnostic[] {
    this.compile(uri);
    const d = this.docs.get(uri)?.diagnostics ?? [];
    return d.slice();
  }

  getSymbols(uri: DocumentUri) {
    this.compile(uri);
    const s = this.docs.get(uri)?.symbols ?? [];
    return s.slice();
  }

  /**
   * Cached AST for `uri` (parse stage).
   * **Immutable by contract** — do not mutate the returned graph; it is shared
   * with the cache for performance.
   */
  getAst(uri: DocumentUri) {
    this.compile(uri, { upTo: 'parse' });
    return this.docs.get(uri)?.ast ?? null;
  }

  /**
   * Explicitly invalidate stages for a document (and optionally dependents).
   * Does not remove the document.
   */
  invalidate(
    uri: DocumentUri,
    from: CompileStage = 'parse',
    options?: { readonly dependents?: boolean },
  ): void {
    const entry = this.docs.get(uri);
    if (entry) {
      invalidateFlags(entry.stages, from);
      if (from === 'source' || from === 'parse' || from === 'check') {
        clearSemanticOutputs(entry);
      }
    }
    if (options?.dependents !== false) {
      for (const dep of this.dependencies.transitiveDependents(uri)) {
        const d = this.docs.get(dep);
        if (d) {
          invalidateFlags(d.stages, from);
          if (from === 'source' || from === 'parse' || from === 'check') {
            clearSemanticOutputs(d);
          }
        }
      }
    }
  }

  /**
   * Mark language-layer cache as valid after the consumer rebuilt occurrences.
   * Does not run language-service logic here (keeps this package free of LS).
   */
  markLanguageValid(uri: DocumentUri): void {
    const entry = this.docs.get(uri);
    if (entry && entry.stages.check) {
      entry.stages.language = true;
    }
  }

  /** True when language stage is still valid for uri. */
  isLanguageValid(uri: DocumentUri): boolean {
    return this.docs.get(uri)?.stages.language === true;
  }

  /** Aggregate stats across all open documents (benchmarks). */
  totalStats(): {
    parseRuns: number;
    checkRuns: number;
    cacheHits: number;
    cacheMisses: number;
    documents: number;
  } {
    let parseRuns = 0;
    let checkRuns = 0;
    let cacheHits = 0;
    let cacheMisses = 0;
    for (const e of this.docs.values()) {
      parseRuns += e.stats.parseRuns;
      checkRuns += e.stats.checkRuns;
      cacheHits += e.stats.cacheHits;
      cacheMisses += e.stats.cacheMisses;
    }
    return {
      parseRuns,
      checkRuns,
      cacheHits,
      cacheMisses,
      documents: this.docs.size,
    };
  }

  clear(): void {
    this.docs.clear();
    this.dependencies.clear();
  }
}

function createEntry(
  uri: DocumentUri,
  source: string,
  version: number,
  hash: string,
): DocumentEntry {
  return {
    uri,
    version,
    source,
    hash,
    compiledAt: 0,
    ast: null,
    parseDiagnostics: [],
    checkResult: null,
    diagnostics: [],
    symbols: [],
    stages: freshStageFlags(false),
    stats: emptyStats(),
  };
}

/** Drop checker outputs so they cannot be read as current while check is dirty. */
function clearSemanticOutputs(entry: DocumentEntry): void {
  entry.checkResult = null;
  entry.diagnostics = [];
  entry.symbols = [];
}

function mapParseDiag(d: Diagnostic): CheckerDiagnostic {
  return {
    severity: d.severity === 'warning' ? 'warning' : 'error',
    code: d.code,
    message: d.message,
    span: d.span,
  };
}
