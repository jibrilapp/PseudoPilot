import { lookupBuiltin, type BuiltinSpec, type SourceSpan } from '@pseudopilot/language-core';
import type { RandomSource } from './host.js';
import {
  asInteger,
  asNumber,
  asStringy,
  charValue,
  dateValue,
  integerValue,
  realValue,
  runtimeFail,
  stringValue,
  type RuntimeValue,
} from './value.js';

type BuiltinImpl = (
  args: readonly RuntimeValue[],
  random: RandomSource,
  span: SourceSpan | undefined,
  spec: BuiltinSpec,
) => RuntimeValue;

/**
 * Registry-driven builtin execution.
 * Call sites look up CORE_BUILTINS then dispatch via name — not a monolithic switch.
 */
const BUILTIN_IMPL: Readonly<Record<string, BuiltinImpl>> = {
  LENGTH(args) {
    return integerValue(asStringy(args[0]!, 'LENGTH').length);
  },
  LEFT(args, _r, span) {
    const s = asStringy(args[0]!, 'LEFT');
    const n = asInteger(args[1]!, 'LEFT');
    if (n < 0) {
      throw runtimeFail('R_BUILTIN', 'LEFT count must be non-negative.', span);
    }
    return stringValue(s.slice(0, n));
  },
  RIGHT(args, _r, span) {
    const s = asStringy(args[0]!, 'RIGHT');
    const n = asInteger(args[1]!, 'RIGHT');
    if (n < 0) {
      throw runtimeFail('R_BUILTIN', 'RIGHT count must be non-negative.', span);
    }
    if (n === 0) return stringValue('');
    return stringValue(s.slice(-n));
  },
  MID(args, _r, span) {
    const s = asStringy(args[0]!, 'MID');
    const start = asInteger(args[1]!, 'MID');
    const len = asInteger(args[2]!, 'MID');
    if (start < 1) {
      throw runtimeFail(
        'R_BUILTIN',
        `MID start position ${start} is invalid (1-based).`,
        span,
      );
    }
    if (len < 0) {
      throw runtimeFail('R_BUILTIN', 'MID length must be non-negative.', span);
    }
    const zero = start - 1;
    return stringValue(s.slice(zero, zero + len));
  },
  LCASE(args) {
    const a0 = args[0]!;
    const s = asStringy(a0, 'LCASE').toLowerCase();
    return a0.kind === 'CHAR' ? charValue(s) : stringValue(s);
  },
  UCASE(args) {
    const a0 = args[0]!;
    const s = asStringy(a0, 'UCASE').toUpperCase();
    return a0.kind === 'CHAR' ? charValue(s) : stringValue(s);
  },
  INT(args) {
    return integerValue(Math.trunc(asNumber(args[0]!, 'INT')));
  },
  RAND(args, random, span) {
    const x = asInteger(args[0]!, 'RAND');
    if (x <= 0) {
      throw runtimeFail(
        'R_BUILTIN',
        `RAND argument must be positive INTEGER (got ${x}).`,
        span,
      );
    }
    return realValue(random.next() * x);
  },
  DAY(args, _r, span) {
    const d = asDate(args[0]!, 'DAY', span);
    return integerValue(d.day);
  },
  MONTH(args, _r, span) {
    const d = asDate(args[0]!, 'MONTH', span);
    return integerValue(d.month);
  },
  YEAR(args, _r, span) {
    const d = asDate(args[0]!, 'YEAR', span);
    return integerValue(d.year);
  },
  DAYINDEX(args, _r, span) {
    const d = asDate(args[0]!, 'DAYINDEX', span);
    // Sunday = 1 … Saturday = 7 (Cambridge insert).
    const js = new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay(); // 0=Sun
    return integerValue(js + 1);
  },
  SETDATE(args, _r, span) {
    const day = asInteger(args[0]!, 'SETDATE');
    const month = asInteger(args[1]!, 'SETDATE');
    const year = asInteger(args[2]!, 'SETDATE');
    const dt = new Date(Date.UTC(year, month - 1, day));
    if (
      dt.getUTCFullYear() !== year ||
      dt.getUTCMonth() !== month - 1 ||
      dt.getUTCDate() !== day
    ) {
      throw runtimeFail(
        'R_BUILTIN',
        `SETDATE(${day}, ${month}, ${year}) is not a valid calendar date.`,
        span,
      );
    }
    return dateValue(day, month, year);
  },
  TODAY() {
    const now = new Date();
    return dateValue(now.getDate(), now.getMonth() + 1, now.getFullYear());
  },
};

function asDate(
  v: RuntimeValue,
  what: string,
  span: SourceSpan | undefined,
): Extract<RuntimeValue, { kind: 'DATE' }> {
  if (v.kind !== 'DATE') {
    throw runtimeFail('R_TYPE', `${what} expects DATE, got ${v.kind}.`, span);
  }
  return v;
}

export function executeBuiltin(
  name: string,
  args: readonly RuntimeValue[],
  random: RandomSource,
  span?: SourceSpan,
): RuntimeValue {
  const spec = lookupBuiltin(name);
  if (!spec) {
    throw runtimeFail('R_UNDECL_ROUTINE', `Unknown builtin '${name}'.`, span);
  }
  if (args.length !== spec.params.length) {
    throw runtimeFail(
      'R_BUILTIN_ARGS',
      `Builtin ${spec.name} expects ${spec.params.length} argument(s) but got ${args.length}.`,
      span,
      spec.summary,
    );
  }
  const impl = BUILTIN_IMPL[spec.name];
  if (!impl) {
    throw runtimeFail(
      'R_BUILTIN',
      `Builtin ${spec.name} has no runtime implementation.`,
      span,
    );
  }
  return impl(args, random, span, spec);
}

/** Ensure every CORE_BUILTIN has a runtime impl (test helper). */
export function builtinImplNames(): readonly string[] {
  return Object.keys(BUILTIN_IMPL);
}
