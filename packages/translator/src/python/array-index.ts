/**
 * Cambridge ARRAY indices → dense 0-based Python list indices.
 *
 * Storage: list of length (upper - lower + 1), always indexed from 0.
 * Access: `arr[cambridgeIndex - lower]` for every dimension — never
 * special-cases lower === 1 (works for 1:5, 5:10, -3:3, 0:9, …).
 */

import type { IrExpression, IrIndexExpression } from '../ir/nodes.js';

export type PrintExpr = (expr: IrExpression, parentPrec: number) => string;

/** Parenthesize lowers that are not bare literals / identifiers. */
export function printLowerBound(lower: IrExpression, printExpr: PrintExpr): string {
  if (
    lower.kind === 'IrIntegerLiteral' ||
    lower.kind === 'IrIdentifier' ||
    (lower.kind === 'IrUnaryExpression' &&
      lower.operator === '-' &&
      lower.argument.kind === 'IrIntegerLiteral')
  ) {
    // Always wrap unary-minus so `idx - -3` becomes `idx - (-3)`.
    if (lower.kind === 'IrUnaryExpression') {
      return `(${printExpr(lower, 0)})`;
    }
    return printExpr(lower, 0);
  }
  return `(${printExpr(lower, 0)})`;
}

/**
 * Emit `base[i - L0][j - L1]…` when {@link IrIndexExpression.lowers} is set;
 * otherwise fall back to raw indices (best-effort for incomplete IR).
 */
export function printPythonIndex(
  expr: IrIndexExpression,
  printExpr: PrintExpr,
  postfixPrec: number,
): string {
  const base = printExpr(expr.array, postfixPrec);
  return expr.indices.reduce((acc, idx, i) => {
    const idxSrc = printExpr(idx, 0);
    const lower = expr.lowers?.[i];
    if (lower) {
      return `${acc}[${idxSrc} - ${printLowerBound(lower, printExpr)}]`;
    }
    return `${acc}[${idxSrc}]`;
  }, base);
}

/**
 * If `idx` is `expr - lower` (or `expr - (lower)`) matching `lower`, return
 * `expr` for Cambridge reverse; otherwise return `idx` unchanged.
 */
export function stripPythonIndexOffset(
  idx: IrExpression,
  lower: IrExpression | undefined,
): IrExpression {
  if (!lower) return idx;
  if (idx.kind !== 'IrBinaryExpression' || idx.operator !== '-') return idx;
  if (irExprEqual(idx.right, lower)) return idx.left;
  // `x - (L)` grouping
  if (
    idx.right.kind === 'IrGroupingExpression' &&
    irExprEqual(idx.right.expression, lower)
  ) {
    return idx.left;
  }
  return idx;
}

function irExprEqual(a: IrExpression, b: IrExpression): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'IrIntegerLiteral':
      return b.kind === 'IrIntegerLiteral' && a.value === b.value;
    case 'IrIdentifier':
      return b.kind === 'IrIdentifier' && a.name.toLowerCase() === b.name.toLowerCase();
    case 'IrUnaryExpression':
      return (
        b.kind === 'IrUnaryExpression' &&
        a.operator === b.operator &&
        irExprEqual(a.argument, b.argument)
      );
    case 'IrGroupingExpression':
      return (
        b.kind === 'IrGroupingExpression' &&
        irExprEqual(a.expression, b.expression)
      );
    default:
      return false;
  }
}
