/**
 * @pseudopilot/translator — bidirectional Cambridge ↔ Python via canonical IR.
 *
 * Supported: assignment, INPUT/OUTPUT, IF/ELSE/ELSE IF, WHILE/ENDWHILE,
 * REPEAT/UNTIL, FOR/TO/STEP/NEXT, CASE OF/OTHERWISE/ENDCASE,
 * PROCEDURE/CALL, FUNCTION/RETURNS/RETURN, expression calls, DECLARE,
 * CONSTANT, literals, variables, arithmetic / relational / logical
 * expressions, CHAR, array indexes, Core builtins, text file I/O,
 * TYPE/ENDTYPE records, CLASS/ENDCLASS (incl. inheritance) — both directions.
 * Not supported: BYREF, RANDOM files, general Python (lambda, async, with, …).
 *
 * @see docs/language/TRANSLATION.md
 * @see docs/adr/0006-canonical-ir-translation.md
 */

export const PACKAGE_NAME = '@pseudopilot/translator' as const;
export const PACKAGE_VERSION = '0.14.0' as const;
export const TRANSLATOR_SUBSET =
  'v14-assign-io-expr-control-procedure-function-declare-check-builtins-files-type-class' as const;

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
  IrTypeReference,
  IrScalarType,
  IrArrayType,
  IrArrayDimension,
  IrDeclareStatement,
  IrConstantStatement,
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
  IrVisibility,
  IrClassProperty,
  IrClassProcedure,
  IrClassFunction,
  IrClassMember,
  IrClassDeclaration,
  IrExpressionStatement,
  IrSuperExpression,
  IrNewExpression,
  IrMethodCallExpression,
} from './ir/nodes.js';

export { emptyTrivia, withEmptyTrivia } from './ir/nodes.js';
