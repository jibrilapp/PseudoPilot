import type { Program } from './ast/nodes.js';
import { pos, span, type Diagnostic } from './diagnostics.js';
import { lex } from './lexer/lexer.js';
import { Parser } from './parser/parser.js';

/** Default per-call source budget (UTF-16 code units). */
export const DEFAULT_MAX_SOURCE_CHARS = 256_000;

/** Hard ceiling for {@link ParseOptions.maxSourceChars}. */
export const ABSOLUTE_MAX_SOURCE_CHARS = 2_000_000;

export type ParseOptions = {
  /**
   * Reject sources longer than this many UTF-16 code units.
   * Default: {@link DEFAULT_MAX_SOURCE_CHARS}. Capped by {@link ABSOLUTE_MAX_SOURCE_CHARS}.
   */
  readonly maxSourceChars?: number;
};

export type ParseResult = {
  readonly ast: Program;
  readonly diagnostics: Diagnostic[];
  /** True when there are no error-severity diagnostics. */
  readonly ok: boolean;
};

function emptyProgram(): Program {
  return {
    kind: 'Program',
    body: [],
    span: span(pos(0, 1, 1), pos(0, 1, 1)),
  };
}

/**
 * Lex then parse Cambridge pseudocode source into an AST.
 *
 * @experimental Public surface for 0.x; options may expand before 1.0.
 */
export function parse(source: string, options?: ParseOptions): ParseResult {
  const requested = options?.maxSourceChars ?? DEFAULT_MAX_SOURCE_CHARS;
  const maxSourceChars = Math.min(
    Math.max(0, requested),
    ABSOLUTE_MAX_SOURCE_CHARS,
  );

  if (source.length > maxSourceChars) {
    const end = pos(source.length, 1, 1);
    return {
      ast: emptyProgram(),
      ok: false,
      diagnostics: [
        {
          severity: 'error',
          code: 'P_SOURCE_TOO_LARGE',
          message: `Source is ${source.length} characters; limit is ${maxSourceChars}.`,
          span: span(pos(0, 1, 1), end),
        },
      ],
    };
  }

  const lexed = lex(source);
  const diagnostics: Diagnostic[] = [...lexed.diagnostics];
  const parser = new Parser(lexed.tokens, diagnostics);
  const ast = parser.parseProgram();
  const ok = !diagnostics.some((d) => d.severity === 'error');
  return { ast, diagnostics, ok };
}
