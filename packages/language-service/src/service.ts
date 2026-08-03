/**
 * PseudoPilot Language Service — IDE features over cached compiler outputs.
 *
 * Does **not** execute or translate code.
 * Parse/check run only via {@link IncrementalCompiler} (@pseudopilot/compiler-service).
 * Designed so a future LSP / Monaco / VS Code adapter is a thin protocol layer.
 */

import {
  CompilerService,
  IncrementalCompiler,
  type CompiledDocument,
  type LanguageFeatureProvider,
} from '@pseudopilot/compiler-service';
import {
  DocumentStore,
  analyzeDocument,
  type DocumentAnalysis,
  type DocumentUri,
} from './analyze.js';
import {
  completion,
  definition,
  documentSymbols,
  hover,
  occurrenceAt,
  prepareRename,
  references,
  rename,
  signatureHelp,
  workspaceSymbols,
  type CompletionItem,
  type DocumentSymbol,
  type HoverInfo,
  type PrepareRenameResult,
  type RenameResult,
  type SignatureHelp,
  type TextEdit,
} from './features.js';
import type { LsLocation, LsPosition } from './protocol.js';
import type { CheckerDiagnostic } from '@pseudopilot/checker';

export type LanguageServiceOptions = {
  /** Share an incremental compiler across IDE + future translate/interpret. */
  readonly compiler?: IncrementalCompiler;
};

export class LanguageService {
  private readonly store: DocumentStore;
  /** Position-keyed feature memo — cleared when document source changes. */
  private readonly hoverCache = new Map<string, HoverInfo | null>();
  private readonly completionCache = new Map<string, CompletionItem[]>();
  /** Last source text used for feature memos (collision-safe invalidation). */
  private readonly featureSource = new Map<DocumentUri, string>();

  constructor(options: LanguageServiceOptions = {}) {
    this.store = new DocumentStore(options.compiler);
  }

  /** Underlying staged compiler (parse/check caches). */
  getCompiler(): IncrementalCompiler {
    return this.store.getCompiler();
  }

  /** @internal test helper */
  hasAnalysis(uri: DocumentUri): boolean {
    return this.store.hasAnalysis(uri);
  }

  /**
   * Bind this service as the IDE feature provider on a {@link CompilerService}.
   * Enables `compilerService.getHover(...)` without a package cycle at runtime
   * (language-service → compiler-service; provider wired from the host).
   */
  attachToCompilerService(cs: CompilerService): void {
    cs.setFeatureProvider(this.createFeatureProvider());
  }

  createFeatureProvider(): LanguageFeatureProvider {
    return {
      onCompiled: (doc: CompiledDocument) => {
        const prev = this.featureSource.get(doc.uri);
        if (prev !== undefined && prev !== doc.source) {
          this.clearFeatureCaches(doc.uri);
        }
        this.featureSource.set(doc.uri, doc.source);
        this.store.get(doc.uri);
      },
      onClosed: (uri) => {
        this.store.forget(uri);
        this.clearFeatureCaches(uri);
        this.featureSource.delete(uri);
      },
      getHover: (uri, position) => this.hover(uri, position),
      getCompletion: (uri, position) => this.completion(uri, position),
      getDefinition: (uri, position) => this.definition(uri, position),
      getReferences: (uri, position) => this.references(uri, position),
    };
  }

  openDocument(uri: DocumentUri, source: string, version = 0): DocumentAnalysis {
    this.clearFeatureCaches(uri);
    const analysis = this.store.open(uri, source, version);
    this.featureSource.set(uri, analysis.source);
    return analysis;
  }

  updateDocument(
    uri: DocumentUri,
    source: string,
    version: number,
  ): DocumentAnalysis {
    const beforeSource = this.featureSource.get(uri);
    const analysis = this.store.update(uri, source, version);
    if (beforeSource !== analysis.source) {
      this.clearFeatureCaches(uri);
    }
    this.featureSource.set(uri, analysis.source);
    return analysis;
  }

  closeDocument(uri: DocumentUri): void {
    this.store.close(uri);
    this.clearFeatureCaches(uri);
    this.featureSource.delete(uri);
  }

  /** Force re-analysis (bumps version; same content still cache-hits parse/check). */
  analyze(uri: DocumentUri, source: string, version?: number): DocumentAnalysis {
    const v = version ?? (this.store.get(uri)?.version ?? 0) + 1;
    return this.updateDocument(uri, source, v);
  }

  /** Ensure compile stages are warm; returns cached analysis. */
  compile(uri: DocumentUri): DocumentAnalysis | undefined {
    const c = this.store.getCompiler();
    if (!c.hasDocument(uri)) return undefined;
    c.compile(uri);
    return this.store.get(uri);
  }

  getAnalysis(uri: DocumentUri): DocumentAnalysis | undefined {
    return this.store.get(uri);
  }

  diagnostics(uri: DocumentUri): readonly CheckerDiagnostic[] {
    return this.store.get(uri)?.diagnostics ?? [];
  }

  getSymbols(uri: DocumentUri) {
    return this.store.get(uri)?.symbols ?? [];
  }

  hover(uri: DocumentUri, position: LsPosition): HoverInfo | null {
    const a = this.store.get(uri);
    if (!a) return null;
    const key = featureKey(uri, a.hash, position, 'hover');
    if (this.hoverCache.has(key)) return this.hoverCache.get(key)!;
    const result = hover(a, position);
    this.hoverCache.set(key, result);
    return result;
  }

  definition(uri: DocumentUri, position: LsPosition): LsLocation | null {
    const a = this.store.get(uri);
    return a ? definition(a, position) : null;
  }

  /** Alias for definition (declaration site). */
  findDeclaration(uri: DocumentUri, position: LsPosition): LsLocation | null {
    return this.definition(uri, position);
  }

  references(
    uri: DocumentUri,
    position: LsPosition,
    options?: { readonly includeDeclaration?: boolean },
  ): LsLocation[] {
    const a = this.store.get(uri);
    return a ? references(a, position, options) : [];
  }

  documentSymbols(uri: DocumentUri): DocumentSymbol[] {
    const a = this.store.get(uri);
    return a ? documentSymbols(a) : [];
  }

  workspaceSymbols(query: string): DocumentSymbol[] {
    return workspaceSymbols(this.store.all(), query);
  }

  prepareRename(
    uri: DocumentUri,
    position: LsPosition,
  ): PrepareRenameResult {
    const a = this.store.get(uri);
    return a
      ? prepareRename(a, position)
      : { ok: false, message: 'Document not open.' };
  }

  rename(
    uri: DocumentUri,
    position: LsPosition,
    newName: string,
  ): RenameResult {
    const a = this.store.get(uri);
    return a
      ? rename(a, position, newName)
      : { ok: false, message: 'Document not open.' };
  }

  completion(uri: DocumentUri, position: LsPosition): CompletionItem[] {
    const a = this.store.get(uri);
    if (!a) return [];
    const key = featureKey(uri, a.hash, position, 'completion');
    const hit = this.completionCache.get(key);
    if (hit) return hit;
    const result = completion(a, position);
    this.completionCache.set(key, result);
    return result;
  }

  signatureHelp(uri: DocumentUri, position: LsPosition): SignatureHelp | null {
    const a = this.store.get(uri);
    return a ? signatureHelp(a, position) : null;
  }

  /** Identifier classification at a position (for semantic highlighting). */
  classifyAt(
    uri: DocumentUri,
    position: LsPosition,
  ): {
    kind: string;
    name: string;
  } | null {
    const a = this.store.get(uri);
    if (!a) return null;
    const occ = occurrenceAt(a, position);
    if (!occ) return null;
    return {
      kind: occ.symbol?.builtin
        ? 'builtin'
        : (occ.symbol?.kind ?? 'unknown'),
      name: occ.name,
    };
  }

  private clearFeatureCaches(uri: DocumentUri): void {
    const prefix = `${uri}|`;
    for (const key of this.hoverCache.keys()) {
      if (key.startsWith(prefix)) this.hoverCache.delete(key);
    }
    for (const key of this.completionCache.keys()) {
      if (key.startsWith(prefix)) this.completionCache.delete(key);
    }
  }
}

function featureKey(
  uri: DocumentUri,
  hash: string,
  position: LsPosition,
  kind: string,
): string {
  return `${uri}|${hash}|${kind}|${position.line}:${position.character}`;
}

/**
 * Preferred session: shared {@link IncrementalCompiler} + language features
 * wired into {@link CompilerService} (`getHover`, `getCompletion`, …).
 */
export function createCompilerSession(): {
  compiler: IncrementalCompiler;
  compilerService: CompilerService;
  languageService: LanguageService;
} {
  const compiler = new IncrementalCompiler();
  const languageService = new LanguageService({ compiler });
  const compilerService = new CompilerService({
    compiler,
    features: languageService.createFeatureProvider(),
  });
  return { compiler, compilerService, languageService };
}

export {
  DocumentStore,
  analyzeDocument,
  type DocumentAnalysis,
  type DocumentUri,
};
export {
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
  type HoverInfo,
  type DocumentSymbol,
  type CompletionItem,
  type SignatureHelp,
  type TextEdit,
  type RenameResult,
  type PrepareRenameResult,
};
export type { LsPosition, LsRange, LsLocation } from './protocol.js';
export {
  spanToRange,
  positionInSpan,
  offsetAt,
  positionAt,
} from './protocol.js';
