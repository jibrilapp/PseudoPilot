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

export type IrStatement = IrAssignment | IrInput | IrOutput;

type WithTrivia = {
  readonly leadingTrivia: IrTrivia[];
  readonly trailingTrivia: IrTrivia[];
};

/** x ← value / x = value */
export type IrAssignment = WithTrivia & {
  readonly kind: 'IrAssignment';
  readonly target: IrIdentifier;
  readonly value: IrExpression;
};

/** INPUT x / x = input() */
export type IrInput = WithTrivia & {
  readonly kind: 'IrInput';
  readonly target: IrIdentifier;
  /** Optional prompt expression (from Python input(prompt)). */
  readonly prompt: IrExpression | null;
};

/** OUTPUT a, b / print(a, b) */
export type IrOutput = WithTrivia & {
  readonly kind: 'IrOutput';
  readonly values: IrExpression[];
};

export type IrExpression =
  | IrIntegerLiteral
  | IrRealLiteral
  | IrStringLiteral
  | IrBooleanLiteral
  | IrIdentifier
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

export type IrBooleanLiteral = {
  readonly kind: 'IrBooleanLiteral';
  readonly value: boolean;
};

export type IrIdentifier = {
  readonly kind: 'IrIdentifier';
  readonly name: string;
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
