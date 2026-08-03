/**
 * Document analysis: consumes {@link IncrementalCompiler} — no direct parse/check.
 */

import type { Program, Diagnostic } from '@pseudopilot/language-core';
import type {
  CheckResult,
  CheckerDiagnostic,
  SymbolInfo,
} from '@pseudopilot/checker';
import {
  IncrementalCompiler,
  type CompiledDocument,
  type DocumentUri,
} from '@pseudopilot/compiler-service';
import { buildOccurrenceIndex, type OccurrenceIndex } from './index/occurrences.js';

export type { DocumentUri };

export type DocumentAnalysis = {
  readonly uri: DocumentUri;
  readonly version: number;
  readonly source: string;
  /** Content fingerprint from compiler-service (length + FNV-1a). */
  readonly hash: string;
  readonly compiledAt: number;
  readonly ast: Program | null;
  readonly parseDiagnostics: readonly Diagnostic[];
  readonly checkResult: CheckResult | null;
  /** Merged parse + check diagnostics (errors/warnings). */
  readonly diagnostics: readonly CheckerDiagnostic[];
  readonly symbols: readonly SymbolInfo[];
  readonly occurrences: OccurrenceIndex;
};

type AnalysisEntry = {
  hash: string;
  version: number;
  source: string;
  analysis: DocumentAnalysis;
};

/**
 * Language service document store.
 * Delegates parse/check to {@link IncrementalCompiler}; caches occurrence index
 * until the compile source changes.
 */
export class DocumentStore {
  private readonly compiler: IncrementalCompiler;
  private readonly analyses = new Map<DocumentUri, AnalysisEntry>();
  private readonly ownsCompiler: boolean;

  constructor(compiler?: IncrementalCompiler) {
    this.ownsCompiler = !compiler;
    this.compiler = compiler ?? new IncrementalCompiler();
  }

  /** Shared incremental compiler (parse/check caches). */
  getCompiler(): IncrementalCompiler {
    return this.compiler;
  }

  open(uri: DocumentUri, source: string, version = 0): DocumentAnalysis {
    return this.update(uri, source, version);
  }

  update(uri: DocumentUri, source: string, version: number): DocumentAnalysis {
    const result = this.compiler.updateDocument(uri, source, version);
    return this.syncAnalysis(result.document);
  }

  get(uri: DocumentUri): DocumentAnalysis | undefined {
    const cached = this.analyses.get(uri);
    const doc = this.compiler.getDocument(uri);
    if (!doc) return undefined;
    if (
      cached &&
      cached.source === doc.source &&
      cached.version === doc.version &&
      this.compiler.isLanguageValid(uri)
    ) {
      return cached.analysis;
    }
    const result = this.compiler.compile(uri);
    return this.syncAnalysis(result.document);
  }

  close(uri: DocumentUri): void {
    this.compiler.closeDocument(uri);
    this.forget(uri);
  }

  /**
   * Drop language-layer cache for `uri` without closing the compiler document.
   * Used when {@link CompilerService} closes a shared compiler entry.
   */
  forget(uri: DocumentUri): void {
    this.analyses.delete(uri);
  }

  all(): readonly DocumentAnalysis[] {
    const out: DocumentAnalysis[] = [];
    for (const doc of this.compiler.allDocuments()) {
      out.push(this.syncAnalysis(doc));
    }
    return out;
  }

  clear(): void {
    if (this.ownsCompiler) {
      this.compiler.clear();
    }
    this.analyses.clear();
  }

  /** Test helper — whether an analysis shell is retained. */
  hasAnalysis(uri: DocumentUri): boolean {
    return this.analyses.has(uri);
  }

  private syncAnalysis(doc: CompiledDocument): DocumentAnalysis {
    const existing = this.analyses.get(doc.uri);
    if (
      existing &&
      existing.source === doc.source &&
      this.compiler.isLanguageValid(doc.uri)
    ) {
      if (existing.version === doc.version) {
        return existing.analysis;
      }
      const refreshed: DocumentAnalysis = {
        ...existing.analysis,
        version: doc.version,
        compiledAt: doc.compiledAt,
      };
      this.analyses.set(doc.uri, {
        hash: doc.hash,
        version: doc.version,
        source: doc.source,
        analysis: refreshed,
      });
      return refreshed;
    }

    const occurrences = buildOccurrenceIndex(
      doc.ast ?? { kind: 'Program', body: [], span: emptySpan() },
      doc.symbols,
    );
    const analysis: DocumentAnalysis = {
      uri: doc.uri,
      version: doc.version,
      source: doc.source,
      hash: doc.hash,
      compiledAt: doc.compiledAt,
      ast: doc.ast,
      parseDiagnostics: doc.parseDiagnostics,
      checkResult: doc.checkResult,
      diagnostics: doc.diagnostics,
      symbols: doc.symbols,
      occurrences,
    };
    this.analyses.set(doc.uri, {
      hash: doc.hash,
      version: doc.version,
      source: doc.source,
      analysis,
    });
    this.compiler.markLanguageValid(doc.uri);
    return analysis;
  }
}

/**
 * One-shot analysis (always cold compile — for tests / offline tools).
 * Prefer {@link DocumentStore} for IDE sessions.
 */
export function analyzeDocument(
  uri: DocumentUri,
  source: string,
  version = 0,
): DocumentAnalysis {
  const store = new DocumentStore();
  return store.open(uri, source, version);
}

function emptySpan() {
  const pos = { line: 1, column: 1, offset: 0 };
  return { start: pos, end: pos };
}
