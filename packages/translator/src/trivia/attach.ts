import type { IrStatement, IrTrivia } from '../ir/nodes.js';

export type SourceCommentStyle = 'slash' | 'hash';

/** Line-oriented span (1-based lines), compatible with language-core SourceSpan. */
export type TriviaSpan = {
  readonly start: { readonly line: number };
  readonly end: { readonly line: number };
};

type RawTrivia = {
  readonly line: number; // 1-based
  readonly kind: 'Comment' | 'BlankLine';
  readonly text?: string;
};

/**
 * Collect full-line and detect blank lines, plus trailing mid-line comments.
 * Cambridge uses // ; Python uses #.
 */
export function collectLineTrivia(
  source: string,
  style: SourceCommentStyle,
): RawTrivia[] {
  const marker = style === 'slash' ? '//' : '#';
  const lines = source.split(/\r?\n/);
  const items: RawTrivia[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i] ?? '';
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      items.push({ line: lineNo, kind: 'BlankLine' });
      continue;
    }
    if (trimmed.startsWith(marker)) {
      const text = trimmed.slice(marker.length).replace(/^\s*/, '');
      items.push({ line: lineNo, kind: 'Comment', text });
    }
  }
  return items;
}

function spanStartLine(span: TriviaSpan): number {
  return span.start.line;
}

function spanEndLine(span: TriviaSpan): number {
  return span.end.line;
}

/**
 * Attach trivia that sits on lines strictly after `prevEndLine` and
 * at or before the statement's start line (leading), plus same-line trailing comments.
 */
export function attachTriviaToStatements(
  source: string,
  style: SourceCommentStyle,
  statements: readonly { stmt: IrStatement; span: TriviaSpan }[],
): { body: IrStatement[]; leadingTrivia: IrTrivia[]; trailingTrivia: IrTrivia[] } {
  const raw = collectLineTrivia(source, style);
  const marker = style === 'slash' ? '//' : '#';
  const sourceLines = source.split(/\r?\n/);

  const usedLines = new Set<number>();
  const body: IrStatement[] = [];
  let cursorLine = 0; // last consumed source line

  const takeBetween = (fromExclusive: number, toInclusive: number): IrTrivia[] => {
    const out: IrTrivia[] = [];
    let blankRun = false;
    for (const item of raw) {
      if (item.line <= fromExclusive || item.line > toInclusive) continue;
      if (usedLines.has(item.line)) continue;
      usedLines.add(item.line);
      if (item.kind === 'BlankLine') {
        if (!blankRun) {
          out.push({ kind: 'BlankLine' });
          blankRun = true;
        }
      } else {
        blankRun = false;
        out.push({ kind: 'Comment', text: item.text ?? '' });
      }
    }
    return out;
  };

  for (const { stmt, span } of statements) {
    const start = spanStartLine(span);
    const leading = takeBetween(cursorLine, start);
    // Same-line trailing comment: code ... // comment
    const trailing: IrTrivia[] = [];
    const endLine = spanEndLine(span);
    const lineText = sourceLines[endLine - 1] ?? '';
    const idx = lineText.indexOf(marker);
    if (idx >= 0) {
      // Only treat as trailing if marker appears after non-whitespace content
      const before = lineText.slice(0, idx).trim();
      if (before.length > 0) {
        const text = lineText.slice(idx + marker.length).replace(/^\s*/, '');
        trailing.push({ kind: 'Comment', text });
        usedLines.add(endLine);
      }
    }

    body.push({
      ...stmt,
      leadingTrivia: leading,
      trailingTrivia: trailing,
    });
    cursorLine = Math.max(cursorLine, endLine);
  }

  const trailingTrivia = takeBetween(cursorLine, sourceLines.length);
  const leadingTrivia: IrTrivia[] = [];
  // Program-level leading: trivia before first statement already on first stmt.
  // If no statements, all trivia is program trailing.
  if (statements.length === 0) {
    return {
      body: [],
      leadingTrivia: [],
      trailingTrivia: takeBetween(0, sourceLines.length),
    };
  }

  return { body, leadingTrivia, trailingTrivia };
}

export function printTrivia(
  trivia: readonly IrTrivia[],
  style: SourceCommentStyle,
): string[] {
  const marker = style === 'slash' ? '//' : '#';
  const lines: string[] = [];
  for (const t of trivia) {
    if (t.kind === 'BlankLine') {
      lines.push('');
    } else {
      lines.push(t.text.length > 0 ? `${marker} ${t.text}` : marker);
    }
  }
  return lines;
}
