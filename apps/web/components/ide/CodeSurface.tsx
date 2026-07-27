'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/cn';

type CodeSurfaceProps = {
  code: string;
  language: 'pseudocode' | 'python';
  /** When set, the surface is an editable textarea (pseudocode). */
  editable?: boolean;
  onChange?: (value: string) => void;
  'aria-label'?: string;
};

/**
 * Code surface: read-only highlighted view, or editable monospace textarea.
 * Highlighting is visual-only for read-only mode; editable mode prioritizes typing.
 */
export function CodeSurface({
  code,
  language,
  editable = false,
  onChange,
  'aria-label': ariaLabel,
}: CodeSurfaceProps) {
  const lines = useMemo(() => {
    const normalized = code.replace(/\n$/, '');
    return normalized.length === 0 ? [''] : normalized.split('\n');
  }, [code]);

  const lineCount = Math.max(lines.length, 1);

  if (editable) {
    return (
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full min-h-0 font-mono text-[13px] leading-[1.7]">
          <div
            aria-hidden
            className="sticky left-0 select-none whitespace-pre border-r border-pp-line bg-pp-editor px-3.5 py-2 text-right text-[12px] leading-[1.7] text-pp-faint tabular-nums"
          >
            {Array.from({ length: lineCount }, (_, i) => i + 1).join('\n')}
          </div>
          <textarea
            aria-label={ariaLabel ?? 'Pseudocode editor'}
            spellCheck={false}
            value={code}
            onChange={(e) => onChange?.(e.target.value)}
            className={cn(
              'm-0 min-h-0 w-full flex-1 resize-none border-0 bg-transparent',
              'px-4 py-2 text-pp-ink outline-none focus:ring-0',
              'caret-pp-accent',
            )}
          />
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
