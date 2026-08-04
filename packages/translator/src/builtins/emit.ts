/**
 * Python emission for Cambridge builtins (translator-owned).
 *
 * Signatures live in `@pseudopilot/language-core` CORE_BUILTINS.
 * Emission strategies live here so language-core stays backend-neutral.
 *
 * MID indexing policy (Cambridge 1-based → Python 0-based):
 *   MID(S, start, length) → S[(start) - 1 : (start) - 1 + (length)]
 *
 * RIGHT: always `S[-(n):]` so `RIGHT(S, x+1)` is `S[-(x + 1):]`,
 * never `S[-x + 1:]` (wrong precedence).
 *
 * RAND: `random.random() * (x)` with mul parent precedence so
 * `RAND(n+1)` is not `random.random() * n + 1`.
 * Caller (`printPython`) adds `import random` when IR contains RAND.
 *
 * INT: `int(x)` — truncates toward zero (matches Cambridge INT).
 */

import { lookupBuiltin } from '@pseudopilot/language-core';
import type { IrExpression } from '../ir/nodes.js';
import { BINARY_PRECEDENCE } from '../rules/operators.js';

type PrintExpr = (expr: IrExpression, parentPrec: number) => string;

type BuiltinPythonEmit =
  | { readonly kind: 'len' }
  | { readonly kind: 'slice_left' }
  | { readonly kind: 'slice_right' }
  | { readonly kind: 'slice_mid' }
  | { readonly kind: 'method'; readonly method: 'lower' | 'upper' }
  | { readonly kind: 'int' }
  | { readonly kind: 'rand' }
  | { readonly kind: 'attr'; readonly attr: string }
  | { readonly kind: 'date_ctor' }
  | { readonly kind: 'today' }
  | { readonly kind: 'dayindex' };

/** Python emit strategy keyed by Cambridge builtin name (uppercase). */
const PYTHON_EMIT: Readonly<Record<string, BuiltinPythonEmit>> = {
  LENGTH: { kind: 'len' },
  LEFT: { kind: 'slice_left' },
  RIGHT: { kind: 'slice_right' },
  MID: { kind: 'slice_mid' },
  LCASE: { kind: 'method', method: 'lower' },
  UCASE: { kind: 'method', method: 'upper' },
  INT: { kind: 'int' },
  RAND: { kind: 'rand' },
  DAY: { kind: 'attr', attr: 'day' },
  MONTH: { kind: 'attr', attr: 'month' },
  YEAR: { kind: 'attr', attr: 'year' },
  DAYINDEX: { kind: 'dayindex' },
  SETDATE: { kind: 'date_ctor' },
  TODAY: { kind: 'today' },
};

/**
 * If `callee` is a Cambridge builtin, return Python source for the call.
 * Otherwise return null (caller prints a normal call).
 */
export function tryPrintBuiltinPython(
  callee: string,
  args: readonly IrExpression[],
  printExpr: PrintExpr,
): string | null {
  const spec = lookupBuiltin(callee);
  if (!spec) return null;
  const emit = PYTHON_EMIT[spec.name];
  if (!emit) return null;
  if (args.length !== spec.params.length) {
    // Fall back to literal call so partial IR still prints.
    return null;
  }
  return emitPython(emit, args, printExpr);
}

function emitPython(
  emit: BuiltinPythonEmit,
  args: readonly IrExpression[],
  printExpr: PrintExpr,
): string {
  switch (emit.kind) {
    case 'len':
      return `len(${printExpr(args[0]!, 0)})`;
    case 'slice_left':
      return `${parenIfNeeded(args[0]!, printExpr)}[:${printExpr(args[1]!, 0)}]`;
    case 'slice_right': {
      // Atoms: S[-n:] / S[-x:] (unary binds tightly).
      // Compounds: S[-(n + 1):] so `-` applies to the whole count.
      const count = args[1]!;
      const n = printExpr(count, 0);
      const atom =
        count.kind === 'IrIntegerLiteral' ||
        count.kind === 'IrIdentifier' ||
        count.kind === 'IrCallExpression' ||
        count.kind === 'IrIndexExpression' ||
        count.kind === 'IrGroupingExpression';
      const neg = atom ? `-${n}` : `-(${n})`;
      return `${parenIfNeeded(args[0]!, printExpr)}[${neg}:]`;
    }
    case 'slice_mid': {
      // Parenthesize start/length so binary `-`/`+` cannot mis-associate.
      const s = parenIfNeeded(args[0]!, printExpr);
      const start = printExpr(args[1]!, 0);
      const len = printExpr(args[2]!, 0);
      return `${s}[(${start}) - 1 : (${start}) - 1 + (${len})]`;
    }
    case 'method':
      return `${parenIfNeeded(args[0]!, printExpr)}.${emit.method}()`;
    case 'int':
      return `int(${printExpr(args[0]!, 0)})`;
    case 'rand':
      // Parenthesize with `*` precedence: RAND(n+1) → random.random() * (n + 1)
      return `random.random() * ${printExpr(args[0]!, BINARY_PRECEDENCE['*'])}`;
    case 'attr':
      return `${parenIfNeeded(args[0]!, printExpr)}.${emit.attr}`;
    case 'date_ctor':
      // Cambridge SETDATE(Day, Month, Year) → Python date(year, month, day)
      return `date(${printExpr(args[2]!, 0)}, ${printExpr(args[1]!, 0)}, ${printExpr(args[0]!, 0)})`;
    case 'today':
      return 'date.today()';
    case 'dayindex': {
      // Sunday=1 … Saturday=7. Python weekday(): Monday=0 … Sunday=6.
      const d = parenIfNeeded(args[0]!, printExpr);
      return `((${d}.weekday() + 1) % 7 + 1)`;
    }
    default: {
      const _exhaustive: never = emit;
      return _exhaustive;
    }
  }
}

function parenIfNeeded(expr: IrExpression, printExpr: PrintExpr): string {
  const s = printExpr(expr, 0);
  if (
    expr.kind === 'IrIdentifier' ||
    expr.kind === 'IrStringLiteral' ||
    expr.kind === 'IrCharLiteral' ||
    expr.kind === 'IrCallExpression' ||
    expr.kind === 'IrIndexExpression' ||
    expr.kind === 'IrGroupingExpression'
  ) {
    return s;
  }
  return `(${s})`;
}

/** Map Python call/callee patterns back to Cambridge builtin names (reverse). */
export function cambridgeBuiltinFromPythonCall(
  callee: string,
): string | undefined {
  switch (callee) {
    case 'len':
      return 'LENGTH';
    case 'int':
      return 'INT';
    default:
      return lookupBuiltin(callee)?.name;
  }
}
