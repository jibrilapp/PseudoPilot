export enum PyTokenKind {
  Eof = 'Eof',
  Newline = 'Newline',
  Identifier = 'Identifier',
  Integer = 'Integer',
  Real = 'Real',
  String = 'String',
  True = 'True',
  False = 'False',
  And = 'And',
  Or = 'Or',
  Not = 'Not',
  Print = 'Print',
  Input = 'Input',
  Equal = 'Equal', // =
  EqEq = 'EqEq',
  NotEq = 'NotEq',
  Lt = 'Lt',
  LtEq = 'LtEq',
  Gt = 'Gt',
  GtEq = 'GtEq',
  Plus = 'Plus',
  Minus = 'Minus',
  Star = 'Star',
  Slash = 'Slash',
  SlashSlash = 'SlashSlash',
  Percent = 'Percent',
  LParen = 'LParen',
  RParen = 'RParen',
  Comma = 'Comma',
}

export type PyToken = {
  readonly kind: PyTokenKind;
  readonly lexeme: string;
  readonly line: number;
  readonly column: number;
  readonly offset: number;
};

const KEYWORDS: ReadonlyMap<string, PyTokenKind> = new Map([
  ['True', PyTokenKind.True],
  ['False', PyTokenKind.False],
  ['and', PyTokenKind.And],
  ['or', PyTokenKind.Or],
  ['not', PyTokenKind.Not],
  ['print', PyTokenKind.Print],
  ['input', PyTokenKind.Input],
]);

export type PyLexResult = {
  readonly tokens: PyToken[];
  readonly diagnostics: { message: string; line: number; column: number; code: string }[];
};

function isIdentStart(ch: string): boolean {
  return /[A-Za-z_]/.test(ch);
}

function isIdentCont(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch);
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

/**
 * Line-oriented lexer for Python V1 subset (top-level statements only).
 * Skips indent/dedent — V1 forbids indented blocks.
 */
export function lexPython(source: string): PyLexResult {
  const tokens: PyToken[] = [];
  const diagnostics: PyLexResult['diagnostics'] = [];
  let i = 0;
  let line = 1;
  let column = 1;

  const at = () => source[i] ?? '';
  const peek = (n = 1) => source[i + n] ?? '';
  const advance = () => {
    const ch = source[i] ?? '';
    i += 1;
    if (ch === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
    return ch;
  };

  const emit = (kind: PyTokenKind, lexeme: string, start: { line: number; column: number; offset: number }) => {
    tokens.push({
      kind,
      lexeme,
      line: start.line,
      column: start.column,
      offset: start.offset,
    });
  };

  while (i < source.length) {
    const ch = at();

    // Full-line or trailing comments — skip to EOL (trivia handled separately)
    if (ch === '#') {
      while (i < source.length && at() !== '\n') advance();
      continue;
    }

    if (ch === ' ' || ch === '\t' || ch === '\r') {
      advance();
      continue;
    }

    if (ch === '\n') {
      const start = { line, column, offset: i };
      advance();
      emit(PyTokenKind.Newline, '\n', start);
      continue;
    }

    const start = { line, column, offset: i };

    if (ch === '=' && peek() === '=') {
      advance();
      advance();
      emit(PyTokenKind.EqEq, '==', start);
      continue;
    }
    if (ch === '!' && peek() === '=') {
      advance();
      advance();
      emit(PyTokenKind.NotEq, '!=', start);
      continue;
    }
    if (ch === '<' && peek() === '=') {
      advance();
      advance();
      emit(PyTokenKind.LtEq, '<=', start);
      continue;
    }
    if (ch === '>' && peek() === '=') {
      advance();
      advance();
      emit(PyTokenKind.GtEq, '>=', start);
      continue;
    }
    if (ch === '/' && peek() === '/') {
      advance();
      advance();
      emit(PyTokenKind.SlashSlash, '//', start);
      continue;
    }

    if (ch === '=') {
      advance();
      emit(PyTokenKind.Equal, '=', start);
      continue;
    }
    if (ch === '<') {
      advance();
      emit(PyTokenKind.Lt, '<', start);
      continue;
    }
    if (ch === '>') {
      advance();
      emit(PyTokenKind.Gt, '>', start);
      continue;
    }
    if (ch === '+') {
      advance();
      emit(PyTokenKind.Plus, '+', start);
      continue;
    }
    if (ch === '-') {
      advance();
      emit(PyTokenKind.Minus, '-', start);
      continue;
    }
    if (ch === '*') {
      advance();
      emit(PyTokenKind.Star, '*', start);
      continue;
    }
    if (ch === '/') {
      advance();
      emit(PyTokenKind.Slash, '/', start);
      continue;
    }
    if (ch === '%') {
      advance();
      emit(PyTokenKind.Percent, '%', start);
      continue;
    }
    if (ch === '(') {
      advance();
      emit(PyTokenKind.LParen, '(', start);
      continue;
    }
    if (ch === ')') {
      advance();
      emit(PyTokenKind.RParen, ')', start);
      continue;
    }
    if (ch === ',') {
      advance();
      emit(PyTokenKind.Comma, ',', start);
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = advance();
      let value = '';
      while (i < source.length && at() !== quote) {
        if (at() === '\\') {
          advance();
          const esc = advance();
          if (esc === 'n') value += '\n';
          else if (esc === 't') value += '\t';
          else if (esc === 'r') value += '\r';
          else if (esc === '\\' || esc === '"' || esc === "'") value += esc;
          else value += esc;
        } else if (at() === '\n') {
          diagnostics.push({
            message: 'Unterminated string literal.',
            line,
            column,
            code: 'T_PY_STRING',
          });
          break;
        } else {
          value += advance();
        }
      }
      if (at() === quote) advance();
      emit(PyTokenKind.String, value, start);
      continue;
    }

    if (isDigit(ch) || (ch === '.' && isDigit(peek()))) {
      let raw = '';
      while (isDigit(at())) raw += advance();
      if (at() === '.' && isDigit(peek())) {
        raw += advance();
        while (isDigit(at())) raw += advance();
        emit(PyTokenKind.Real, raw, start);
      } else {
        emit(PyTokenKind.Integer, raw, start);
      }
      continue;
    }

    if (isIdentStart(ch)) {
      let raw = '';
      while (isIdentCont(at())) raw += advance();
      const kw = KEYWORDS.get(raw);
      emit(kw ?? PyTokenKind.Identifier, raw, start);
      continue;
    }

    diagnostics.push({
      message: `Unexpected character '${ch}'.`,
      line,
      column,
      code: 'T_PY_LEX',
    });
    advance();
  }

  tokens.push({
    kind: PyTokenKind.Eof,
    lexeme: '',
    line,
    column,
    offset: i,
  });

  return { tokens, diagnostics };
}
