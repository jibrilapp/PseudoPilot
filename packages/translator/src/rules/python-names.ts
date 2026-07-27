/**
 * Python identifier safety for PROCEDURE / CALL translation.
 * Soft/hard keywords that would make `def name(...):` or `name(...)` invalid.
 */

/** Words that make `def <name>` or parameter names a SyntaxError (3.10+). */
const PYTHON_SYNTAX_KEYWORDS: ReadonlySet<string> = new Set([
  'False',
  'None',
  'True',
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'match',
  'case',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'try',
  'while',
  'with',
  'yield',
]);

/** Builtins PseudoPilot itself emits; shadowing breaks student OUTPUT/INPUT/FOR. */
const PYTHON_TRANSLATOR_BUILTINS: ReadonlySet<string> = new Set([
  'print',
  'input',
  'range',
]);

export function isPythonSyntaxKeyword(name: string): boolean {
  return PYTHON_SYNTAX_KEYWORDS.has(name);
}

export function isPythonTranslatorBuiltin(name: string): boolean {
  return PYTHON_TRANSLATOR_BUILTINS.has(name);
}
