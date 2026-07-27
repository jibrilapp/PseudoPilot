export enum PyTokenKind {
  Eof = 'Eof',
  Newline = 'Newline',
  Indent = 'Indent',
  Dedent = 'Dedent',
  Identifier = 'Identifier',
  Integer = 'Integer',
  Real = 'Real',
  String = 'String',
  Char = 'Char',
  True = 'True',
  False = 'False',
  And = 'And',
  Or = 'Or',
  Not = 'Not',
  Print = 'Print',
  Input = 'Input',
  If = 'If',
  Elif = 'Elif',
  Else = 'Else',
  While = 'While',
  For = 'For',
  In = 'In',
  Range = 'Range',
  Match = 'Match',
  Case = 'Case',
  Pass = 'Pass',
  Break = 'Break',
  Equal = 'Equal',
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
  LBracket = 'LBracket',
  RBracket = 'RBracket',
  Comma = 'Comma',
  Colon = 'Colon',
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
  ['if', PyTokenKind.If],
  ['elif', PyTokenKind.Elif],
  ['else', PyTokenKind.Else],
  ['while', PyTokenKind.While],
  ['for', PyTokenKind.For],
  ['in', PyTokenKind.In],
  ['range', PyTokenKind.Range],
  ['match', PyTokenKind.Match],
  ['case', PyTokenKind.Case],
  ['pass', PyTokenKind.Pass],
  ['break', PyTokenKind.Break],
]);

export type PyLexResult = {
  readonly tokens: PyToken[];
  readonly diagnostics: {
    message: string;
    line: number;
    column: number;
    code: string;
  }[];
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
 * Python subset lexer with INDENT / DEDENT for if/while blocks.
 * Still rejects tabs in indentation (spaces only).
 */
export function lexPython(source: string): PyLexResult {
  const tokens: PyToken[] = [];
  const diagnostics: PyLexResult['diagnostics'] = [];
  let i = 0;
  let line = 1;
  let column = 1;
  const indentStack: number[] = [0];
  let atLineStart = true;

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

  const emit = (
    kind: PyTokenKind,
    lexeme: string,
    start: { line: number; column: number; offset: number },
  ) => {
    tokens.push({
      kind,
      lexeme,
      line: start.line,
      column: start.column,
      offset: start.offset,
    });
  };

  const pos = () => ({ line, column, offset: i });

  while (i < source.length) {
    if (atLineStart) {
      atLineStart = false;
      const start = pos();
      let indent = 0;
      while (at() === ' ') {
        indent += 1;
        advance();
      }
      if (at() === '\t') {
        diagnostics.push({
          message: 'Tabs are not allowed for indentation in the Python subset.',
          line,
          column,
          code: 'T_PY_TAB',
        });
        while (at() === '\t' || at() === ' ') advance();
      }

      // Blank or comment-only line: do not change indent stack
      if (at() === '\n' || at() === '' || at() === '#') {
        if (at() === '#') {
          while (i < source.length && at() !== '\n') advance();
        }
        if (at() === '\n') {
          advance();
          atLineStart = true;
        }
        continue;
      }

      const current = indentStack[indentStack.length - 1]!;
      if (indent > current) {
        indentStack.push(indent);
        emit(PyTokenKind.Indent, '', start);
      } else {
        while (indent < indentStack[indentStack.length - 1]!) {
          indentStack.pop();
          emit(PyTokenKind.Dedent, '', start);
        }
        if (indent !== indentStack[indentStack.length - 1]) {
          diagnostics.push({
            message: 'Inconsistent indentation.',
            line: start.line,
            column: start.column,
            code: 'T_PY_INDENT',
          });
        }
      }
    }

    const ch = at();
    if (ch === '') break;

    if (ch === '#') {
      while (i < source.length && at() !== '\n') advance();
      continue;
    }

    if (ch === ' ' || ch === '\t' || ch === '\r') {
      advance();
      continue;
    }

    if (ch === '\n') {
      const start = pos();
      advance();
      emit(PyTokenKind.Newline, '\n', start);
      atLineStart = true;
      continue;
    }

    const start = pos();

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
    if (ch === '[') {
      advance();
      emit(PyTokenKind.LBracket, '[', start);
      continue;
    }
    if (ch === ']') {
      advance();
      emit(PyTokenKind.RBracket, ']', start);
      continue;
    }
    if (ch === ',') {
      advance();
      emit(PyTokenKind.Comma, ',', start);
      continue;
    }
    if (ch === ':') {
      advance();
      emit(PyTokenKind.Colon, ':', start);
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
      if (quote === "'" && value.length === 1) {
        emit(PyTokenKind.Char, value, start);
      } else {
        emit(PyTokenKind.String, value, start);
      }
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

  // Close remaining indents at EOF
  const end = pos();
  while (indentStack.length > 1) {
    indentStack.pop();
    emit(PyTokenKind.Dedent, '', end);
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
