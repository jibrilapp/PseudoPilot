import type { SourceSpan, TypeNameKind } from '@pseudopilot/language-core';

/** Scalar runtime values. */
export type ScalarValue =
  | { readonly kind: 'INTEGER'; readonly value: number }
  | { readonly kind: 'REAL'; readonly value: number }
  | { readonly kind: 'BOOLEAN'; readonly value: boolean }
  | { readonly kind: 'STRING'; readonly value: string }
  | { readonly kind: 'CHAR'; readonly value: string };

/** Dense multi-dimensional array with Cambridge inclusive bounds. */
export type ArrayValue = {
  readonly kind: 'ARRAY';
  readonly element: TypeNameKind;
  /** Inclusive lower bound per dimension. */
  readonly lowers: readonly number[];
  /** Inclusive upper bound per dimension. */
  readonly uppers: readonly number[];
  /** Row-major flat storage. */
  readonly data: RuntimeValue[];
};

export type RuntimeValue = ScalarValue | ArrayValue;

export type BindingKind = 'variable' | 'constant' | 'parameter';

export type Binding = {
  readonly name: string;
  readonly kind: BindingKind;
  readonly typeName: TypeNameKind | 'ARRAY';
  value: RuntimeValue;
};

export type RuntimeDiagnostic = {
  readonly severity: 'error' | 'warning';
  readonly code: string;
  readonly message: string;
  readonly span?: SourceSpan;
  readonly help?: string;
};

export function integerValue(n: number): ScalarValue {
  return { kind: 'INTEGER', value: Math.trunc(n) };
}

export function realValue(n: number): ScalarValue {
  return { kind: 'REAL', value: n };
}

export function booleanValue(b: boolean): ScalarValue {
  return { kind: 'BOOLEAN', value: b };
}

export function stringValue(s: string): ScalarValue {
  return { kind: 'STRING', value: s };
}

export function charValue(c: string): ScalarValue {
  return { kind: 'CHAR', value: c.length === 0 ? ' ' : c[0]! };
}

export function defaultScalar(type: TypeNameKind): ScalarValue {
  switch (type) {
    case 'INTEGER':
      return integerValue(0);
    case 'REAL':
      return realValue(0);
    case 'BOOLEAN':
      return booleanValue(false);
    case 'STRING':
      return stringValue('');
    case 'CHAR':
      return charValue(' ');
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

export function formatValue(v: RuntimeValue): string {
  switch (v.kind) {
    case 'INTEGER':
      return String(v.value);
    case 'REAL': {
      if (Number.isInteger(v.value)) return `${v.value}.0`;
      return String(v.value);
    }
    case 'BOOLEAN':
      return v.value ? 'TRUE' : 'FALSE';
    case 'STRING':
      return v.value;
    case 'CHAR':
      return v.value;
    case 'ARRAY':
      return `[ARRAY ${v.element}]`;
  }
}

export function isTruthyBoolean(v: RuntimeValue): boolean {
  if (v.kind !== 'BOOLEAN') {
    throw runtimeFail(
      'R_TYPE',
      `Expected BOOLEAN, got ${v.kind}.`,
    );
  }
  return v.value;
}

export function asNumber(v: RuntimeValue, what: string): number {
  if (v.kind === 'INTEGER' || v.kind === 'REAL') return v.value;
  throw runtimeFail('R_TYPE', `${what} expects a number, got ${v.kind}.`);
}

export function asInteger(v: RuntimeValue, what: string): number {
  if (v.kind === 'INTEGER') return v.value;
  throw runtimeFail('R_TYPE', `${what} expects INTEGER, got ${v.kind}.`);
}

export function asStringy(v: RuntimeValue, what: string): string {
  if (v.kind === 'STRING' || v.kind === 'CHAR') return v.value;
  throw runtimeFail('R_TYPE', `${what} expects STRING or CHAR, got ${v.kind}.`);
}

/** Thrown control for RETURN from a FUNCTION. */
export class ReturnSignal {
  constructor(readonly value: RuntimeValue) {}
}

/** Thrown for recoverable/aborting runtime errors. */
export class RuntimeError extends Error {
  readonly diagnostic: RuntimeDiagnostic;

  constructor(diagnostic: RuntimeDiagnostic) {
    super(diagnostic.message);
    this.name = 'RuntimeError';
    this.diagnostic = diagnostic;
  }
}

export function runtimeFail(
  code: string,
  message: string,
  span?: SourceSpan,
  help?: string,
): RuntimeError {
  const diagnostic: RuntimeDiagnostic = {
    severity: 'error',
    code,
    message,
  };
  if (span !== undefined) {
    (diagnostic as { span?: SourceSpan }).span = span;
  }
  if (help !== undefined) {
    (diagnostic as { help?: string }).help = help;
  }
  return new RuntimeError(diagnostic);
}

/** Flat index into dense array storage; validates rank and bounds. */
export function arrayOffset(
  arr: ArrayValue,
  indices: readonly number[],
  span?: SourceSpan,
): number {
  if (indices.length !== arr.lowers.length) {
    throw runtimeFail(
      'R_ARRAY_RANK',
      `Array expects ${arr.lowers.length} index(es) but got ${indices.length}.`,
      span,
    );
  }
  let offset = 0;
  let stride = 1;
  for (let d = arr.lowers.length - 1; d >= 0; d--) {
    const i = indices[d]!;
    const lo = arr.lowers[d]!;
    const hi = arr.uppers[d]!;
    if (i < lo || i > hi) {
      throw runtimeFail(
        'R_ARRAY_BOUNDS',
        `Index ${i} out of bounds for dimension ${d + 1} [${lo}:${hi}].`,
        span,
        'Cambridge array bounds are inclusive.',
      );
    }
    offset += (i - lo) * stride;
    stride *= hi - lo + 1;
  }
  return offset;
}

export function allocateArray(
  element: TypeNameKind,
  lowers: readonly number[],
  uppers: readonly number[],
  span?: SourceSpan,
): ArrayValue {
  if (lowers.length === 0 || lowers.length !== uppers.length) {
    throw runtimeFail('R_ARRAY_RANK', 'Invalid array dimensions.', span);
  }
  let size = 1;
  for (let d = 0; d < lowers.length; d++) {
    const lo = lowers[d]!;
    const hi = uppers[d]!;
    if (!Number.isInteger(lo) || !Number.isInteger(hi)) {
      throw runtimeFail(
        'R_ARRAY_BOUNDS',
        'Array bounds must be INTEGER.',
        span,
      );
    }
    if (hi < lo) {
      throw runtimeFail(
        'R_ARRAY_BOUNDS',
        `Upper bound ${hi} is less than lower bound ${lo}.`,
        span,
      );
    }
    const dim = hi - lo + 1;
    size *= dim;
    if (size > 1_000_000) {
      throw runtimeFail(
        'R_ARRAY_SIZE',
        `Array would have ${size} elements (limit 1_000_000).`,
        span,
      );
    }
  }
  const data: RuntimeValue[] = new Array(size);
  for (let i = 0; i < size; i++) {
    // Fresh value per slot so later in-place mutation cannot alias elements.
    data[i] = defaultScalar(element);
  }
  return {
    kind: 'ARRAY',
    element,
    lowers: [...lowers],
    uppers: [...uppers],
    data,
  };
}
