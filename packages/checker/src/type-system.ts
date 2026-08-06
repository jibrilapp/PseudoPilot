import type {
  ArrayType,
  Expression,
  NamedType,
  SimpleType,
  TypeName,
  TypeNameKind,
  TypeReference,
} from '@pseudopilot/language-core';
import type {
  ArrayBound,
  ClassFieldInfo,
  ClassMethodInfo,
  PpType,
  RecordFieldInfo,
  ScalarTypeName,
  TypeDefaultHint,
} from './types.js';
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

export function classType(
  name: string,
  inherits: string | null,
  fields: readonly ClassFieldInfo[],
  methods: readonly ClassMethodInfo[],
): PpType {
  return { kind: 'class', name, inherits, fields, methods };
}

export function enumType(
  name: string,
  members: readonly string[],
): PpType {
  return { kind: 'enum', name, members };
}

export function pointerType(name: string, target: PpType): PpType {
  return { kind: 'pointer', name, target };
}

/** Anonymous pointer from `^place` (name is empty). */
export function addressOfType(target: PpType): PpType {
  return { kind: 'pointer', name: '', target };
}

export function setType(name: string, element: PpType): PpType {
  return { kind: 'set', name, element };
}

/**
 * Checker defaults for enum / pointer / set DECLARE.
 * Scalar / record / array defaults live in the interpreter.
 */
export function typeDefaultHint(t: PpType): TypeDefaultHint | null {
  if (t.kind === 'enum' && t.members.length > 0) {
    return { kind: 'enumFirst', member: t.members[0]! };
  }
  if (t.kind === 'pointer') return { kind: 'pointerNil' };
  if (t.kind === 'set') return { kind: 'emptySet' };
  return null;
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
 * When every ARRAY dimension bound is an integer literal (or ±literal),
 * return concrete inclusive bounds; otherwise undefined.
 */
export function literalArrayBounds(
  ref: ArrayType,
): readonly ArrayBound[] | undefined {
  const bounds: ArrayBound[] = [];
  for (const dim of ref.dimensions) {
    const lower = integerLiteralValue(dim.lower);
    const upper = integerLiteralValue(dim.upper);
    if (lower === null || upper === null) return undefined;
    bounds.push({ lower, upper });
  }
  return bounds;
}

function integerLiteralValue(expr: Expression): number | null {
  if (expr.kind === 'IntegerLiteral') return expr.value;
  if (
    expr.kind === 'UnaryExpression' &&
    (expr.operator === '+' || expr.operator === '-') &&
    expr.argument.kind === 'IntegerLiteral'
  ) {
    return expr.operator === '-' ? -expr.argument.value : expr.argument.value;
  }
  return null;
}

function arrayBoundsEqual(
  a: readonly ArrayBound[] | undefined,
  b: readonly ArrayBound[] | undefined,
): boolean {
  if (!a || !b) return true; // incomplete bounds → cannot prove mismatch
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.lower !== b[i]!.lower || a[i]!.upper !== b[i]!.upper) {
      return false;
    }
  }
  return true;
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
  const bounds = literalArrayBounds(ref);
  return {
    kind: 'array',
    element,
    dimensions: ref.dimensions.length,
    ...(bounds ? { bounds } : {}),
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
  const bounds = literalArrayBounds(ref);
  return {
    kind: 'array',
    element: scalar(ref.elementType.name),
    dimensions: ref.dimensions.length,
    ...(bounds ? { bounds } : {}),
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
      if (t.bounds && t.bounds.length === t.dimensions) {
        const dims = t.bounds
          .map((b) => `${b.lower}:${b.upper}`)
          .join(', ');
        return `ARRAY[${dims}] OF ${formatType(t.element)}`;
      }
      const stars = Array.from({ length: t.dimensions }, () => '*').join(', ');
      return `ARRAY[${stars}] OF ${formatType(t.element)}`;
    }
    case 'record':
      return t.name;
    case 'class':
      return t.name;
    case 'enum':
      return t.name;
    case 'pointer':
      return t.name || `^${formatType(t.target)}`;
    case 'set':
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
        typesEqual(a.element, b.element) &&
        arrayBoundsEqual(a.bounds, b.bounds)
      );
    case 'record':
      return b.kind === 'record' && identKey(a.name) === identKey(b.name);
    case 'class':
      return b.kind === 'class' && identKey(a.name) === identKey(b.name);
    case 'enum':
      return b.kind === 'enum' && identKey(a.name) === identKey(b.name);
    case 'pointer':
      return (
        b.kind === 'pointer' &&
        identKey(a.name) === identKey(b.name) &&
        // Anonymous address-of pointers compare by target.
        (a.name === '' || b.name === ''
          ? typesEqual(a.target, b.target)
          : true)
      );
    case 'set':
      return b.kind === 'set' && identKey(a.name) === identKey(b.name);
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
 * - arrays only when element type, dimensionality, and (when known) bounds match
 * - records only when same TYPE name (case-insensitive)
 * - enums / named pointers / sets only when same TYPE name
 * - anonymous address-of (`^place`) → named pointer when place type matches target
 *
 * Classes: same CLASS name, or `from` is a (transitive) subclass of `to`
 * (covariance — a variable declared as the parent type may hold a subclass
 * instance). Walking the inheritance chain requires the TYPE/CLASS table;
 * without it, only exact-name matches are accepted.
 */
export function isAssignable(
  to: PpType,
  from: PpType,
  typeTable?: TypeTable,
): boolean {
  if (to.kind === 'error' || from.kind === 'error') return true;
  if (to.kind === 'scalar' && from.kind === 'scalar') {
    if (to.name === from.name) return true;
    if (to.name === 'REAL' && from.name === 'INTEGER') return true;
    return false;
  }
  if (to.kind === 'array' && from.kind === 'array') {
    return (
      to.dimensions === from.dimensions &&
      typesEqual(to.element, from.element) &&
      arrayBoundsEqual(to.bounds, from.bounds)
    );
  }
  if (to.kind === 'record' && from.kind === 'record') {
    return identKey(to.name) === identKey(from.name);
  }
  if (to.kind === 'class' && from.kind === 'class') {
    if (identKey(to.name) === identKey(from.name)) return true;
    if (!typeTable) return false;
    return isSubclassOf(from, to.name, typeTable);
  }
  if (to.kind === 'enum' && from.kind === 'enum') {
    return identKey(to.name) === identKey(from.name);
  }
  if (to.kind === 'pointer' && from.kind === 'pointer') {
    // Named pointer ← same named pointer
    if (
      to.name !== '' &&
      from.name !== '' &&
      identKey(to.name) === identKey(from.name)
    ) {
      return true;
    }
    // Named pointer ← ^place when place type matches the pointer target
    if (to.name !== '' && from.name === '') {
      return typesEqual(to.target, from.target);
    }
    // Anonymous ← anonymous (same target)
    if (to.name === '' && from.name === '') {
      return typesEqual(to.target, from.target);
    }
    return false;
  }
  if (to.kind === 'set' && from.kind === 'set') {
    return identKey(to.name) === identKey(from.name);
  }
  return false;
}

/** True when `descendant` is (transitively) a subclass of `ancestorName`. */
function isSubclassOf(
  descendant: Extract<PpType, { kind: 'class' }>,
  ancestorName: string,
  typeTable: TypeTable,
): boolean {
  const target = identKey(ancestorName);
  let current: Extract<PpType, { kind: 'class' }> | undefined = descendant;
  const seen = new Set<string>();
  while (current && current.inherits !== null) {
    if (identKey(current.inherits) === target) return true;
    if (seen.has(identKey(current.name))) break;
    seen.add(identKey(current.name));
    const parent = typeTable.get(identKey(current.inherits));
    current = parent && parent.kind === 'class' ? parent : undefined;
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

export function isEnum(t: PpType): t is Extract<PpType, { kind: 'enum' }> {
  return t.kind === 'enum';
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
    case 'DateLiteral':
      return scalar('DATE');
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
    // Cambridge ordinal arithmetic: enum ± INTEGER → same enum
    if (
      (op === '+' || op === '-') &&
      left.kind === 'enum' &&
      right.kind === 'scalar' &&
      right.name === 'INTEGER'
    ) {
      return left;
    }
    if (
      (op === '+' || op === '-') &&
      right.kind === 'enum' &&
      left.kind === 'scalar' &&
      left.name === 'INTEGER'
    ) {
      return right;
    }
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
  // Pointer / set / enum / class do not create record containment edges.
}

export function namedTypeRef(name: string, span: NamedType['span']): NamedType {
  return { kind: 'NamedType', name, span };
}
