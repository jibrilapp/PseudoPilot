/**
 * LSP-aligned position/range types (0-based line & character).
 * Cambridge SourceSpan uses 1-based line/column — convert at the boundary.
 */

import type { SourceSpan } from '@pseudopilot/language-core';

export type LsPosition = {
  /** 0-based line. */
  readonly line: number;
  /** 0-based UTF-16 character offset on the line. */
  readonly character: number;
};

export type LsRange = {
  readonly start: LsPosition;
  readonly end: LsPosition;
};

export type LsLocation = {
  readonly uri: string;
  readonly range: LsRange;
};

export function spanToRange(span: SourceSpan): LsRange {
  return {
    start: {
      line: Math.max(0, span.start.line - 1),
      character: Math.max(0, span.start.column - 1),
    },
    end: {
      line: Math.max(0, span.end.line - 1),
      character: Math.max(0, span.end.column - 1),
    },
  };
}

export function positionInSpan(
  position: LsPosition,
  span: SourceSpan,
): boolean {
  const { start, end } = spanToRange(span);
  // Half-open [start, end). Zero-width spans contain their start.
  if (start.line === end.line && start.character === end.character) {
    return (
      position.line === start.line && position.character === start.character
    );
  }
  if (comparePos(position, start) < 0) return false;
  if (comparePos(position, end) >= 0) return false;
  return true;
}

function comparePos(a: LsPosition, b: LsPosition): number {
  if (a.line !== b.line) return a.line - b.line;
  return a.character - b.character;
}

/** Offset into source for a 0-based position (best-effort for ASCII/Cambridge). */
export function offsetAt(source: string, position: LsPosition): number {
  const lines = source.split('\n');
  let offset = 0;
  for (let i = 0; i < position.line && i < lines.length; i += 1) {
    offset += lines[i]!.length + 1;
  }
  if (position.line >= lines.length) return source.length;
  return offset + Math.min(position.character, lines[position.line]!.length);
}

export function positionAt(source: string, offset: number): LsPosition {
  let line = 0;
  let character = 0;
  const clamped = Math.max(0, Math.min(offset, source.length));
  for (let i = 0; i < clamped; i += 1) {
    if (source[i] === '\n') {
      line += 1;
      character = 0;
    } else {
      character += 1;
    }
  }
  return { line, character };
}
