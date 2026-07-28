/**
 * @pseudopilot/translator — bidirectional Cambridge ↔ Python via canonical IR.
 *
 * Supported: assignment, INPUT/OUTPUT, IF/ELSE/ELSE IF, WHILE/ENDWHILE,
 * REPEAT/UNTIL, FOR/TO/STEP/NEXT, CASE OF/OTHERWISE/ENDCASE,
 * PROCEDURE/CALL, FUNCTION/RETURNS/RETURN, expression calls, DECLARE,
 * CONSTANT, literals, variables, arithmetic / relational / logical
 * expressions, CHAR, array indexes, Core builtins, text file I/O.
 * Not supported: BYREF, RANDOM files.
 *
 * @see docs/language/TRANSLATION.md
 * @see docs/adr/0006-canonical-ir-translation.md
 */

export const PACKAGE_NAME = '@pseudopilot/translator' as const;
export const PACKAGE_VERSION = '0.12.0' as const;
export const TRANSLATOR_SUBSET =
  'v12-assign-io-expr-control-procedure-function-declare-check-builtins-files' as const;

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
} from './ir/nodes.js';

export { emptyTrivia, withEmptyTrivia } from './ir/nodes.js';
