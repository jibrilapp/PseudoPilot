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

export type IrStatement = IrAssignment | IrInput | IrOutput | IrIfStatement;

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
