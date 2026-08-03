import type {
  ArrayType,
  Expression,
  NamedType,
  SimpleType,
  TypeName,
  TypeNameKind,
  TypeReference,
} from '@pseudopilot/language-core';
import type { PpType, RecordFieldInfo, ScalarTypeName } from './types.js';
import { identKey } from './scope.js';

export type TypeTable = ReadonlyMap<string, PpType>;

export function scalar(name: ScalarTypeName): PpType {
  return { kind: 'scalar', name };
}

export function errorType(): PpType {
  return { kind: 'error' };
}

export function recordType(
  name: string,
  fields: readonly RecordFieldInfo[],
): PpType {
  return { kind: 'record', name, fields };
}

export function lookupRecordField(
  record: Extract<PpType, { kind: 'record' }>,
  fieldName: string,
): RecordFieldInfo | undefined {
  const key = identKey(fieldName);
  return record.fields.find((f) => identKey(f.name) === key);
}

export function typeFromTypeName(t: TypeName): PpType {
  return scalar(t.name);
}

/**
 * Resolve a type reference against the TYPE table.
 * Unknown named types become `error` (caller should already have diagnosed).
 */
export function resolveTypeRef(ref: TypeReference, types: TypeTable): PpType {
  if (ref.kind === 'TypeName') return typeFromTypeName(ref);
  if (ref.kind === 'NamedType') {
    const found = types.get(identKey(ref.name));
    if (!found) return errorType();
    return found;
  }
  const element = resolveSimpleType(ref.elementType, types);
  return {
    kind: 'array',
    element,
    dimensions: ref.dimensions.length,
  };
}

export function resolveSimpleType(t: SimpleType, types: TypeTable): PpType {
  if (t.kind === 'TypeName') return typeFromTypeName(t);
  return resolveTypeRef(t, types);
}

/** @deprecated Prefer {@link resolveTypeRef} with a type table. */
export function typeFromTypeRef(ref: TypeReference): PpType {
  if (ref.kind === 'TypeName') return typeFromTypeName(ref);
  if (ref.kind === 'NamedType') return errorType();
  if (ref.elementType.kind === 'NamedType') {
    return {
      kind: 'array',
      element: errorType(),
      dimensions: ref.dimensions.length,
    };
  }
  return {
    kind: 'array',
    element: scalar(ref.elementType.name),
    dimensions: ref.dimensions.length,
  };
}

export function typeNameOf(ref: TypeReference): TypeNameKind | string {
  if (ref.kind === 'TypeName') return ref.name;
  if (ref.kind === 'NamedType') return ref.name;
  if (ref.elementType.kind === 'TypeName') return ref.elementType.name;
  return ref.elementType.name;
}

export function arrayType(ref: ArrayType, types: TypeTable): PpType {
  return resolveTypeRef(ref, types);
}

/** Format a type for diagnostic messages. */
export function formatType(t: PpType): string {
  switch (t.kind) {
    case 'scalar':
      return t.name;
    case 'array': {
      const stars = Array.from({ length: t.dimensions }, () => '*').join(', ');
      return `ARRAY[${stars}] OF ${formatType(t.element)}`;
    }
    case 'record':
      return t.name;
    case 'procedure':
      return `PROCEDURE(${t.params.map(formatType).join(', ')})`;
    case 'function':
      return `FUNCTION(${t.params.map(formatType).join(', ')}) RETURNS ${formatType(t.returns)}`;
    case 'error':
      return '<error>';
  }
}

export function typesEqual(a: PpType, b: PpType): boolean {
  if (a.kind === 'error' || b.kind === 'error') return true;
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'scalar':
      return b.kind === 'scalar' && a.name === b.name;
    case 'array':
      return (
        b.kind === 'array' &&
        a.dimensions === b.dimensions &&
        typesEqual(a.element, b.element)
      );
    case 'record':
      return b.kind === 'record' && identKey(a.name) === identKey(b.name);
    case 'procedure':
      return (
        b.kind === 'procedure' &&
        a.params.length === b.params.length &&
        a.params.every((p, i) => typesEqual(p, b.params[i]!))
      );
    case 'function':
      return (
        b.kind === 'function' &&
        typesEqual(a.returns, b.returns) &&
        a.params.length === b.params.length &&
        a.params.every((p, i) => typesEqual(p, b.params[i]!))
      );
    default:
      return false;
  }
}

/**
 * Assignment compatibility (Cambridge-oriented).
 *
 * Implicit conversion allowed:
 * - INTEGER → REAL
 *
 * Not allowed:
 * - REAL → INTEGER
 * - CHAR ↔ STRING (distinct)
 * - arrays only when element type and dimensionality match
 * - records only when same TYPE name (case-insensitive)
 */
export function isAssignable(to: PpType, from: PpType): boolean {
  if (to.kind === 'error' || from.kind === 'error') return true;
  if (to.kind === 'scalar' && from.kind === 'scalar') {
    if (to.name === from.name) return true;
    if (to.name === 'REAL' && from.name === 'INTEGER') return true;
    return false;
  }
  if (to.kind === 'array' && from.kind === 'array') {
    return (
      to.dimensions === from.dimensions && typesEqual(to.element, from.element)
    );
  }
  if (to.kind === 'record' && from.kind === 'record') {
    return identKey(to.name) === identKey(from.name);
  }
  return false;
}

/** Whether a type may be used as an ARRAY / FOR index (INTEGER preferred; REAL rejected). */
export function isIndexType(t: PpType): boolean {
  return t.kind === 'scalar' && t.name === 'INTEGER';
}

export function isNumeric(t: PpType): boolean {
  return t.kind === 'scalar' && (t.name === 'INTEGER' || t.name === 'REAL');
}

export function isBoolean(t: PpType): boolean {
  return t.kind === 'scalar' && t.name === 'BOOLEAN';
}

export function literalType(expr: Expression): PpType | null {
  switch (expr.kind) {
    case 'IntegerLiteral':
      return scalar('INTEGER');
    case 'RealLiteral':
      return scalar('REAL');
    case 'StringLiteral':
      return scalar('STRING');
    case 'CharLiteral':
      return scalar('CHAR');
    case 'BooleanLiteral':
      return scalar('BOOLEAN');
    case 'UnaryExpression':
      if (
        (expr.operator === '+' || expr.operator === '-') &&
        (expr.argument.kind === 'IntegerLiteral' ||
          expr.argument.kind === 'RealLiteral')
      ) {
        return literalType(expr.argument);
      }
      return null;
    default:
      return null;
  }
}

/** Binary operator result type (best-effort). */
export function binaryResultType(
  op: string,
  left: PpType,
  right: PpType,
): PpType {
  if (left.kind === 'error' || right.kind === 'error') return errorType();

  if (op === 'AND' || op === 'OR') {
    return scalar('BOOLEAN');
  }
  if (
    op === '=' ||
    op === '<>' ||
    op === '<' ||
    op === '<=' ||
    op === '>' ||
    op === '>='
  ) {
    return scalar('BOOLEAN');
  }
  if (op === 'DIV' || op === 'MOD') {
    return scalar('INTEGER');
  }
  if (op === '&') {
    if (isStringyType(left) && isStringyType(right)) {
      return scalar('STRING');
    }
    return errorType();
  }
  if (op === '+' || op === '-' || op === '*' || op === '/') {
    if (isNumeric(left) && isNumeric(right)) {
      if (
        (left.kind === 'scalar' && left.name === 'REAL') ||
        (right.kind === 'scalar' && right.name === 'REAL') ||
        op === '/'
      ) {
        return scalar('REAL');
      }
      return scalar('INTEGER');
    }
    return errorType();
  }
  return errorType();
}

function isStringyType(t: PpType): boolean {
  return t.kind === 'scalar' && (t.name === 'STRING' || t.name === 'CHAR');
}

export function unaryResultType(op: string, arg: PpType): PpType {
  if (arg.kind === 'error') return errorType();
  if (op === 'NOT') return scalar('BOOLEAN');
  if (op === '+' || op === '-') {
    return isNumeric(arg) ? arg : errorType();
  }
  return errorType();
}

/** Collect record type names reachable from `t` (for cycle detection). */
export function recordDeps(t: PpType, out: Set<string>): void {
  if (t.kind === 'record') {
    out.add(identKey(t.name));
    for (const f of t.fields) recordDeps(f.type, out);
  } else if (t.kind === 'array') {
    recordDeps(t.element, out);
  }
}

export function namedTypeRef(name: string, span: NamedType['span']): NamedType {
  return { kind: 'NamedType', name, span };
}
