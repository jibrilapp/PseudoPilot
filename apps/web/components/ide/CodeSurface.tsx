'use client';

import { cn } from '@/lib/cn';

type CodeSurfaceProps = {
  code: string;
  language: 'pseudocode' | 'python';
};

/** Visual-only code surface — not a real editor/runtime. */
export function CodeSurface({ code, language }: CodeSurfaceProps) {
  const lines = code.replace(/\n$/, '').split('\n');

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="flex min-w-max font-mono text-[13px] leading-[1.7]">
        <div
          aria-hidden
          className="sticky left-0 select-none border-r border-pp-line bg-transparent px-3.5 py-2 text-right text-[12px] text-pp-faint"
        >
          {lines.map((_, i) => (
            <div key={i} className="tabular-nums">
              {i + 1}
            </div>
          ))}
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
  if (!line.trim()) return <span>&nbsp;</span>;

  const keywords =
    language === 'pseudocode'
      ? [
          'DECLARE',
          'PROCEDURE',
          'ENDPROCEDURE',
          'FUNCTION',
          'ENDFUNCTION',
          'FOR',
          'TO',
          'NEXT',
          'CALL',
          'OUTPUT',
          'INPUT',
          'IF',
          'THEN',
          'ELSE',
          'ENDIF',
          'WHILE',
          'ENDWHILE',
          'INTEGER',
          'STRING',
          'REAL',
          'BOOLEAN',
          'CHAR',
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
  const stringRe = language === 'python' ? /("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/ : /("([^"\\]|\\.)*")/;
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
