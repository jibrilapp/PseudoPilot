import type { Diagnostic } from '../diagnostics.js';
import { TokenKind, type Token } from '../lexer/token.js';

/**
 * Shared read head over a token stream.
 * One cursor is owned by the statement parser and passed into the expression
 * parser so indexes never drift out of sync (a common hybrid-parser bug).
 */
export class TokenCursor {
  readonly tokens: Token[];
  index: number;

  constructor(tokens: Token[], index = 0) {
    this.tokens = tokens;
    this.index = index;
  }

  peek(offset = 0): Token {
    const i = this.index + offset;
    if (i < 0) return this.tokens[0]!;
    if (i >= this.tokens.length) return this.tokens[this.tokens.length - 1]!;
    return this.tokens[i]!;
  }

  previous(): Token {
    return this.tokens[Math.max(0, this.index - 1)]!;
  }

  check(...kinds: TokenKind[]): boolean {
    return kinds.includes(this.peek().kind);
  }

  match(...kinds: TokenKind[]): boolean {
    if (this.check(...kinds)) {
      this.advance();
      return true;
    }
    return false;
  }

  advance(): Token {
    const token = this.peek();
    if (token.kind !== TokenKind.Eof) this.index += 1;
    return token;
  }

  isAtEnd(): boolean {
    return this.peek().kind === TokenKind.Eof;
  }

  /**
   * Tokens that always end an expression in this dialect (statement boundary).
   * Extended as IF/THEN arrive — shared so Pratt and statements agree.
   */
  isExpressionTerminator(): boolean {
    const kind = this.peek().kind;
    return (
      kind === TokenKind.Newline ||
      kind === TokenKind.Eof ||
      kind === TokenKind.Comma ||
      kind === TokenKind.RParen ||
      kind === TokenKind.RBracket ||
      kind === TokenKind.Assign ||
      kind === TokenKind.Then ||
      kind === TokenKind.Else ||
      kind === TokenKind.Endif ||
      kind === TokenKind.Endprocedure ||
      kind === TokenKind.Endfunction ||
      kind === TokenKind.Returns ||
      kind === TokenKind.Colon ||
      kind === TokenKind.Of
    );
  }
}

export function pushError(
  diagnostics: Diagnostic[],
  message: string,
  token: Token,
  code = 'E_PARSE',
): void {
  diagnostics.push({
    severity: 'error',
    message,
    span: token.span,
    code,
  });
}
