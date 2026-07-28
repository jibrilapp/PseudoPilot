'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import type { Breakpoint } from '@/lib/debugger';

type CodeSurfaceProps = {
  code: string;
  language: 'pseudocode' | 'python';
  /** When set, the surface is an editable textarea (pseudocode). */
  editable?: boolean;
  onChange?: (value: string) => void;
  'aria-label'?: string;
  /** 1-based line currently paused on (pseudocode). */
  activeLine?: number | null;
  breakpoints?: readonly Breakpoint[];
  onToggleBreakpoint?: (line: number) => void;
};

/**
 * Code surface: read-only highlighted view, or editable monospace textarea.
 * Highlighting is visual-only for read-only mode; editable mode prioritizes typing.
 *
 * Editable mode uses one scroll container for gutter + text so breakpoints and
 * the active-line highlight stay aligned when the program is taller than the pane.
 */
export function CodeSurface({
  code,
  language,
  editable = false,
  onChange,
  'aria-label': ariaLabel,
  activeLine = null,
  breakpoints = [],
  onToggleBreakpoint,
}: CodeSurfaceProps) {
  const lines = useMemo(() => {
    const normalized = code.replace(/\n$/, '');
    return normalized.length === 0 ? [''] : normalized.split('\n');
  }, [code]);

  const lineCount = Math.max(lines.length, 1);
  const bpByLine = useMemo(() => {
    const map = new Map<number, Breakpoint>();
    for (const bp of breakpoints) map.set(bp.line, bp);
    return map;
  }, [breakpoints]);

  if (editable) {
    return (
      <div className="relative min-h-0 flex-1 overflow-auto">
        <div className="relative flex min-h-full font-mono text-[13px] leading-[1.7]">
          <div
            aria-hidden
            className="sticky left-0 z-[1] flex shrink-0 select-none flex-col self-start border-r border-pp-line bg-pp-editor text-right text-[12px] leading-[1.7] text-pp-faint tabular-nums"
          >
            {Array.from({ length: lineCount }, (_, i) => {
              const line = i + 1;
              const bp = bpByLine.get(line);
              const isActive = activeLine === line;
              return (
                <div
                  key={line}
                  className={cn(
                    'flex h-[1.7em] items-center gap-1 px-1.5',
                    isActive && 'bg-amber-400/25',
                  )}
                >
                  <button
                    type="button"
                    title={
                      bp
                        ? bp.enabled
                          ? 'Disable breakpoint'
                          : 'Remove breakpoint'
                        : 'Add breakpoint'
                    }
                    aria-label={`Toggle breakpoint on line ${line}`}
                    className="grid h-4 w-4 place-items-center rounded-full"
                    onClick={() => onToggleBreakpoint?.(line)}
                  >
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full',
                        bp?.enabled && 'bg-rose-500',
                        bp && !bp.enabled && 'bg-rose-300/70 ring-1 ring-rose-400/50',
                        !bp && 'bg-transparent hover:bg-rose-400/40',
                      )}
                    />
                  </button>
                  <span className="min-w-[1.5rem]">{line}</span>
                </div>
              );
            })}
          </div>
          <div className="relative min-w-0 flex-1">
            {activeLine != null && activeLine >= 1 && activeLine <= lineCount && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bg-amber-400/15"
                style={{
                  top: `calc(${activeLine - 1} * 1.7em + 0.5rem)`,
                  height: '1.7em',
                }}
              />
            )}
            <textarea
              aria-label={ariaLabel ?? 'Pseudocode editor'}
              spellCheck={false}
              value={code}
              rows={lineCount}
              onChange={(e) => onChange?.(e.target.value)}
              className={cn(
                'relative m-0 w-full resize-none overflow-hidden border-0 bg-transparent',
                'px-4 py-2 text-pp-ink outline-none focus:ring-0',
                'caret-pp-accent',
              )}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="flex min-w-max font-mono text-[13px] leading-[1.7]">
        <div
          aria-hidden
          className="sticky left-0 select-none whitespace-pre border-r border-pp-line bg-transparent px-3.5 py-2 text-right text-[12px] leading-[1.7] text-pp-faint tabular-nums"
        >
          {lines.map((_, i) => i + 1).join('\n')}
        </div>
        <pre className="m-0 flex-1 whitespace-pre px-4 py-2 text-pp-ink">
          {lines.map((line, i) => (
            <div key={i} className="rounded-sm hover:bg-black/[0.025]">
              <HighlightedLine line={line} language={language} />
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

function HighlightedLine({
  line,
  language,
}: {
  line: string;
  language: 'pseudocode' | 'python';
}) {
  // Cap work per line to avoid main-thread jank / pathological regex cost.
  const MAX_HIGHLIGHT_CHARS = 4_000;
  if (line.length > MAX_HIGHLIGHT_CHARS) {
    return <span>{line}</span>;
  }
  if (!line.trim()) return <span>&nbsp;</span>;

  const keywords =
    language === 'pseudocode'
      ? [
          'DECLARE',
          'CONSTANT',
          'PROCEDURE',
          'ENDPROCEDURE',
          'FUNCTION',
          'ENDFUNCTION',
          'RETURNS',
          'RETURN',
          'FOR',
          'TO',
          'NEXT',
          'STEP',
          'CASE',
          'OF',
          'OTHERWISE',
          'ENDCASE',
          'CALL',
          'OUTPUT',
          'INPUT',
          'IF',
          'THEN',
          'ELSE',
          'ENDIF',
          'WHILE',
          'ENDWHILE',
          'REPEAT',
          'UNTIL',
          'DO',
          'INTEGER',
          'STRING',
          'REAL',
          'BOOLEAN',
          'CHAR',
          'ARRAY',
          'TRUE',
          'FALSE',
          'AND',
          'OR',
          'NOT',
          'DIV',
          'MOD',
        ]
      : [
          'def',
          'return',
          'for',
          'in',
          'range',
          'print',
          'None',
          'True',
          'False',
          'class',
          'if',
          'else',
          'elif',
          'while',
          'import',
          'from',
          'as',
          'input',
        ];

  const parts = tokenize(line, keywords, language);
  return (
    <>
      {parts.map((part, i) => (
        <span key={i} className={cn(part.className)}>
          {part.text}
        </span>
      ))}
    </>
  );
}

function tokenize(
  line: string,
  keywords: string[],
  language: 'pseudocode' | 'python',
): { text: string; className?: string }[] {
  const tokens: { text: string; className?: string }[] = [];
  const stringRe =
    language === 'python'
      ? /("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/
      : /("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/;
  const commentRe = language === 'python' ? /#.*$/ : /\/\/.*$/;

  let rest = line;
  const commentMatch = rest.match(commentRe);
  let comment = '';
  if (commentMatch && commentMatch.index !== undefined) {
    comment = rest.slice(commentMatch.index);
    rest = rest.slice(0, commentMatch.index);
  }

  const regex = new RegExp(
    `(${stringRe.source})|(\\b(?:${keywords.join('|')})\\b)|(\\d+)|(←)|(→)|(:)`,
    'g',
  );
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(rest)) !== null) {
    if (match.index > last) {
      tokens.push({ text: rest.slice(last, match.index) });
    }
    const [full, str, , , kw, num, assign, arrow, colon] = match;
    if (str) tokens.push({ text: full, className: 'text-pp-string' });
    else if (kw) tokens.push({ text: full, className: 'font-medium text-pp-keyword' });
    else if (num) tokens.push({ text: full, className: 'text-pp-number' });
    else if (assign || arrow) tokens.push({ text: full, className: 'text-pp-accent' });
    else if (colon) tokens.push({ text: full, className: 'text-pp-faint' });
    else tokens.push({ text: full });
    last = match.index + full.length;
  }
  if (last < rest.length) tokens.push({ text: rest.slice(last) });
  if (comment) tokens.push({ text: comment, className: 'italic text-pp-comment' });
  return tokens.length ? tokens : [{ text: line }];
}
