/**
 * @pseudopilot/translator — bidirectional Cambridge ↔ Python via canonical IR.
 *
 * Supported: assignment, INPUT/OUTPUT, IF/ELSE/ELSE IF, WHILE/ENDWHILE,
 * REPEAT/UNTIL, FOR/TO/STEP/NEXT, CASE OF/OTHERWISE/ENDCASE,
 * PROCEDURE/CALL, FUNCTION/RETURNS/RETURN, expression calls, literals,
 * variables, arithmetic / relational / logical expressions, CHAR, array indexes.
 * Not supported: DECLARE, BYREF, files, builtins.
 *
 * @see docs/language/TRANSLATION.md
 * @see docs/adr/0006-canonical-ir-translation.md
 */

export const PACKAGE_NAME = '@pseudopilot/translator' as const;
export const PACKAGE_VERSION = '0.8.0' as const;
export const TRANSLATOR_SUBSET =
  'v8-assign-io-expr-control-procedure-function' as const;

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

export {
  DEFAULT_MAX_SOURCE_CHARS,
  ABSOLUTE_MAX_SOURCE_CHARS,
} from './types.js';

export type { SourceSpan, Position } from '@pseudopilot/language-core';

export type {
  IrProgram,
  IrStatement,
  IrExpression,
  IrTrivia,
  IrBinaryOp,
  IrUnaryOp,
  IrAssignTarget,
  IrAssignment,
  IrInput,
  IrOutput,
  IrIfStatement,
  IrElseIfClause,
  IrCaseLabel,
  IrCaseArm,
  IrCaseStatement,
  IrWhileStatement,
  IrRepeatStatement,
  IrForStatement,
  IrTypeName,
  IrParameter,
  IrProcedureDeclaration,
  IrFunctionDeclaration,
  IrCallStatement,
  IrReturnStatement,
  IrBreakStatement,
  IrIntegerLiteral,
  IrRealLiteral,
  IrStringLiteral,
  IrCharLiteral,
  IrBooleanLiteral,
  IrIdentifier,
  IrIndexExpression,
  IrCallExpression,
  IrUnaryExpression,
  IrBinaryExpression,
  IrGroupingExpression,
} from './ir/nodes.js';

export { emptyTrivia, withEmptyTrivia } from './ir/nodes.js';
