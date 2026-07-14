import type { Program } from './ast/nodes.js';
import type { Diagnostic } from './diagnostics.js';
import { lex } from './lexer/lexer.js';
import { Parser } from './parser/parser.js';

export type ParseResult = {
  readonly ast: Program;
  readonly diagnostics: Diagnostic[];
  /** True when there are no error-severity diagnostics. */
  readonly ok: boolean;
};

/**
 * Lex then parse Cambridge pseudocode source into an AST (Milestone 3 subset).
 */
export function parse(source: string): ParseResult {
  const lexed = lex(source);
  const diagnostics: Diagnostic[] = [...lexed.diagnostics];
  const parser = new Parser(lexed.tokens, diagnostics);
  const ast = parser.parseProgram();
  const ok = !diagnostics.some((d) => d.severity === 'error');
  return { ast, diagnostics, ok };
}
