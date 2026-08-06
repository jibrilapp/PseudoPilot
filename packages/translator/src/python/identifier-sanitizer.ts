/**
 * Deterministic Cambridge → Python identifier sanitization.
 *
 * IR keeps Cambridge names. The Python printer runs every emitted user
 * identifier through {@link sanitizePythonIdentifier}; the Python parser
 * recovers Cambridge names via {@link unsanitizePythonIdentifier}.
 *
 * Policy: if `name` is a Python keyword or builtin, append a single `_`.
 * Non-colliding names are unchanged. The mapping is deterministic and stable.
 *
 * Reverse: if `name` ends with `_` and the stem is reserved, strip one `_`.
 * Edge cases (documented in TRANSLATION.md):
 * - Cambridge `list_` round-trips imperfectly (`list_` → `list_` → reverse `list`).
 * - Translator `_pp_*` helpers are not reserved; a Cambridge id equal to a
 *   helper name (e.g. `_pp_cell`) is left unchanged and may collide — avoid.
 */

/** Soft/hard keywords that make `def name` / `name =` / `class name` invalid (3.10+). */
const PYTHON_KEYWORDS: ReadonlySet<string> = new Set([
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

/**
 * Python builtins (and a few stdlib names the translator binds) that must not
 * be shadowed by emitted user identifiers.
 */
const PYTHON_BUILTINS: ReadonlySet<string> = new Set([
  // Core builtins commonly used in teaching / by PseudoPilot emit
  'abs',
  'aiter',
  'all',
  'anext',
  'any',
  'ascii',
  'bin',
  'bool',
  'breakpoint',
  'bytearray',
  'bytes',
  'callable',
  'chr',
  'classmethod',
  'compile',
  'complex',
  'delattr',
  'dict',
  'dir',
  'divmod',
  'enumerate',
  'eval',
  'exec',
  'filter',
  'float',
  'format',
  'frozenset',
  'getattr',
  'globals',
  'hasattr',
  'hash',
  'help',
  'hex',
  'id',
  'input',
  'int',
  'isinstance',
  'issubclass',
  'iter',
  'len',
  'list',
  'locals',
  'map',
  'max',
  'memoryview',
  'min',
  'next',
  'object',
  'oct',
  'open',
  'ord',
  'pow',
  'print',
  'property',
  'range',
  'repr',
  'reversed',
  'round',
  'set',
  'setattr',
  'slice',
  'sorted',
  'staticmethod',
  'str',
  'sum',
  'super',
  'tuple',
  'type',
  'vars',
  'zip',
  '__import__',
  // Exception hierarchy (common names students might reuse)
  'BaseException',
  'Exception',
  'ArithmeticError',
  'AssertionError',
  'AttributeError',
  'EOFError',
  'ImportError',
  'IndexError',
  'KeyError',
  'KeyboardInterrupt',
  'LookupError',
  'MemoryError',
  'NameError',
  'NotImplementedError',
  'OSError',
  'OverflowError',
  'RuntimeError',
  'StopIteration',
  'SyntaxError',
  'SystemError',
  'SystemExit',
  'TypeError',
  'ValueError',
  'ZeroDivisionError',
  'Warning',
  'UserWarning',
  'DeprecationWarning',
  // Legacy / informal
  'file',
  // Names the translator imports or binds at module scope
  'copy',
  'random',
  'date',
  'dataclass',
  'field',
]);

/** True when `name` must not appear as a raw Python user identifier. */
export function isPythonReservedIdentifier(name: string): boolean {
  return PYTHON_KEYWORDS.has(name) || PYTHON_BUILTINS.has(name);
}

/** @deprecated Prefer {@link isPythonReservedIdentifier}; kept for call sites that only care about syntax keywords. */
export function isPythonSyntaxKeyword(name: string): boolean {
  return PYTHON_KEYWORDS.has(name);
}

/** Builtins PseudoPilot itself emits most often (OUTPUT / INPUT / FOR). */
export function isPythonTranslatorBuiltin(name: string): boolean {
  return name === 'print' || name === 'input' || name === 'range';
}

/**
 * Map a Cambridge (IR) identifier to a safe Python identifier.
 * Deterministic: reserved names get a single trailing `_`; others unchanged.
 */
export function sanitizePythonIdentifier(name: string): string {
  if (name.length === 0) return name;
  if (isPythonReservedIdentifier(name)) return `${name}_`;
  return name;
}

/**
 * Recover a Cambridge identifier from a PseudoPilot-emitted Python name.
 * Strips one trailing `_` only when the stem is reserved (i.e. when
 * `sanitizePythonIdentifier(stem) === name`).
 */
export function unsanitizePythonIdentifier(name: string): string {
  if (name.length > 1 && name.endsWith('_')) {
    const stem = name.slice(0, -1);
    if (isPythonReservedIdentifier(stem)) return stem;
  }
  return name;
}
