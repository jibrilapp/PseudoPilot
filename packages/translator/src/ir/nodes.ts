/**
 * Canonical Intermediate Representation (V1).
 *
 * Language-neutral program model for bidirectional translation.
 * See docs/language/TRANSLATION.md and ADR 0006.
 */

export type IrTrivia =
  | { readonly kind: 'Comment'; readonly text: string }
  | { readonly kind: 'BlankLine' };

export type IrProgram = {
  readonly kind: 'IrProgram';
  readonly body: IrStatement[];
  readonly leadingTrivia: IrTrivia[];
  readonly trailingTrivia: IrTrivia[];
};

export type IrStatement =
  | IrAssignment
  | IrInput
  | IrOutput
  | IrIfStatement
  | IrCaseStatement
  | IrWhileStatement
  | IrRepeatStatement
  | IrForStatement
  | IrProcedureDeclaration
  | IrCallStatement
  | IrBreakStatement;

type WithTrivia = {
  readonly leadingTrivia: IrTrivia[];
  readonly trailingTrivia: IrTrivia[];
};

/** Identifier or array element (Scores[1]). */
export type IrAssignTarget = IrIdentifier | IrIndexExpression;

/** x ← value / x = value */
export type IrAssignment = WithTrivia & {
  readonly kind: 'IrAssignment';
  readonly target: IrAssignTarget;
  readonly value: IrExpression;
};

/** INPUT x / x = input() */
export type IrInput = WithTrivia & {
  readonly kind: 'IrInput';
  readonly target: IrAssignTarget;
  /** Optional prompt expression (from Python input(prompt)). */
  readonly prompt: IrExpression | null;
};

/** OUTPUT a, b / print(a, b) */
export type IrOutput = WithTrivia & {
  readonly kind: 'IrOutput';
  readonly values: IrExpression[];
};

/** IF / ELSE IF / ELSE — maps to Python if / elif / else. */
export type IrIfStatement = WithTrivia & {
  readonly kind: 'IrIfStatement';
  readonly condition: IrExpression;
  readonly consequent: IrStatement[];
  readonly elseIfClauses: IrElseIfClause[];
  readonly alternate: IrStatement[] | null;
};

export type IrElseIfClause = {
  readonly kind: 'IrElseIfClause';
  readonly condition: IrExpression;
  readonly consequent: IrStatement[];
};

/** Value arm or inclusive `low TO high` range arm. */
export type IrCaseLabel =
  | { readonly kind: 'IrCaseValue'; readonly value: IrExpression }
  | {
      readonly kind: 'IrCaseRange';
      readonly low: IrExpression;
      readonly high: IrExpression;
    };

export type IrCaseArm = {
  readonly kind: 'IrCaseArm';
  readonly label: IrCaseLabel;
  readonly body: IrStatement[];
};

/** CASE OF … ENDCASE — maps to Python match/case. */
export type IrCaseStatement = WithTrivia & {
  readonly kind: 'IrCaseStatement';
  readonly discriminant: IrExpression;
  readonly arms: IrCaseArm[];
  readonly otherwise: IrStatement[] | null;
};

/** WHILE … ENDWHILE — maps to Python while. */
export type IrWhileStatement = WithTrivia & {
  readonly kind: 'IrWhileStatement';
  readonly condition: IrExpression;
  readonly body: IrStatement[];
};

/** REPEAT … UNTIL — prints to `while True` + trailing `if cond: break`. */
export type IrRepeatStatement = WithTrivia & {
  readonly kind: 'IrRepeatStatement';
  readonly body: IrStatement[];
  readonly condition: IrExpression;
};

/** FOR <var> ← <start> TO <end> [STEP <step>] — maps to Python for…range. */
export type IrForStatement = WithTrivia & {
  readonly kind: 'IrForStatement';
  readonly variable: string;
  readonly start: IrExpression;
  readonly end: IrExpression;
  readonly step: IrExpression | null;
  readonly body: IrStatement[];
};

/** Cambridge scalar type names on procedure parameters. */
export type IrTypeName = 'INTEGER' | 'REAL' | 'STRING' | 'BOOLEAN' | 'CHAR';

export type IrParameter = {
  readonly kind: 'IrParameter';
  readonly name: string;
  readonly typeName: IrTypeName;
};

/** PROCEDURE … ENDPROCEDURE — maps to Python def. */
export type IrProcedureDeclaration = WithTrivia & {
  readonly kind: 'IrProcedureDeclaration';
  readonly name: string;
  readonly parameters: IrParameter[];
  readonly body: IrStatement[];
};

/** CALL Name[(args)] — maps to Python Name(args) statement. */
export type IrCallStatement = WithTrivia & {
  readonly kind: 'IrCallStatement';
  readonly callee: string;
  readonly args: IrExpression[];
};

/** Internal-only for Python pattern recognition; not a Cambridge surface feature. */
export type IrBreakStatement = WithTrivia & {
  readonly kind: 'IrBreakStatement';
};

export type IrExpression =
  | IrIntegerLiteral
  | IrRealLiteral
  | IrStringLiteral
  | IrCharLiteral
  | IrBooleanLiteral
  | IrIdentifier
  | IrIndexExpression
  | IrUnaryExpression
  | IrBinaryExpression
  | IrGroupingExpression;

export type IrIntegerLiteral = {
  readonly kind: 'IrIntegerLiteral';
  readonly value: number;
};

export type IrRealLiteral = {
  readonly kind: 'IrRealLiteral';
  readonly value: number;
};

export type IrStringLiteral = {
  readonly kind: 'IrStringLiteral';
  readonly value: string;
};

/** Single character (Cambridge `'A'` / Python `'A'`). */
export type IrCharLiteral = {
  readonly kind: 'IrCharLiteral';
  readonly value: string;
};

export type IrBooleanLiteral = {
  readonly kind: 'IrBooleanLiteral';
  readonly value: boolean;
};

export type IrIdentifier = {
  readonly kind: 'IrIdentifier';
  readonly name: string;
};

/** Name[i, j] — Cambridge 1-based indices preserved as written. */
export type IrIndexExpression = {
  readonly kind: 'IrIndexExpression';
  readonly array: IrIdentifier;
  readonly indices: IrExpression[];
};

/** Canonical IR operators (Python-leaning surface; printers map to Cambridge). */
export type IrBinaryOp =
  | '+'
  | '-'
  | '*'
  | '/'
  | '//'
  | '%'
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'and'
  | 'or';

export type IrUnaryOp = '+' | '-' | 'not';

export type IrUnaryExpression = {
  readonly kind: 'IrUnaryExpression';
  readonly operator: IrUnaryOp;
  readonly argument: IrExpression;
};

export type IrBinaryExpression = {
  readonly kind: 'IrBinaryExpression';
  readonly operator: IrBinaryOp;
  readonly left: IrExpression;
  readonly right: IrExpression;
};

/** Explicit parentheses preserved from source where possible. */
export type IrGroupingExpression = {
  readonly kind: 'IrGroupingExpression';
  readonly expression: IrExpression;
};

export function emptyTrivia(): IrTrivia[] {
  return [];
}

export function withEmptyTrivia<T extends object>(
  node: T,
): T & WithTrivia {
  return {
    ...node,
    leadingTrivia: emptyTrivia(),
    trailingTrivia: emptyTrivia(),
  };
}
