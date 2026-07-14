/**
 * Source locations for diagnostics and AST spans.
 * Offsets are 0-based into the original source string.
 * line / column are 1-based (editor-friendly).
 */

export type Position = {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
};

export type SourceSpan = {
  readonly start: Position;
  readonly end: Position;
};

export type DiagnosticSeverity = 'error' | 'warning';

export type Diagnostic = {
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly span: SourceSpan;
  readonly code: string;
};

export function pos(offset: number, line: number, column: number): Position {
  return { offset, line, column };
}

export function span(start: Position, end: Position): SourceSpan {
  return { start, end };
}
