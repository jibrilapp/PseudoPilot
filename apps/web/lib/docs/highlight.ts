/**
 * Lightweight syntax highlighter for doc code fences — no extra deps.
 * Supports pseudocode, Python, TypeScript/JS, JSON, and a generic fallback.
 */

export type HighlightToken = {
  type: 'plain' | 'keyword' | 'string' | 'comment' | 'number' | 'punct';
  value: string;
};

const PSEUDO_KEYWORDS = new Set(
  [
    'DECLARE',
    'CONSTANT',
    'INPUT',
    'OUTPUT',
    'IF',
    'THEN',
    'ELSE',
    'ENDIF',
    'CASE',
    'OF',
    'OTHERWISE',
    'ENDCASE',
    'FOR',
    'TO',
    'STEP',
    'NEXT',
    'WHILE',
    'ENDWHILE',
    'REPEAT',
    'UNTIL',
    'PROCEDURE',
    'ENDPROCEDURE',
    'FUNCTION',
    'ENDFUNCTION',
    'RETURNS',
    'RETURN',
    'CALL',
    'AND',
    'OR',
    'NOT',
    'TRUE',
    'FALSE',
    'INTEGER',
    'REAL',
    'STRING',
    'BOOLEAN',
    'CHAR',
    'DATE',
    'ARRAY',
    'TYPE',
    'ENDTYPE',
    'CLASS',
    'ENDCLASS',
    'INHERITS',
    'NEW',
    'SUPER',
    'PRIVATE',
    'PUBLIC',
    'OPENFILE',
    'READFILE',
    'WRITEFILE',
    'CLOSEFILE',
    'EOF',
    'SEEK',
    'GETRECORD',
    'PUTRECORD',
  ].map((k) => k.toLowerCase()),
);

const PY_KEYWORDS = new Set(
  [
    'False',
    'None',
    'True',
    'and',
    'as',
    'assert',
    'async',
    'await',
    'break',
    'class',
    'continue',
    'def',
    'del',
    'elif',
    'else',
    'except',
    'finally',
    'for',
    'from',
    'global',
    'if',
    'import',
    'in',
    'is',
    'lambda',
    'nonlocal',
    'not',
    'or',
    'pass',
    'raise',
    'return',
    'try',
    'while',
    'with',
    'yield',
  ].map((k) => k.toLowerCase()),
);

const TS_KEYWORDS = new Set(
  [
    'break',
    'case',
    'catch',
    'class',
    'const',
    'continue',
    'debugger',
    'default',
    'delete',
    'do',
    'else',
    'enum',
    'export',
    'extends',
    'false',
    'finally',
    'for',
    'function',
    'if',
    'import',
    'in',
    'instanceof',
    'let',
    'new',
    'null',
    'return',
    'super',
    'switch',
    'this',
    'throw',
    'true',
    'try',
    'typeof',
    'var',
    'void',
    'while',
    'with',
    'yield',
    'type',
    'interface',
    'readonly',
    'as',
    'from',
    'async',
    'await',
  ].map((k) => k.toLowerCase()),
);

function normalizeLang(lang: string | null | undefined): string {
  const l = (lang ?? '').toLowerCase().trim();
  if (!l) return 'text';
  if (['pseudo', 'pseudocode', 'cambridge'].includes(l)) return 'pseudocode';
  if (['py', 'python'].includes(l)) return 'python';
  if (['ts', 'tsx', 'typescript'].includes(l)) return 'typescript';
  if (['js', 'jsx', 'javascript'].includes(l)) return 'javascript';
  if (l === 'json') return 'json';
  return l;
}

function keywordsFor(lang: string): Set<string> | null {
  switch (lang) {
    case 'pseudocode':
      return PSEUDO_KEYWORDS;
    case 'python':
      return PY_KEYWORDS;
    case 'typescript':
    case 'javascript':
      return TS_KEYWORDS;
    default:
      return null;
  }
}

export function highlightCode(
  code: string,
  lang: string | null | undefined,
): HighlightToken[] {
  const normalized = normalizeLang(lang);
  if (normalized === 'json') return highlightJson(code);
  const kws = keywordsFor(normalized);
  if (!kws) return [{ type: 'plain', value: code }];
  return highlightGeneric(code, kws, normalized === 'python');
}

function highlightGeneric(
  code: string,
  keywords: Set<string>,
  hashComments: boolean,
): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  // Capture groups (1-based): 1 string, 2 line-comment, 3 number, 4 word, 5 space, 6 other
  const re =
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\/\/[^\n]*|#[^\n]*)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_][\w]*\b)|(\s+)|(.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    if (m[1]) {
      tokens.push({ type: 'string', value: m[1] });
    } else if (m[2]) {
      const c = m[2];
      if (c.startsWith('//') || (hashComments && c.startsWith('#'))) {
        tokens.push({ type: 'comment', value: c });
      } else {
        tokens.push({ type: 'plain', value: c });
      }
    } else if (m[3]) {
      tokens.push({ type: 'number', value: m[3] });
    } else if (m[4]) {
      const word = m[4];
      if (keywords.has(word.toLowerCase())) {
        tokens.push({ type: 'keyword', value: word });
      } else {
        tokens.push({ type: 'plain', value: word });
      }
    } else if (m[5]) {
      tokens.push({ type: 'plain', value: m[5] });
    } else if (m[6]) {
      tokens.push({ type: 'punct', value: m[6] });
    }
  }
  return tokens.length > 0 ? tokens : [{ type: 'plain', value: code }];
}

function highlightJson(code: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  const re =
    /("([^"\\]|\\.)*")|(\btrue\b|\bfalse\b|\bnull\b)|(-?\d+(\.\d+)?)|(\s+)|([{}[\]:,])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    if (m[1]) tokens.push({ type: 'string', value: m[1] });
    else if (m[3]) tokens.push({ type: 'keyword', value: m[3] });
    else if (m[4]) tokens.push({ type: 'number', value: m[4] });
    else if (m[6]) tokens.push({ type: 'plain', value: m[6] });
    else if (m[7]) tokens.push({ type: 'punct', value: m[7] });
  }
  return tokens.length > 0 ? tokens : [{ type: 'plain', value: code }];
}
