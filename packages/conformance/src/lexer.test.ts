import { describe, expect, it } from 'vitest';
import { lex, TokenKind } from '@pseudopilot/language-core';
import { CORPUS } from './corpus/index.js';

describe('conformance / lexer', () => {
  it('lexes every clean corpus program without throwing', () => {
    for (const entry of CORPUS) {
      if (entry.expectClean === false) continue;
      const { tokens, diagnostics } = lex(entry.source);
      expect(diagnostics.filter((d) => d.severity === 'error'), entry.id).toEqual(
        [],
      );
      expect(tokens.length, entry.id).toBeGreaterThan(0);
      expect(tokens.at(-1)?.kind, entry.id).toBe(TokenKind.Eof);
    }
  });

  it('lexes keywords case-insensitively', () => {
    const a = lex('declare x : integer\n').tokens.map((t) => t.kind);
    const b = lex('DECLARE X : INTEGER\n').tokens.map((t) => t.kind);
    expect(a).toEqual(b);
  });

  it('lexes both assignment arrow forms', () => {
    expect(lex('A ← 1\n').tokens.map((t) => t.kind)).toContain(TokenKind.Assign);
    expect(lex('A <- 1\n').tokens.map((t) => t.kind)).toContain(TokenKind.Assign);
  });
});
