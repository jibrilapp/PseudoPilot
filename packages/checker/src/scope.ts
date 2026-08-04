import type { SourceSpan } from '@pseudopilot/language-core';
import type { CheckerDiagnostic, SymbolInfo, SymbolKind, PpType } from './types.js';

/** Cambridge identifiers are case-insensitive (SPECIFICATION §13.6). */
export function identKey(name: string): string {
  return name.toLowerCase();
}

export class Scope {
  /** Keys are {@link identKey}; values keep first-declaration casing. */
  private readonly bindings = new Map<string, SymbolInfo>();

  constructor(
    readonly parent: Scope | null,
    readonly name: string,
  ) {}

  lookup(name: string): SymbolInfo | undefined {
    const key = identKey(name);
    const local = this.bindings.get(key);
    if (local) return local;
    return this.parent?.lookup(name);
  }

  /** Lookup only in this frame (no parents). */
  lookupLocal(name: string): SymbolInfo | undefined {
    return this.bindings.get(identKey(name));
  }

  define(
    symbol: SymbolInfo,
    report: (diagnostic: CheckerDiagnostic) => void,
  ): boolean {
    const key = identKey(symbol.name);
    const existing = this.bindings.get(key);
    if (existing) {
      report({
        severity: 'error',
        code: dupCode(existing.kind, symbol.kind),
        message: `Duplicate ${labelKind(symbol.kind)} '${symbol.name}' in this scope.`,
        span: symbol.span,
        help: `Previously declared as ${labelKind(existing.kind)} '${existing.name}'.`,
      });
      return false;
    }
    this.bindings.set(key, symbol);
    return true;
  }

  entries(): IterableIterator<[string, SymbolInfo]> {
    return this.bindings.entries();
  }

  /**
   * Snapshot for interpreter / variables panel.
   * Map keys are **case-folded** (`identKey`); use {@link SymbolInfo.name} for display casing.
   */
  snapshot(): Map<string, SymbolInfo> {
    return new Map(this.bindings);
  }
}

function labelKind(kind: SymbolKind): string {
  switch (kind) {
    case 'variable':
      return 'variable';
    case 'constant':
      return 'CONSTANT';
    case 'parameter':
      return 'parameter';
    case 'procedure':
      return 'PROCEDURE';
    case 'function':
      return 'FUNCTION';
    case 'type':
      return 'TYPE';
    case 'field':
      return 'field';
    case 'class':
      return 'CLASS';
    case 'method':
      return 'method';
  }
}

function dupCode(prev: SymbolKind, next: SymbolKind): string {
  if (next === 'procedure' || prev === 'procedure') return 'C_DUP_PROCEDURE';
  if (next === 'function' || prev === 'function') return 'C_DUP_FUNCTION';
  if (next === 'constant' || prev === 'constant') return 'C_DUP_CONSTANT';
  if (next === 'parameter' || prev === 'parameter') return 'C_DUP_PARAMETER';
  if (next === 'class' || prev === 'class') return 'C_DUP_CLASS';
  if (next === 'type' || prev === 'type') return 'C_DUP_TYPE';
  if (next === 'field' || prev === 'field') return 'C_DUP_FIELD';
  if (next === 'method' || prev === 'method') return 'C_DUP_METHOD';
  return 'C_DUP_VARIABLE';
}

export function makeSymbol(
  name: string,
  kind: SymbolKind,
  type: PpType,
  span: SourceSpan,
  options?: {
    readonly implicit?: boolean;
    readonly builtin?: boolean;
    readonly containerName?: string;
  },
): SymbolInfo {
  const base: SymbolInfo = { name, kind, type, span };
  if (!options) return base;
  return {
    ...base,
    ...(options.implicit ? { implicit: true } : {}),
    ...(options.builtin ? { builtin: true } : {}),
    ...(options.containerName !== undefined
      ? { containerName: options.containerName }
      : {}),
  };
}

/** Case-insensitive lookup into a {@link Scope.snapshot} map. */
export function lookupSymbol(
  symbols: ReadonlyMap<string, SymbolInfo>,
  name: string,
): SymbolInfo | undefined {
  return symbols.get(identKey(name));
}
