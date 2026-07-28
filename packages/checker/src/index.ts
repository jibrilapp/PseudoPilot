/**
 * @pseudopilot/checker — Cambridge 9618 semantic analysis.
 *
 * Pipeline position:
 *   Lexer → Parser → AST → **Semantic Checker** → Interpreter
 *                                      ↘ IR → Translator
 *
 * Language rules only. Python-target constraints stay in `@pseudopilot/translator`.
 */

export const PACKAGE_NAME = '@pseudopilot/checker' as const;
export const PACKAGE_VERSION = '0.10.0' as const;

export { check } from './check.js';
export type {
  CheckOptions,
  CheckResult,
  CheckerDiagnostic,
  CheckerSeverity,
  PpType,
  ScalarTypeName,
  SymbolInfo,
  SymbolKind,
} from './types.js';
export { DEFAULT_MAX_CHECKER_DIAGNOSTICS } from './types.js';
export {
  formatType,
  isAssignable,
  typeFromTypeRef,
  scalar,
} from './type-system.js';
export { Scope, makeSymbol, identKey, lookupSymbol } from './scope.js';
