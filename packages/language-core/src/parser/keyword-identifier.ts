import { TokenKind, type Token } from '../lexer/token.js';

/**
 * Cambridge exam presentation: reserved words appear in UPPERCASE; variable names
 * use mixed/lowercase. A spelling that is not all-uppercase is an identifier even
 * when it case-folds to a statement keyword (e.g. `output` vs `OUTPUT`).
 */
export function isIdentifierSpelling(lexeme: string): boolean {
  return lexeme !== lexeme.toUpperCase();
}

/** INPUT/OUTPUT lexemes that are identifier spellings, not statement keywords. */
export function isIoKeywordUsableAsIdentifier(token: Token): boolean {
  return (
    (token.kind === TokenKind.Input || token.kind === TokenKind.Output) &&
    isIdentifierSpelling(token.lexeme)
  );
}
