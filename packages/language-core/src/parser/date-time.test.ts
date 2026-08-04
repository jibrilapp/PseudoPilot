import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import { TokenKind } from '../lexer/token.js';
import { lex } from '../lexer/lexer.js';
import type { DateLiteral } from '../ast/nodes.js';

describe('DATE type', () => {
  it('lexes DATE as a type keyword', () => {
    const { tokens } = lex('DECLARE D : DATE\n');
    expect(tokens.some((t) => t.kind === TokenKind.TypeDate)).toBe(true);
  });

  it('does not treat TIME as a type keyword', () => {
    const { tokens } = lex('DECLARE T : TIME\n');
    expect(tokens.some((t) => t.kind === TokenKind.TypeDate)).toBe(false);
    expect(tokens.some((t) => t.kind === TokenKind.Identifier && t.lexeme.toUpperCase() === 'TIME')).toBe(
      true,
    );
  });

  it('lexes dd/mm/yyyy as a DATE literal (not division)', () => {
    const { tokens, diagnostics } = lex('OUTPUT 04/10/2003\n');
    expect(diagnostics).toEqual([]);
    expect(tokens.some((t) => t.kind === TokenKind.Date && t.lexeme === '04/10/2003')).toBe(
      true,
    );
  });

  it('parses DECLARE / ARRAY / FUNCTION RETURNS with DATE', () => {
    const result = parse(`
DECLARE D : DATE
DECLARE Days : ARRAY[1:3] OF DATE
FUNCTION Make(D : DATE) RETURNS DATE
  RETURN D
ENDFUNCTION
`);
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
  });

  it('parses DATE literals', () => {
    const result = parse(`
DECLARE D : DATE
D ← 04/10/2003
`);
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
    const assigns = result.ast.body.filter((s) => s.kind === 'AssignmentStatement');
    const dLit = (assigns[0] as { value: DateLiteral }).value;
    expect(dLit).toMatchObject({ kind: 'DateLiteral', day: 4, month: 10, year: 2003 });
  });

  it('parses TYPE fields and CLASS properties of DATE', () => {
    const result = parse(`
TYPE Event
  DECLARE When : DATE
ENDTYPE
CLASS Alarm
  PRIVATE Ring : DATE
  PUBLIC PROCEDURE NEW(D : DATE)
    Ring ← D
  ENDPROCEDURE
ENDCLASS
`);
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
  });

  it('rejects invalid DATE literals', () => {
    const { diagnostics } = lex('OUTPUT 31/02/2003\n');
    expect(diagnostics.some((d) => d.code === 'E_DATE_LITERAL')).toBe(true);
  });
});
