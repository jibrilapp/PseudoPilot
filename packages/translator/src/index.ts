/**
 * @pseudopilot/translator — bidirectional Cambridge ↔ Python via canonical IR.
 *
 * V1 supports: assignment, INPUT/OUTPUT, literals, variables, arithmetic /
 * relational / logical expressions. No IF/loops/routines/arrays/files.
 *
 * @see docs/language/TRANSLATION.md
 * @see docs/adr/0006-canonical-ir-translation.md
 */

export const PACKAGE_NAME = '@pseudopilot/translator' as const;
export const PACKAGE_VERSION = '0.1.0-v1' as const;
export const TRANSLATOR_SUBSET = 'v1-assign-io-expr' as const;

export {
  translatePseudocodeToPython,
  translatePythonToPseudocode,
} from './pipeline/translate.js';

export type {
  TranslateOptions,
  TranslateResult,
  TranslateDiagnostic,
  AssignmentArrow,
} from './types.js';

export type {
  IrProgram,
  IrStatement,
  IrExpression,
  IrTrivia,
  IrBinaryOp,
  IrUnaryOp,
} from './ir/nodes.js';
