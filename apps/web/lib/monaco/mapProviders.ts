/**
 * Map language-service results → Monaco provider return shapes (pure helpers).
 */

import type {
  CompletionItem,
  HoverInfo,
  DocumentSymbol,
  SignatureHelp,
} from '@pseudopilot/language-service';
import { lsPosToMonaco, lsRangeToMonaco, type LsLikeRange } from './protocol';

/** Minimal diagnostic shape (avoid hard dep on checker in map helpers). */
export type MarkerDiagnostic = {
  readonly severity: 'error' | 'warning';
  readonly code: string;
  readonly message: string;
  readonly help?: string;
  readonly span: {
    readonly start: { readonly line: number; readonly column: number };
    readonly end: { readonly line: number; readonly column: number };
  };
};

export type MonacoMarkerData = {
  severity: number;
  message: string;
  code?: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

/** Monaco MarkerSeverity: Error=8, Warning=4, Info=2, Hint=1 */
export const MARKER_SEVERITY_ERROR = 8;
export const MARKER_SEVERITY_WARNING = 4;

export function hoverToMarkdown(hover: HoverInfo | null): string | null {
  if (!hover) return null;
  return hover.contents;
}

export function completionKindToMonaco(
  kind: CompletionItem['kind'],
): number {
  // monaco.languages.CompletionItemKind
  switch (kind) {
    case 'function':
      return 1; // Function
    case 'procedure':
      return 1;
    case 'variable':
      return 4; // Variable
    case 'constant':
      return 12; // Constant
    case 'parameter':
      return 4;
    case 'keyword':
      return 17; // Keyword
    case 'type':
      return 24; // Class / TypeParameter-ish
    default:
      return 18; // Text
  }
}

export function mapCompletions(items: readonly CompletionItem[]): {
  label: string;
  kind: number;
  detail?: string;
  documentation?: string;
  insertText: string;
}[] {
  return items.map((i) => ({
    label: i.label,
    kind: completionKindToMonaco(i.kind),
    detail: i.detail,
    documentation: i.documentation,
    insertText: i.insertText ?? i.label,
  }));
}

export function mapSignatureHelp(help: SignatureHelp | null): {
  signatures: {
    label: string;
    documentation?: string;
    parameters: { label: string; documentation?: string }[];
  }[];
  activeSignature: number;
  activeParameter: number;
} | null {
  if (!help) return null;
  return {
    signatures: [
      {
        label: help.label,
        documentation: help.documentation,
        parameters: help.parameters.map((p) => ({
          label: p.label,
          documentation: p.documentation,
        })),
      },
    ],
    activeSignature: 0,
    activeParameter: help.activeParameter,
  };
}

export function mapDocumentSymbols(syms: readonly DocumentSymbol[]): {
  name: string;
  detail: string;
  kind: number;
  range: ReturnType<typeof lsRangeToMonaco>;
  selectionRange: ReturnType<typeof lsRangeToMonaco>;
}[] {
  return syms.map((s) => ({
    name: s.name,
    detail: s.detail,
    kind: symbolKindToMonaco(s.kind),
    range: lsRangeToMonaco(s.range),
    selectionRange: lsRangeToMonaco(s.selectionRange),
  }));
}

function symbolKindToMonaco(kind: DocumentSymbol['kind']): number {
  switch (kind) {
    case 'function':
      return 11; // Function
    case 'procedure':
      return 11;
    case 'variable':
      return 12; // Variable
    case 'constant':
      return 13; // Constant
    case 'parameter':
      return 12;
    case 'type':
      return 4; // Class
    case 'field':
      return 7; // Field
    default:
      return 12;
  }
}

export function diagnosticsToMarkers(
  diags: readonly MarkerDiagnostic[],
): MonacoMarkerData[] {
  return diags.map((d) => {
    const start = lsPosToMonaco({
      line: d.span.start.line - 1,
      character: d.span.start.column - 1,
    });
    const end = lsPosToMonaco({
      line: d.span.end.line - 1,
      character: d.span.end.column - 1,
    });
    const message = d.help ? `${d.message}\n${d.help}` : d.message;
    return {
      severity:
        d.severity === 'warning' ? MARKER_SEVERITY_WARNING : MARKER_SEVERITY_ERROR,
      message,
      code: d.code,
      startLineNumber: start.lineNumber,
      startColumn: start.column,
      endLineNumber: Math.max(end.lineNumber, start.lineNumber),
      endColumn: end.column <= start.column && end.lineNumber === start.lineNumber
        ? start.column + 1
        : end.column,
    };
  });
}

export function locationToMonacoRange(range: LsLikeRange) {
  return lsRangeToMonaco(range);
}
