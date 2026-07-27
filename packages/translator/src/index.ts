/**
 * @pseudopilot/translator — bidirectional Cambridge ↔ Python via canonical IR.
 *
 * Supported: assignment, INPUT/OUTPUT, IF/ELSE/ELSE IF, WHILE/ENDWHILE,
 * REPEAT/UNTIL, literals, variables, arithmetic / relational / logical
 * expressions, CHAR, array indexes.
 * Not supported: CASE, FOR, DECLARE, routines, files, builtins.
 *
 * @see docs/language/TRANSLATION.md
 * @see docs/adr/0006-canonical-ir-translation.md
 */

export const PACKAGE_NAME = '@pseudopilot/translator' as const;
export const PACKAGE_VERSION = '0.4.0-repeat' as const;
export const TRANSLATOR_SUBSET = 'v4-assign-io-expr-if-while-repeat' as const;

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
