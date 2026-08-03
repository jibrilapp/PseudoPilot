/**
 * High-level compiler service façade.
 *
 * Owns {@link IncrementalCompiler} for staged caches.
 * IDE feature methods (`getHover`, …) are optional — wire a
 * {@link LanguageFeatureProvider} so this package stays free of a hard
 * dependency on `@pseudopilot/language-service` (avoids cycles).
 *
 * LanguageService installs the provider and is the usual IDE entry point.
 */

import type { CheckerDiagnostic, SymbolInfo } from '@pseudopilot/checker';
import type { Program } from '@pseudopilot/language-core';
import {
  IncrementalCompiler,
  type CompileOptions,
  type CompileResult,
} from './compiler.js';
import type { CompiledDocument, DocumentUri } from './document.js';
import type { CompileStage } from './stages.js';

/** Position matching LSP / language-service (0-based). */
export type CompilerPosition = {
  readonly line: number;
  readonly character: number;
};

/**
 * Optional IDE feature bridge. Implemented by language-service so
 * CompilerService can expose getHover / getCompletion without importing LS.
 */
export type LanguageFeatureProvider = {
  onCompiled(document: CompiledDocument): void;
  /** Called when a document is closed — drop LS analysis / feature memos. */
  onClosed?(uri: DocumentUri): void;
  getHover?(
    uri: DocumentUri,
    position: CompilerPosition,
  ): unknown;
  getCompletion?(
    uri: DocumentUri,
    position: CompilerPosition,
  ): unknown;
  getDefinition?(
    uri: DocumentUri,
    position: CompilerPosition,
  ): unknown;
  getReferences?(
    uri: DocumentUri,
    position: CompilerPosition,
  ): unknown;
};

export type CompilerServiceOptions = {
  readonly features?: LanguageFeatureProvider;
  /** Share an existing incremental compiler (e.g. with LanguageService). */
  readonly compiler?: IncrementalCompiler;
};

/**
 * Multi-document compilation session — React-agnostic, LSP-ready.
 */
export class CompilerService {
  readonly compiler: IncrementalCompiler;
  private features: LanguageFeatureProvider | null;

  constructor(options: CompilerServiceOptions = {}) {
    this.compiler = options.compiler ?? new IncrementalCompiler();
    this.features = options.features ?? null;
  }

  setFeatureProvider(provider: LanguageFeatureProvider | null): void {
    this.features = provider;
  }

  openDocument(
    uri: DocumentUri,
    source: string,
    version = 0,
  ): CompileResult {
    const result = this.compiler.openDocument(uri, source, version);
    this.features?.onCompiled(result.document);
    return result;
  }

  updateDocument(
    uri: DocumentUri,
    source: string,
    version: number,
  ): CompileResult {
    const result = this.compiler.updateDocument(uri, source, version);
    this.features?.onCompiled(result.document);
    return result;
  }

  closeDocument(uri: DocumentUri): void {
    this.compiler.closeDocument(uri);
    this.features?.onClosed?.(uri);
  }

  compile(uri: DocumentUri, options?: CompileOptions): CompileResult {
    const result = this.compiler.compile(uri, options);
    this.features?.onCompiled(result.document);
    return result;
  }

  getDiagnostics(uri: DocumentUri): readonly CheckerDiagnostic[] {
    return this.compiler.getDiagnostics(uri);
  }

  getSymbols(uri: DocumentUri): readonly SymbolInfo[] {
    return this.compiler.getSymbols(uri);
  }

  getAst(uri: DocumentUri): Program | null {
    return this.compiler.getAst(uri);
  }

  getDocument(uri: DocumentUri): CompiledDocument | undefined {
    return this.compiler.getDocument(uri);
  }

  invalidate(
    uri: DocumentUri,
    from?: CompileStage,
    options?: { readonly dependents?: boolean },
  ): void {
    this.compiler.invalidate(uri, from, options);
  }

  setDependencies(
    uri: DocumentUri,
    dependencies: readonly DocumentUri[],
  ): void {
    this.compiler.dependencies.setDependencies(uri, dependencies);
  }

  getHover(uri: DocumentUri, position: CompilerPosition): unknown {
    this.ensureCompiled(uri);
    return this.features?.getHover?.(uri, position) ?? null;
  }

  getCompletion(uri: DocumentUri, position: CompilerPosition): unknown {
    this.ensureCompiled(uri);
    return this.features?.getCompletion?.(uri, position) ?? [];
  }

  getDefinition(uri: DocumentUri, position: CompilerPosition): unknown {
    this.ensureCompiled(uri);
    return this.features?.getDefinition?.(uri, position) ?? null;
  }

  getReferences(uri: DocumentUri, position: CompilerPosition): unknown {
    this.ensureCompiled(uri);
    return this.features?.getReferences?.(uri, position) ?? [];
  }

  private ensureCompiled(uri: DocumentUri): void {
    if (!this.compiler.hasDocument(uri)) {
      throw new Error(`Document not open: ${uri}`);
    }
    const result = this.compiler.compile(uri);
    this.features?.onCompiled(result.document);
  }
}
