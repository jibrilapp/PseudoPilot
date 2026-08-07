import type { Program } from './ast/nodes.js';
import { pos, span, type Diagnostic } from './diagnostics.js';
import { lex } from './lexer/lexer.js';
import {
  DEFAULT_MAX_BLOCK_NESTING,
  P_NESTING_TOO_DEEP,
  Parser,
} from './parser/parser.js';

/** Default per-call source budget (UTF-16 code units). */
export const DEFAULT_MAX_SOURCE_CHARS = 256_000;

/** Hard ceiling for {@link ParseOptions.maxSourceChars}. */
export const ABSOLUTE_MAX_SOURCE_CHARS = 2_000_000;

export { DEFAULT_MAX_BLOCK_NESTING, P_NESTING_TOO_DEEP };

export type ParseOptions = {
  /**
   * Reject sources longer than this many UTF-16 code units.
   * Default: {@link DEFAULT_MAX_SOURCE_CHARS}. Capped by {@link ABSOLUTE_MAX_SOURCE_CHARS}.
   */
  readonly maxSourceChars?: number;
  /**
   * Enforce Cambridge real-literal digit-both-sides rule as errors
   * (`.5` / `5.`). Default: accept with `W_REAL_LITERAL` warning.
   */
  readonly strictCambridge?: boolean;
  /**
   * Max nested IF/WHILE/REPEAT/FOR/CASE block depth.
   * Default: {@link DEFAULT_MAX_BLOCK_NESTING}.
   */
  readonly maxBlockNesting?: number;
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

  try {
    const lexed = lex(
      source,
      options?.strictCambridge !== undefined
        ? { strictCambridge: options.strictCambridge }
        : undefined,
    );
    const diagnostics: Diagnostic[] = [...lexed.diagnostics];
    const maxBlockNesting =
      options?.maxBlockNesting ?? DEFAULT_MAX_BLOCK_NESTING;
    const parser = new Parser(lexed.tokens, diagnostics, maxBlockNesting);
    const ast = parser.parseProgram();
    const ok = !diagnostics.some((d) => d.severity === 'error');
    return { ast, diagnostics, ok };
  } catch (err) {
    // Pathological nesting / expression depth can still overflow the JS stack
    // on some engines; never let that escape as an uncaught exception.
    if (err instanceof RangeError) {
      return {
        ast: emptyProgram(),
        ok: false,
        diagnostics: [
          {
            severity: 'error',
            code: P_NESTING_TOO_DEEP,
            message:
              'Source nesting is too deep to parse (call stack exhausted). Simplify nested IF/WHILE/CASE structures.',
            span: span(pos(0, 1, 1), pos(0, 1, 1)),
          },
        ],
      };
    }
    throw err;
  }
}
