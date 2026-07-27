import type {
  ArrayType,
  Expression,
  TypeName,
  TypeNameKind,
  TypeReference,
} from '@pseudopilot/language-core';
import type { PpType, ScalarTypeName } from './types.js';

export function scalar(name: ScalarTypeName): PpType {
  return { kind: 'scalar', name };
}

export function errorType(): PpType {
  return { kind: 'error' };
}

export function typeFromTypeName(t: TypeName): PpType {
  return scalar(t.name);
}

export function typeFromTypeRef(ref: TypeReference): PpType {
  if (ref.kind === 'TypeName') return typeFromTypeName(ref);
  return {
    kind: 'array',
    element: ref.elementType.name,
    dimensions: ref.dimensions.length,
  };
}

export function typeNameOf(ref: TypeReference): TypeNameKind {
  if (ref.kind === 'TypeName') return ref.name;
  return ref.elementType.name;
}

export function arrayType(ref: ArrayType): PpType {
  return {
    kind: 'array',
    element: ref.elementType.name,
    dimensions: ref.dimensions.length,
  };
}

/** Format a type for diagnostic messages. */
export function formatType(t: PpType): string {
  switch (t.kind) {
    case 'scalar':
      return t.name;
    case 'array': {
      const stars = Array.from({ length: t.dimensions }, () => '*').join(', ');
      return `ARRAY[${stars}] OF ${t.element}`;
    }
    case 'procedure':
      return `PROCEDURE(${t.params.map(formatType).join(', ')})`;
    case 'function':
      return `FUNCTION(${t.params.map(formatType).join(', ')}) RETURNS ${t.returns}`;
    case 'error':
      return '<error>';
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
 */
export function isAssignable(to: PpType, from: PpType): boolean {
  if (to.kind === 'error' || from.kind === 'error') return true;
  if (to.kind === 'scalar' && from.kind === 'scalar') {
    if (to.name === from.name) return true;
    if (to.name === 'REAL' && from.name === 'INTEGER') return true;
    return false;
  }
  if (to.kind === 'array' && from.kind === 'array') {
    return to.element === from.element && to.dimensions === from.dimensions;
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
    // STRING concatenation via + is not Cambridge (& is); reject softly
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
