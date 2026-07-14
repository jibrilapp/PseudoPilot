import { describe, expect, it } from 'vitest';
import { lex } from './lexer.js';
import { TokenKind } from './token.js';

describe('lexer', () => {
  it('tokenizes identifiers and assignment arrows', () => {
    const { tokens, diagnostics } = lex('Count ← 10');
    expect(diagnostics).toEqual([]);
    expect(tokens.map((t) => t.kind)).toEqual([
      TokenKind.Identifier,
      TokenKind.Assign,
      TokenKind.Integer,
      TokenKind.Eof,
    ]);
    expect(tokens[0]?.lexeme).toBe('Count');
    expect(tokens[2]?.literal).toBe(10);
  });

  it('accepts ASCII <- as assign', () => {
    const { tokens } = lex('X <- 1');
    expect(tokens.map((t) => t.kind)).toContain(TokenKind.Assign);
    expect(tokens.find((t) => t.kind === TokenKind.Assign)?.lexeme).toBe('<-');
  });

  it('skips line comments', () => {
    const { tokens, diagnostics } = lex('// ignore me\nX ← 1');
    expect(diagnostics).toEqual([]);
    expect(tokens.map((t) => t.kind)).toEqual([
      TokenKind.Newline,
      TokenKind.Identifier,
      TokenKind.Assign,
      TokenKind.Integer,
      TokenKind.Eof,
    ]);
  });

  it('skips end-of-line comments', () => {
    const { tokens } = lex('X ← 1 // trailing');
    expect(tokens.map((t) => t.kind)).toEqual([
      TokenKind.Identifier,
      TokenKind.Assign,
      TokenKind.Integer,
      TokenKind.Eof,
    ]);
  });

  it('lexes integers, reals, strings, booleans', () => {
    const { tokens, diagnostics } = lex('42 3.14 "hi" TRUE FALSE');
    expect(diagnostics).toEqual([]);
    expect(tokens[0]).toMatchObject({ kind: TokenKind.Integer, literal: 42 });
    expect(tokens[1]).toMatchObject({ kind: TokenKind.Real, literal: 3.14 });
    expect(tokens[2]).toMatchObject({ kind: TokenKind.String, literal: 'hi' });
    expect(tokens[3]).toMatchObject({ kind: TokenKind.Boolean, literal: true });
    expect(tokens[4]).toMatchObject({ kind: TokenKind.Boolean, literal: false });
  });

  it('lexes DIV and MOD as keywords', () => {
    const { tokens } = lex('a DIV b MOD c');
    expect(tokens.map((t) => t.kind)).toEqual([
      TokenKind.Identifier,
      TokenKind.Div,
      TokenKind.Identifier,
      TokenKind.Mod,
      TokenKind.Identifier,
      TokenKind.Eof,
    ]);
  });

  it('lexes INPUT and OUTPUT', () => {
    const { tokens } = lex('INPUT Name\nOUTPUT Name');
    expect(tokens.map((t) => t.kind)).toEqual([
      TokenKind.Input,
      TokenKind.Identifier,
      TokenKind.Newline,
      TokenKind.Output,
      TokenKind.Identifier,
      TokenKind.Eof,
    ]);
  });

  it('reports unterminated strings', () => {
    const { diagnostics } = lex('"oops');
    expect(diagnostics.some((d) => d.code === 'E_STRING')).toBe(true);
  });

  it('reports unexpected characters', () => {
    const { diagnostics } = lex('X ← @');
    expect(diagnostics.some((d) => d.code === 'E_CHAR')).toBe(true);
  });

  it('tracks line and column positions', () => {
    const { tokens } = lex('A ← 1\nB ← 2');
    const b = tokens.find((t) => t.lexeme === 'B');
    expect(b?.span.start.line).toBe(2);
    expect(b?.span.start.column).toBe(1);
  });
});
