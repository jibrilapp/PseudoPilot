import { type Diagnostic, type Position, pos, span } from '../diagnostics.js';
import { keywordKind, TokenKind, type Token } from './token.js';

export type LexOptions = {
  /**
   * When true, Cambridge real-literal strictness is enforced as errors
   * (leading/trailing-dot forms like `.5` / `5.`). Default: warn only.
   */
  readonly strictCambridge?: boolean;
};

export type LexResult = {
  readonly tokens: Token[];
  readonly diagnostics: Diagnostic[];
};

/**
 * Hand-written lexer: source text → tokens.
 * Skips spaces/tabs and `//` line comments. Newlines become significant tokens
 * so the parser can treat them as statement separators (Cambridge style).
 */
export function lex(source: string, options?: LexOptions): LexResult {
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];
  const strictCambridge = options?.strictCambridge === true;
  let i = 0;
  let line = 1;
  let column = 1;

  const at = (): string => source[i] ?? '';
  const peek = (n = 1): string => source[i + n] ?? '';

  const currentPos = (): Position => pos(i, line, column);

  const advance = (): string => {
    const ch = source[i] ?? '';
    i += 1;
    if (ch === '\n') {
      line += 1;
      column = 1;
    } else if (ch !== '') {
      column += 1;
    }
    return ch;
  };

  const emit = (
    kind: TokenKind,
    start: Position,
    lexeme: string,
    literal?: string | number | boolean,
  ): void => {
    tokens.push({
      kind,
      lexeme,
      span: span(start, currentPos()),
      ...(literal !== undefined ? { literal } : {}),
    });
  };

  const error = (message: string, start: Position, code: string): void => {
    diagnostics.push({
      severity: 'error',
      message,
      span: span(start, currentPos()),
      code,
    });
  };

  while (i < source.length) {
    const ch = at();

    // Whitespace (not newline)
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      advance();
      continue;
    }

    // Line comment
    if (ch === '/' && peek() === '/') {
      while (i < source.length && at() !== '\n') advance();
      continue;
    }

    if (ch === '\n') {
      const start = currentPos();
      advance();
      emit(TokenKind.Newline, start, '\n');
      continue;
    }

    // Assignment ← or <-  (must be before bare '<')
    if (ch === '←') {
      const start = currentPos();
      advance();
      emit(TokenKind.Assign, start, '←');
      continue;
    }
    if (ch === '<' && peek() === '-') {
      const start = currentPos();
      advance();
      advance();
      emit(TokenKind.Assign, start, '<-');
      continue;
    }
    if (ch === '<' && peek() === '>') {
      const start = currentPos();
      advance();
      advance();
      emit(TokenKind.NotEqual, start, '<>');
      continue;
    }
    if (ch === '<' && peek() === '=') {
      const start = currentPos();
      advance();
      advance();
      emit(TokenKind.LessEqual, start, '<=');
      continue;
    }
    if (ch === '<') {
      const start = currentPos();
      advance();
      emit(TokenKind.Less, start, '<');
      continue;
    }
    if (ch === '>' && peek() === '=') {
      const start = currentPos();
      advance();
      advance();
      emit(TokenKind.GreaterEqual, start, '>=');
      continue;
    }
    if (ch === '>') {
      const start = currentPos();
      advance();
      emit(TokenKind.Greater, start, '>');
      continue;
    }
    if (ch === '=') {
      const start = currentPos();
      advance();
      emit(TokenKind.Equal, start, '=');
      continue;
    }

    // Single-char tokens
    if (ch === '+') {
      const start = currentPos();
      advance();
      emit(TokenKind.Plus, start, '+');
      continue;
    }
    if (ch === '&') {
      const start = currentPos();
      advance();
      emit(TokenKind.Ampersand, start, '&');
      continue;
    }
    if (ch === '-') {
      const start = currentPos();
      advance();
      emit(TokenKind.Minus, start, '-');
      continue;
    }
    if (ch === '*') {
      const start = currentPos();
      advance();
      emit(TokenKind.Star, start, '*');
      continue;
    }
    if (ch === '^') {
      const start = currentPos();
      advance();
      emit(TokenKind.Caret, start, '^');
      continue;
    }
    if (ch === '/') {
      const start = currentPos();
      advance();
      emit(TokenKind.Slash, start, '/');
      continue;
    }
    if (ch === '(') {
      const start = currentPos();
      advance();
      emit(TokenKind.LParen, start, '(');
      continue;
    }
    if (ch === ')') {
      const start = currentPos();
      advance();
      emit(TokenKind.RParen, start, ')');
      continue;
    }
    if (ch === '[') {
      const start = currentPos();
      advance();
      emit(TokenKind.LBracket, start, '[');
      continue;
    }
    if (ch === ']') {
      const start = currentPos();
      advance();
      emit(TokenKind.RBracket, start, ']');
      continue;
    }
    if (ch === ',') {
      const start = currentPos();
      advance();
      emit(TokenKind.Comma, start, ',');
      continue;
    }
    if (ch === ':') {
      const start = currentPos();
      advance();
      emit(TokenKind.Colon, start, ':');
      continue;
    }

    // String literal (double quotes)
    if (ch === '"') {
      const start = currentPos();
      advance(); // opening "
      let value = '';
      let closed = false;
      while (i < source.length) {
        const c = at();
        if (c === '\n') break;
        if (c === '"') {
          advance();
          closed = true;
          break;
        }
        if (c === '\\') {
          advance();
          const esc = at();
          if (esc === '"' || esc === '\\') {
            value += esc;
            advance();
          } else if (esc === 'n') {
            value += '\n';
            advance();
          } else if (esc === 't') {
            value += '\t';
            advance();
          } else {
            value += esc;
            if (esc) advance();
          }
          continue;
        }
        value += c;
        advance();
      }
      if (!closed) {
        error('Unterminated string literal.', start, 'E_STRING');
      }
      emit(TokenKind.String, start, source.slice(start.offset, i), value);
      continue;
    }

    // CHAR literal (single quotes) — Cambridge Guide: 'A'
    if (ch === "'") {
      const start = currentPos();
      advance(); // opening '
      let value = '';
      let closed = false;
      while (i < source.length) {
        const c = at();
        if (c === '\n') break;
        if (c === "'") {
          advance();
          closed = true;
          break;
        }
        if (c === '\\') {
          advance();
          const esc = at();
          if (esc === "'" || esc === '\\') {
            value += esc;
            advance();
          } else if (esc === 'n') {
            value += '\n';
            advance();
          } else if (esc === 't') {
            value += '\t';
            advance();
          } else {
            value += esc;
            if (esc) advance();
          }
          continue;
        }
        value += c;
        advance();
      }
      if (!closed) {
        error('Unterminated character literal.', start, 'E_CHAR_LIT');
      } else if (value.length !== 1) {
        error(
          `Character literal must contain exactly one character (found ${value.length}).`,
          start,
          'E_CHAR_LEN',
        );
      }
      emit(TokenKind.Char, start, source.slice(start.offset, i), value);
      continue;
    }

    // Number: integer or real (including leading-dot `.5` and trailing-dot `5.`)
    if (isDigit(ch) || (ch === '.' && isDigit(peek()))) {
      const start = currentPos();
      let raw = '';
      let isReal = false;
      let leadingDot = false;
      let trailingDot = false;

      if (ch === '.') {
        // Leading-dot form `.5` — Cambridge prefers `0.5` (§2.2 / SPEC §13.9).
        leadingDot = true;
        isReal = true;
        raw += advance(); // .
        while (isDigit(at())) raw += advance();
      } else {
        while (isDigit(at())) {
          raw += advance();
        }
        if (at() === '.' && isDigit(peek())) {
          isReal = true;
          raw += advance();
          while (isDigit(at())) raw += advance();
        } else if (at() === '.' && !isDigit(peek()) && !isIdentStart(peek())) {
          // Trailing-dot form `5.` — Cambridge prefers `5.0`.
          trailingDot = true;
          isReal = true;
          raw += advance();
        }
      }

      // Reject glued forms like `2x` or `3.14foo` — common student typos.
      if (isIdentStart(at())) {
        error(
          `Missing operator or space between number '${raw}' and '${at()}'.`,
          start,
          'E_NUMBER_IDENT',
        );
        while (isIdentPart(at())) advance();
      }

      if (isReal) {
        if (leadingDot || trailingDot) {
          const normalized = leadingDot ? `0${raw}` : `${raw}0`;
          const severity = strictCambridge ? 'error' : 'warning';
          diagnostics.push({
            severity,
            message: `Real literal '${raw}' should have a digit on both sides of the decimal point (use '${normalized}').`,
            span: span(start, currentPos()),
            code: strictCambridge ? 'E_REAL_LITERAL' : 'W_REAL_LITERAL',
          });
        }
        emit(TokenKind.Real, start, raw, Number(leadingDot ? `0${raw}` : trailingDot ? `${raw}0` : raw));
        continue;
      }

      // Cambridge DATE literal dd/mm/yyyy (before emitting bare Integer).
      if (at() === '/' && isDigit(peek())) {
        const afterSlash = peekDateRest(source, i + 1);
        if (afterSlash) {
          raw += advance(); // /
          raw += afterSlash.monthRaw;
          for (let k = 0; k < afterSlash.monthRaw.length; k++) advance();
          raw += advance(); // /
          raw += afterSlash.yearRaw;
          for (let k = 0; k < afterSlash.yearRaw.length; k++) advance();
          const day = Number(raw.split('/')[0]);
          const month = Number(afterSlash.monthRaw);
          const year = Number(afterSlash.yearRaw);
          if (!isValidCalendarDate(day, month, year)) {
            error(
              `Invalid DATE literal '${raw}' (expected a valid calendar date dd/mm/yyyy).`,
              start,
              'E_DATE_LITERAL',
            );
          }
          emit(TokenKind.Date, start, raw);
          continue;
        }
      }

      const value = Number(raw);
      if (!Number.isSafeInteger(value)) {
        error(
          `Integer '${raw}' is outside the safe integer range for this runtime.`,
          start,
          'E_INT_RANGE',
        );
      }
      emit(TokenKind.Integer, start, raw, value);
      continue;
    }

    // Member access `.` (after number lexing so `.5` remains a real literal)
    if (ch === '.') {
      const start = currentPos();
      advance();
      emit(TokenKind.Dot, start, '.');
      continue;
    }

    // Identifier / keyword
    if (isIdentStart(ch)) {
      const start = currentPos();
      let raw = '';
      while (isIdentPart(at())) raw += advance();
      const kw = keywordKind(raw);
      if (kw === TokenKind.True) {
        emit(TokenKind.Boolean, start, raw, true);
      } else if (kw === TokenKind.False) {
        emit(TokenKind.Boolean, start, raw, false);
      } else if (kw) {
        emit(kw, start, raw);
      } else {
        emit(TokenKind.Identifier, start, raw);
      }
      continue;
    }

    const start = currentPos();
    const bad = advance();
    error(`Unexpected character '${bad}'.`, start, 'E_CHAR');
  }

  emit(TokenKind.Eof, currentPos(), '');
  return { tokens, diagnostics };
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isIdentStart(ch: string): boolean {
  return (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || ch === '_';
}

function isIdentPart(ch: string): boolean {
  return isIdentStart(ch) || isDigit(ch);
}

/** Peek `mm/yyyy` after the first `/` of a prospective DATE literal. */
function peekDateRest(
  source: string,
  start: number,
): { monthRaw: string; yearRaw: string } | null {
  let i = start;
  let monthRaw = '';
  while (i < source.length && isDigit(source[i]!)) {
    monthRaw += source[i]!;
    i += 1;
  }
  if (monthRaw.length < 1 || monthRaw.length > 2) return null;
  if (source[i] !== '/') return null;
  i += 1;
  let yearRaw = '';
  while (i < source.length && isDigit(source[i]!)) {
    yearRaw += source[i]!;
    i += 1;
  }
  if (yearRaw.length !== 4) return null;
  // Don't glue into an identifier (`2003x`).
  const next = source[i] ?? '';
  if (isIdentStart(next)) return null;
  return { monthRaw, yearRaw };
}

function isValidCalendarDate(day: number, month: number, year: number): boolean {
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}
