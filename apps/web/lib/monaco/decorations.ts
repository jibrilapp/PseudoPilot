/**
 * Monaco decorations for breakpoints + current execution line.
 */

import type { Breakpoint } from '@/lib/debugger';

export type DecorationLike = {
  readonly options: {
    glyphMarginClassName?: string;
    className?: string;
    isWholeLine?: boolean;
    overviewRuler?: { color: string; position: number };
  };
  readonly range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
};

export function breakpointDecorations(
  breakpoints: readonly Breakpoint[],
): DecorationLike[] {
  return breakpoints
    .filter((bp) => bp.enabled)
    .map((bp) => ({
      range: {
        startLineNumber: bp.line,
        startColumn: 1,
        endLineNumber: bp.line,
        endColumn: 1,
      },
      options: {
        glyphMarginClassName: 'pp-bp-glyph',
        overviewRuler: { color: '#e11d48', position: 1 },
      },
    }));
}

export function disabledBreakpointDecorations(
  breakpoints: readonly Breakpoint[],
): DecorationLike[] {
  return breakpoints
    .filter((bp) => !bp.enabled)
    .map((bp) => ({
      range: {
        startLineNumber: bp.line,
        startColumn: 1,
        endLineNumber: bp.line,
        endColumn: 1,
      },
      options: {
        glyphMarginClassName: 'pp-bp-glyph-disabled',
      },
    }));
}

export function activeLineDecoration(line: number | null): DecorationLike[] {
  if (line == null || line < 1) return [];
  return [
    {
      range: {
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line,
        endColumn: 1,
      },
      options: {
        isWholeLine: true,
        className: 'pp-exec-line',
        overviewRuler: { color: '#f59e0b', position: 7 },
      },
    },
  ];
}

export function mergeEditorDecorations(
  breakpoints: readonly Breakpoint[],
  activeLine: number | null,
): DecorationLike[] {
  return [
    ...breakpointDecorations(breakpoints),
    ...disabledBreakpointDecorations(breakpoints),
    ...activeLineDecoration(activeLine),
  ];
}
