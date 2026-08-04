import type {
  AssignTarget,
  ClassDeclaration,
  ClassMember,
  Expression,
  Program,
  SimpleType,
  Statement,
  TypeReference,
} from '@pseudopilot/language-core';
import {
  emptyTrivia,
  withEmptyTrivia,
  type IrArrayDimension,
  type IrAssignTarget,
  type IrCaseArm,
  type IrCaseLabel,
  type IrClassMember,
  type IrElseIfClause,
  type IrExpression,
  type IrProgram,
  type IrSimpleType,
  type IrStatement,
  type IrTypeField,
  type IrTypeName,
  type IrTypeReference,
  type IrVisibility,
} from '../ir/nodes.js';
import { cambridgeBinaryToIr, cambridgeUnaryToIr } from '../rules/operators.js';
import {
  isPythonSyntaxKeyword,
  isPythonTranslatorBuiltin,
} from '../rules/python-names.js';
import { attachTriviaToStatements } from '../trivia/attach.js';
import type { TranslateDiagnostic } from '../types.js';

export type LowerResult = {
  readonly ir: IrProgram;
  readonly diagnostics: TranslateDiagnostic[];
};

type BindingKind = 'var' | 'const';

/**
 * Cambridge composite shapes for by-value Python emit + field casing.
 * `class` is intentionally excluded from {@link isCompositeShape} — CLASS
 * instances are Cambridge 9618 reference types and must never be deep-copied.
 */
type ValueShape =
  | { readonly kind: 'scalar'; readonly typeName: IrTypeName | null }
  | { readonly kind: 'record'; readonly typeKey: string }
  | { readonly kind: 'class'; readonly typeKey: string }
  | {
      readonly kind: 'array';
      readonly element: ValueShape;
      readonly dimensions: readonly {
        readonly lower: IrExpression;
        readonly upper: IrExpression;
      }[];
    };

type ScopeBinding = {
  readonly kind: BindingKind;
  readonly canonical: string;
  readonly shape: ValueShape;
};

type ScopeFrame = {
  readonly bindings: Map<string, ScopeBinding>;
};

type LowerCtx = {
  readonly diagnostics: TranslateDiagnostic[];
  readonly scopes: ScopeFrame[];
  /** typeKey → (fieldKey → declared field casing) */
  readonly recordFields: Map<string, Map<string, string>>;
  /** typeKey → (fieldKey → field value shape) for nested copy/casing */
  readonly recordFieldShapes: Map<string, Map<string, ValueShape>>;
  /** routineKey → parameter shapes (for by-value arg copies) */
  readonly routineParams: Map<string, readonly ValueShape[]>;
  /** classKey set — distinguishes CLASS NamedType refs from TYPE (record) refs. */
  readonly classNames: Set<string>;
  /** classKey → declared display-case name (for canonicalizing NamedType refs). */
  readonly classCanonicalName: Map<string, string>;
  /** classKey → parent classKey, or null (single level, not yet walked). */
  readonly classParent: Map<string, string | null>;
  /** classKey → (fieldKey → declared casing), own + inherited (child wins). */
  readonly classFields: Map<string, Map<string, string>>;
  /** classKey → (fieldKey → value shape), own + inherited. */
  readonly classFieldShapes: Map<string, Map<string, ValueShape>>;
  /** classKey → (methodKey(lowercase) → declared casing), own + inherited (child overrides win). */
  readonly classMethods: Map<string, Map<string, string>>;
  /**
   * Own + inherited field names of the CLASS whose method body is currently
   * being lowered — bare identifiers matching one of these rewrite to
   * `self.Field`. `null` outside a class method body.
   */
  currentClassFields: Map<string, string> | null;
  /** Display-case name of the CLASS whose method body is currently being lowered. */
  currentClassName: string | null;
};

function scalarShape(typeName: IrTypeName | null = null): ValueShape {
  return { kind: 'scalar', typeName };
}

/** Cambridge identifiers are case-insensitive — match checker binding. */
function bindingKey(name: string): string {
  return name.toLowerCase();
}

function pushScope(ctx: LowerCtx): void {
  ctx.scopes.push({ bindings: new Map() });
}

function popScope(ctx: LowerCtx): void {
  ctx.scopes.pop();
}

/** Like {@link resolveName}, but returns `null` when `name` isn't bound in any scope. */
function tryResolveScopedName(ctx: LowerCtx, name: string): string | null {
  const key = bindingKey(name);
  for (let i = ctx.scopes.length - 1; i >= 0; i--) {
    const found = ctx.scopes[i]!.bindings.get(key);
    if (found) return found.canonical;
  }
  return null;
}

/**
 * Resolve an identifier to first-declaration casing in the nearest scope.
 * Python is case-sensitive; Cambridge is not — without this, `Count`/`count`
 * become different Python names and crash at runtime.
 */
function resolveName(ctx: LowerCtx, name: string): string {
  return tryResolveScopedName(ctx, name) ?? name;
}

/** Register a binding; keeps first-seen casing within the current frame. */
function registerBinding(
  ctx: LowerCtx,
  name: string,
  kind: BindingKind,
  shape: ValueShape = scalarShape(),
): string {
  const key = bindingKey(name);
  const frame = ctx.scopes[ctx.scopes.length - 1]!;
  const existing = frame.bindings.get(key);
  if (existing) return existing.canonical;
  frame.bindings.set(key, { kind, canonical: name, shape });
  return name;
}

/** Register a name (routine) without treating it as assignable storage. */
function registerName(ctx: LowerCtx, name: string): string {
  return registerBinding(ctx, name, 'var', scalarShape());
}

function lookupShape(ctx: LowerCtx, name: string): ValueShape {
  const key = bindingKey(name);
  for (let i = ctx.scopes.length - 1; i >= 0; i--) {
    const found = ctx.scopes[i]!.bindings.get(key);
    if (found) return found.shape;
  }
  return scalarShape();
}

function isCompositeShape(shape: ValueShape): boolean {
  return shape.kind === 'record' || shape.kind === 'array';
}

/** NamedType → 'class' shape when the name is a known CLASS, else 'record' (TYPE). */
function namedTypeShape(ctx: LowerCtx, name: string): ValueShape {
  const key = bindingKey(name);
  return ctx.classNames.has(key)
    ? { kind: 'class', typeKey: key }
    : { kind: 'record', typeKey: key };
}

function shapeFromTypeRef(typeRef: TypeReference, ctx: LowerCtx): ValueShape {
  if (typeRef.kind === 'TypeName') return scalarShape(typeRef.name);
  if (typeRef.kind === 'NamedType') {
    return namedTypeShape(ctx, typeRef.name);
  }
  const dimensions: { lower: IrExpression; upper: IrExpression }[] = [];
  for (const dim of typeRef.dimensions) {
    const lower = lowerExpression(dim.lower, ctx);
    const upper = lowerExpression(dim.upper, ctx);
    if (!lower || !upper) {
      return {
        kind: 'array',
        element: shapeFromSimpleType(typeRef.elementType, ctx),
        dimensions: [],
      };
    }
    dimensions.push({ lower, upper });
  }
  return {
    kind: 'array',
    element: shapeFromSimpleType(typeRef.elementType, ctx),
    dimensions,
  };
}

function shapeFromSimpleType(t: SimpleType, ctx: LowerCtx): ValueShape {
  if (t.kind === 'TypeName') return scalarShape(t.name);
  return namedTypeShape(ctx, t.name);
}

/** Depth guard against pathological/undetected inheritance cycles. */
const MAX_INHERITANCE_DEPTH = 64;

type ClassRegistry = {
  readonly classNames: Set<string>;
  readonly canonicalName: Map<string, string>;
  readonly parent: Map<string, string | null>;
  readonly fields: Map<string, Map<string, string>>;
  readonly fieldShapes: Map<string, Map<string, ValueShape>>;
  readonly methods: Map<string, Map<string, string>>;
};

/**
 * Two-pass scan of all top-level CLASS declarations (forward references
 * between classes are valid Cambridge — mirrors `@pseudopilot/checker`'s
 * `registerClassDeclarations`). Produces combined (own + inherited) field
 * and method casing tables used for `self.Field` rewriting and for
 * resolving field/method casing on member/method-call expressions.
 */
function buildClassRegistry(program: Program): ClassRegistry {
  const decls = program.body.filter(
    (s): s is ClassDeclaration => s.kind === 'ClassDeclaration',
  );

  const classNames = new Set<string>();
  const canonicalName = new Map<string, string>();
  for (const decl of decls) {
    const key = bindingKey(decl.name.name);
    classNames.add(key);
    canonicalName.set(key, decl.name.name);
  }

  const parent = new Map<string, string | null>();
  const ownFields = new Map<string, Map<string, string>>();
  const ownFieldShapes = new Map<string, Map<string, ValueShape>>();
  const ownMethods = new Map<string, Map<string, string>>();

  // Local shape resolver — mirrors `namedTypeShape` but only needs the name
  // set built above (own/field types may forward-reference a later CLASS).
  const shapeOf = (typeRef: TypeReference): ValueShape => {
    if (typeRef.kind === 'TypeName') return scalarShape(typeRef.name);
    if (typeRef.kind === 'NamedType') {
      const key = bindingKey(typeRef.name);
      return classNames.has(key)
        ? { kind: 'class', typeKey: key }
        : { kind: 'record', typeKey: key };
    }
    // Dimensions filled later when the CLASS field is registered via shapeFromTypeRef
    // in a full lower context; registry only needs element kind for copy decisions.
    const dims = typeRef.dimensions.map((d) => ({
      lower: { kind: 'IrIntegerLiteral' as const, value: 0 },
      upper: { kind: 'IrIntegerLiteral' as const, value: 0 },
    }));
    // Prefer real bounds when they are integer literals (common exam case).
    for (let i = 0; i < typeRef.dimensions.length; i++) {
      const d = typeRef.dimensions[i]!;
      const lo = d.lower.kind === 'IntegerLiteral' ? d.lower.value : null;
      const hi = d.upper.kind === 'IntegerLiteral' ? d.upper.value : null;
      if (lo !== null) dims[i] = { ...dims[i]!, lower: { kind: 'IrIntegerLiteral', value: lo } };
      if (hi !== null) dims[i] = { ...dims[i]!, upper: { kind: 'IrIntegerLiteral', value: hi } };
    }
    const elem = typeRef.elementType;
    if (elem.kind === 'TypeName') {
      return { kind: 'array', element: scalarShape(elem.name), dimensions: dims };
    }
    const elemKey = bindingKey(elem.name);
    return {
      kind: 'array',
      element: classNames.has(elemKey)
        ? { kind: 'class', typeKey: elemKey }
        : { kind: 'record', typeKey: elemKey },
      dimensions: dims,
    };
  };

  for (const decl of decls) {
    const key = bindingKey(decl.name.name);
    parent.set(key, decl.inherits ? bindingKey(decl.inherits.name) : null);
    const fields = new Map<string, string>();
    const fieldShapes = new Map<string, ValueShape>();
    const methods = new Map<string, string>();
    for (const member of decl.members) {
      if (member.kind === 'ClassPropertyDeclaration') {
        const shape = shapeOf(member.typeRef);
        for (const id of member.names) {
          const fk = bindingKey(id.name);
          if (!fields.has(fk)) {
            fields.set(fk, id.name);
            fieldShapes.set(fk, shape);
          }
        }
      } else {
        const mk = bindingKey(member.name.name);
        if (!methods.has(mk)) methods.set(mk, member.name.name);
      }
    }
    ownFields.set(key, fields);
    ownFieldShapes.set(key, fieldShapes);
    ownMethods.set(key, methods);
  }

  function combine<T>(
    key: string,
    own: Map<string, Map<string, T>>,
    cache: Map<string, Map<string, T>>,
    visiting: Set<string>,
  ): Map<string, T> {
    const cached = cache.get(key);
    if (cached) return cached;
    if (visiting.has(key) || visiting.size >= MAX_INHERITANCE_DEPTH) {
      return own.get(key) ?? new Map();
    }
    visiting.add(key);
    const ownMap = own.get(key) ?? new Map();
    const parentKey = parent.get(key) ?? null;
    const parentMap =
      parentKey && own.has(parentKey)
        ? combine(parentKey, own, cache, visiting)
        : new Map<string, T>();
    const result = new Map<string, T>([...parentMap, ...ownMap]);
    cache.set(key, result);
    return result;
  }

  const fields = new Map<string, Map<string, string>>();
  const fieldShapes = new Map<string, Map<string, ValueShape>>();
  const methods = new Map<string, Map<string, string>>();
  for (const key of classNames) {
    fields.set(key, combine(key, ownFields, fields, new Set()));
    fieldShapes.set(key, combine(key, ownFieldShapes, fieldShapes, new Set()));
    methods.set(key, combine(key, ownMethods, methods, new Set()));
  }

  return { classNames, canonicalName, parent, fields, fieldShapes, methods };
}

function exprShape(ctx: LowerCtx, expr: Expression): ValueShape {
  switch (expr.kind) {
    case 'Identifier':
      return lookupShape(ctx, expr.name);
    case 'MemberExpression': {
      const obj = exprShape(ctx, expr.object);
      // Field shape from TYPE/CLASS tables is not stored on IR; look up via
      // recorded fields only for casing. For copy decisions, treat unknown
      // fields as scalar unless the field name maps to a known nested
      // record/class via the type table.
      if (obj.kind === 'record') {
        const nested = ctx.recordFieldShapes
          .get(obj.typeKey)
          ?.get(bindingKey(expr.property.name));
        return nested ?? scalarShape();
      }
      if (obj.kind === 'class') {
        const nested = ctx.classFieldShapes
          .get(obj.typeKey)
          ?.get(bindingKey(expr.property.name));
        return nested ?? scalarShape();
      }
      return scalarShape();
    }
    case 'IndexExpression': {
      const arr = exprShape(ctx, expr.array);
      if (arr.kind !== 'array') return scalarShape();
      return arr.element;
    }
    case 'CallExpression': {
      // Function return shapes aren't tracked for all cases; assignment still
      // deep-copies when the *target* is composite.
      return scalarShape();
    }
    case 'GroupingExpression':
      return exprShape(ctx, expr.expression);
    default:
      return scalarShape();
  }
}

function maybeDeepCopy(
  ctx: LowerCtx,
  value: IrExpression,
  shape: ValueShape,
): IrExpression {
  void ctx;
  if (!isCompositeShape(shape)) return value;
  return { kind: 'IrDeepCopyExpression', value };
}

function bindName(
  ctx: LowerCtx,
  name: string,
  kind: BindingKind,
  span: Statement['span'],
  what: 'DECLARE' | 'CONSTANT',
  shape: ValueShape = scalarShape(),
): string | null {
  // Language duplicate / type rules live in `@pseudopilot/checker`.
  // Lower only enforces Python-target name constraints.
  if (isPythonSyntaxKeyword(name)) {
    ctx.diagnostics.push({
      severity: 'error',
      code: 'T_DECL_PY_KEYWORD',
      message: `${what} name '${name}' is a Python keyword and cannot be translated.`,
      span,
    });
    return null;
  }
  if (isPythonTranslatorBuiltin(name)) {
    ctx.diagnostics.push({
      severity: 'warning',
      code: 'T_DECL_SHADOWS_BUILTIN',
      message: `${what} name '${name}' shadows a Python builtin used by the translator (print/input/range).`,
      span,
    });
  }
  return registerBinding(ctx, name, kind, shape);
}

function lookupBinding(ctx: LowerCtx, name: string): BindingKind | undefined {
  const key = bindingKey(name);
  for (let i = ctx.scopes.length - 1; i >= 0; i--) {
    const found = ctx.scopes[i]!.bindings.get(key);
    if (found) return found.kind;
  }
  return undefined;
}

/** Find the root identifier of a target/expression chain (Scores[1].Name → Scores). */
function rootIdentifierName(expr: Expression): string | null {
  switch (expr.kind) {
    case 'Identifier':
      return expr.name;
    case 'IndexExpression':
      return rootIdentifierName(expr.array);
    case 'MemberExpression':
      return rootIdentifierName(expr.object);
    default:
      return null;
  }
}

/** Skip emitting when target is a CONSTANT (checker already diagnosed). */
function checkAssignToConstant(
  ctx: LowerCtx,
  target: AssignTarget,
): boolean {
  const name = rootIdentifierName(target);
  return name === null || lookupBinding(ctx, name) !== 'const';
}

function checkForVariableNotConstant(ctx: LowerCtx, variable: string): boolean {
  return lookupBinding(ctx, variable) !== 'const';
}

function lowerTarget(
  target: AssignTarget,
  ctx: LowerCtx,
): IrAssignTarget | null {
  const lowered = lowerExpression(target, ctx);
  if (!lowered) return null;
  // AssignTarget is a subset of Expression (Identifier | IndexExpression | MemberExpression);
  // lowerExpression preserves that shape for these three kinds.
  return lowered as IrAssignTarget;
}

function resolveFieldName(
  ctx: LowerCtx,
  object: Expression,
  property: string,
): string {
  const shape = exprShape(ctx, object);
  if (shape.kind === 'record') {
    const canonical = ctx.recordFields
      .get(shape.typeKey)
      ?.get(bindingKey(property));
    if (canonical) return canonical;
  }
  if (shape.kind === 'class') {
    const canonical = ctx.classFields
      .get(shape.typeKey)
      ?.get(bindingKey(property));
    if (canonical) return canonical;
  }
  // Fall back: unique field name across all TYPEs/CLASSes.
  let found: string | undefined;
  for (const fields of ctx.recordFields.values()) {
    const c = fields.get(bindingKey(property));
    if (c) {
      if (found && found !== c) return property;
      found = c;
    }
  }
  for (const fields of ctx.classFields.values()) {
    const c = fields.get(bindingKey(property));
    if (c) {
      if (found && found !== c) return property;
      found = c;
    }
  }
  return found ?? property;
}

/**
 * Resolve declared casing for `<object>.<method>(...)` / `SUPER.<method>(...)`.
 * For SUPER, resolves against the parent of the CLASS currently being lowered
 * (lexical parent, not the object's runtime type). Falls back to the written
 * casing when the owning CLASS can't be determined (e.g. unresolved shape).
 */
function resolveMethodName(
  ctx: LowerCtx,
  object: Expression,
  method: string,
): string {
  if (object.kind === 'SuperExpression') {
    if (bindingKey(method) === 'new') return method;
    const currentKey = ctx.currentClassName ? bindingKey(ctx.currentClassName) : null;
    const parentKey = currentKey ? ctx.classParent.get(currentKey) ?? null : null;
    if (parentKey) {
      const canonical = ctx.classMethods.get(parentKey)?.get(bindingKey(method));
      if (canonical) return canonical;
    }
    return method;
  }
  const shape = exprShape(ctx, object);
  if (shape.kind === 'class') {
    const canonical = ctx.classMethods.get(shape.typeKey)?.get(bindingKey(method));
    if (canonical) return canonical;
  }
  let found: string | undefined;
  for (const methods of ctx.classMethods.values()) {
    const c = methods.get(bindingKey(method));
    if (c) {
      if (found && found !== c) return method;
      found = c;
    }
  }
  return found ?? method;
}

/** Canonicalize a NamedType reference to its declared CLASS casing, if known. */
function canonicalTypeName(ctx: LowerCtx, name: string): string {
  return ctx.classCanonicalName.get(bindingKey(name)) ?? name;
}

function lowerExpression(
  expr: Expression,
  ctx: LowerCtx,
): IrExpression | null {
  const diagnostics = ctx.diagnostics;
  switch (expr.kind) {
    case 'IntegerLiteral':
      return { kind: 'IrIntegerLiteral', value: expr.value };
    case 'RealLiteral':
      return { kind: 'IrRealLiteral', value: expr.value };
    case 'StringLiteral':
      return { kind: 'IrStringLiteral', value: expr.value };
    case 'CharLiteral':
      return { kind: 'IrCharLiteral', value: expr.value };
    case 'BooleanLiteral':
      return { kind: 'IrBooleanLiteral', value: expr.value };
    case 'DateLiteral':
      return {
        kind: 'IrDateLiteral',
        day: expr.day,
        month: expr.month,
        year: expr.year,
      };
    case 'Identifier': {
      const scoped = tryResolveScopedName(ctx, expr.name);
      if (scoped !== null) return { kind: 'IrIdentifier', name: scoped };
      // Unbound inside a class method body and matches a known field
      // (own or inherited) → implicit `self.Field` (Cambridge has no `self`).
      if (ctx.currentClassFields) {
        const canonical = ctx.currentClassFields.get(bindingKey(expr.name));
        if (canonical) {
          return {
            kind: 'IrMemberExpression',
            object: { kind: 'IrIdentifier', name: 'self' },
            property: canonical,
          };
        }
      }
      return { kind: 'IrIdentifier', name: expr.name };
    }
    case 'IndexExpression': {
      const array = lowerExpression(expr.array, ctx);
      if (!array) return null;
      const indices: IrExpression[] = [];
      for (const idx of expr.indices) {
        const lowered = lowerExpression(idx, ctx);
        if (!lowered) return null;
        indices.push(lowered);
      }
      const shape = exprShape(ctx, expr.array);
      const lowers =
        shape.kind === 'array' && shape.dimensions.length === indices.length
          ? shape.dimensions.map((d) => d.lower)
          : undefined;
      return {
        kind: 'IrIndexExpression',
        array,
        indices,
        ...(lowers ? { lowers } : {}),
      };
    }
    case 'MemberExpression': {
      const object = lowerExpression(expr.object, ctx);
      if (!object) return null;
      const property = resolveFieldName(ctx, expr.object, expr.property.name);
      return {
        kind: 'IrMemberExpression',
        object,
        property,
      };
    }
    case 'UnaryExpression': {
      const argument = lowerExpression(expr.argument, ctx);
      if (!argument) return null;
      return {
        kind: 'IrUnaryExpression',
        operator: cambridgeUnaryToIr(expr.operator),
        argument,
      };
    }
    case 'BinaryExpression': {
      const left = lowerExpression(expr.left, ctx);
      const right = lowerExpression(expr.right, ctx);
      if (!left || !right) return null;
      return {
        kind: 'IrBinaryExpression',
        operator: cambridgeBinaryToIr(expr.operator),
        left,
        right,
      };
    }
    case 'GroupingExpression': {
      const inner = lowerExpression(expr.expression, ctx);
      if (!inner) return null;
      return { kind: 'IrGroupingExpression', expression: inner };
    }
    case 'CallExpression': {
      if (isPythonSyntaxKeyword(expr.callee.name)) {
        diagnostics.push({
          severity: 'error',
          code: 'T_CALL_PY_KEYWORD',
          message: `Function name '${expr.callee.name}' is a Python keyword and cannot be translated.`,
          span: expr.callee.span,
        });
        return null;
      }
      const callee = resolveName(ctx, expr.callee.name);
      const paramShapes = ctx.routineParams.get(bindingKey(callee)) ?? [];
      const args: IrExpression[] = [];
      for (let i = 0; i < expr.args.length; i++) {
        const arg = expr.args[i]!;
        let lowered = lowerExpression(arg, ctx);
        if (!lowered) return null;
        const shape = paramShapes[i] ?? exprShape(ctx, arg);
        lowered = maybeDeepCopy(ctx, lowered, shape);
        args.push(lowered);
      }
      return {
        kind: 'IrCallExpression',
        callee,
        args,
      };
    }
    case 'EofExpression': {
      const fileName = lowerExpression(expr.fileName, ctx);
      if (!fileName) return null;
      return { kind: 'IrEofExpression', fileName };
    }
    case 'NewExpression': {
      const className = canonicalTypeName(ctx, expr.className.name);
      const args: IrExpression[] = [];
      for (const a of expr.args) {
        let lowered = lowerExpression(a, ctx);
        if (!lowered) return null;
        lowered = maybeDeepCopy(ctx, lowered, exprShape(ctx, a));
        args.push(lowered);
      }
      return { kind: 'IrNewExpression', className, args };
    }
    case 'MethodCallExpression': {
      const args: IrExpression[] = [];
      for (const a of expr.args) {
        let lowered = lowerExpression(a, ctx);
        if (!lowered) return null;
        lowered = maybeDeepCopy(ctx, lowered, exprShape(ctx, a));
        args.push(lowered);
      }
      const method = resolveMethodName(ctx, expr.object, expr.method.name);
      if (expr.object.kind === 'SuperExpression') {
        return {
          kind: 'IrMethodCallExpression',
          object: { kind: 'IrSuperExpression' },
          method,
          args,
        };
      }
      const object = lowerExpression(expr.object, ctx);
      if (!object) return null;
      return { kind: 'IrMethodCallExpression', object, method, args };
    }
    case 'SuperExpression':
      // Bare SUPER only makes sense as the object of a method call; the
      // checker requires `SUPER.Method(...)`, so this path is defensive.
      diagnostics.push({
        severity: 'error',
        code: 'T_SUPER_INVALID',
        message: "SUPER is only valid as 'SUPER.Method(...)'.",
        span: expr.span,
      });
      return null;
    default: {
      const _exhaustive: never = expr;
      return _exhaustive;
    }
  }
}

/** Lower a statement list; skip unsupported nodes (diagnostics already emitted). */
function lowerBlock(
  statements: Statement[],
  ctx: LowerCtx,
): IrStatement[] {
  const out: IrStatement[] = [];
  for (const stmt of statements) {
    const lowered = lowerStatement(stmt, ctx);
    if (lowered) {
      out.push(lowered.ir);
    }
  }
  return out;
}

function lowerSimpleType(typeRef: SimpleType, ctx: LowerCtx): IrSimpleType {
  if (typeRef.kind === 'TypeName') {
    return { kind: 'IrScalarType', name: typeRef.name };
  }
  return { kind: 'IrNamedType', name: canonicalTypeName(ctx, typeRef.name) };
}

function lowerTypeRef(
  typeRef: TypeReference,
  ctx: LowerCtx,
): IrTypeReference | null {
  if (typeRef.kind === 'TypeName' || typeRef.kind === 'NamedType') {
    return lowerSimpleType(typeRef, ctx);
  }
  const dimensions: IrArrayDimension[] = [];
  for (const dim of typeRef.dimensions) {
    const lower = lowerExpression(dim.lower, ctx);
    const upper = lowerExpression(dim.upper, ctx);
    if (!lower || !upper) return null;
    dimensions.push({ kind: 'IrArrayDimension', lower, upper });
  }
  return {
    kind: 'IrArrayType',
    dimensions,
    elementType: lowerSimpleType(typeRef.elementType, ctx),
  };
}

function validateRoutineBinding(
  kind: 'PROCEDURE' | 'FUNCTION',
  name: { readonly name: string; readonly span: Statement['span'] },
  parameters: readonly { readonly name: { readonly name: string; readonly span: Statement['span'] } }[],
  diagnostics: TranslateDiagnostic[],
): boolean {
  if (isPythonSyntaxKeyword(name.name)) {
    diagnostics.push({
      severity: 'error',
      code: 'T_PROC_PY_KEYWORD',
      message: `${kind} name '${name.name}' is a Python keyword and cannot be translated to 'def ${name.name}(...):'.`,
      span: name.span,
    });
    return false;
  }
  if (isPythonTranslatorBuiltin(name.name)) {
    diagnostics.push({
      severity: 'warning',
      code: 'T_PROC_SHADOWS_BUILTIN',
      message: `${kind} name '${name.name}' shadows a Python builtin used by the translator (print/input/range).`,
      span: name.span,
    });
  }
  for (const p of parameters) {
    const pname = p.name.name;
    if (isPythonSyntaxKeyword(pname)) {
      diagnostics.push({
        severity: 'error',
        code: 'T_PROC_PY_KEYWORD',
        message: `Parameter name '${pname}' is a Python keyword and cannot be translated.`,
        span: p.name.span,
      });
      return false;
    }
    // Duplicate parameters are diagnosed by `@pseudopilot/checker`.
  }
  return true;
}

/**
 * Lower one CLASS member (property, PROCEDURE, or FUNCTION). Assumes the
 * caller has already set `ctx.currentClassFields` / `ctx.currentClassName`
 * for the enclosing CLASS so bare identifiers in method bodies rewrite to
 * `self.Field`.
 */
function lowerClassMember(
  member: ClassMember,
  ctx: LowerCtx,
): IrClassMember | null {
  const diagnostics = ctx.diagnostics;
  const visibility: IrVisibility = member.visibility ?? 'PUBLIC';

  if (member.kind === 'ClassPropertyDeclaration') {
    const typeRef = lowerTypeRef(member.typeRef, ctx);
    if (!typeRef) return null;
    for (const id of member.names) {
      if (isPythonSyntaxKeyword(id.name)) {
        diagnostics.push({
          severity: 'error',
          code: 'T_DECL_PY_KEYWORD',
          message: `Property name '${id.name}' is a Python keyword and cannot be translated ('self.${id.name}' is invalid Python).`,
          span: id.span,
        });
        return null;
      }
    }
    return {
      kind: 'IrClassProperty',
      names: member.names.map((id) => id.name),
      typeRef,
      visibility,
    };
  }

  // ClassProcedureDeclaration | ClassFunctionDeclaration
  const isConstructor = bindingKey(member.name.name) === 'new';
  if (!isConstructor && isPythonSyntaxKeyword(member.name.name)) {
    diagnostics.push({
      severity: 'error',
      code: 'T_PROC_PY_KEYWORD',
      message: `Method name '${member.name.name}' is a Python keyword and cannot be translated.`,
      span: member.name.span,
    });
    return null;
  }
  for (const p of member.parameters) {
    if (isPythonSyntaxKeyword(p.name.name)) {
      diagnostics.push({
        severity: 'error',
        code: 'T_PROC_PY_KEYWORD',
        message: `Parameter name '${p.name.name}' is a Python keyword and cannot be translated.`,
        span: p.name.span,
      });
      return null;
    }
  }

  pushScope(ctx);
  const parameters = member.parameters.map((p) => {
    const shape = shapeFromSimpleType(p.typeName, ctx);
    const pname =
      bindName(ctx, p.name.name, 'var', p.name.span, 'DECLARE', shape) ??
      p.name.name;
    return {
      kind: 'IrParameter' as const,
      name: pname,
      typeName: lowerSimpleType(p.typeName, ctx),
    };
  });
  const body = lowerBlock(member.body, ctx);
  popScope(ctx);

  if (member.kind === 'ClassProcedureDeclaration') {
    return {
      kind: 'IrClassProcedure',
      name: member.name.name,
      parameters,
      body,
      visibility,
    };
  }
  return {
    kind: 'IrClassFunction',
    name: member.name.name,
    parameters,
    returnType: lowerSimpleType(member.returnType, ctx),
    body,
    visibility,
  };
}

function lowerStatement(
  stmt: Statement,
  ctx: LowerCtx,
): { ir: IrStatement; span: Statement['span'] } | null {
  const diagnostics = ctx.diagnostics;
  switch (stmt.kind) {
    case 'AssignmentStatement': {
      if (!checkAssignToConstant(ctx, stmt.target)) return null;
      const target = lowerTarget(stmt.target, ctx);
      let value = lowerExpression(stmt.value, ctx);
      if (!target || !value) return null;
      const valueShape = exprShape(ctx, stmt.value);
      // Cambridge by-value: deep-copy composite RHS on store (records/arrays).
      if (isCompositeShape(valueShape) && value.kind !== 'IrDeepCopyExpression') {
        value = { kind: 'IrDeepCopyExpression', value };
      }
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrAssignment' as const,
          target,
          value,
        }),
      };
    }
    case 'InputStatement': {
      if (!checkAssignToConstant(ctx, stmt.target)) return null;
      const target = lowerTarget(stmt.target, ctx);
      if (!target) return null;
      const shape = exprShape(ctx, stmt.target);
      const valueType =
        shape.kind === 'scalar' && shape.typeName ? shape.typeName : null;
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrInput' as const,
          target,
          prompt: null,
          valueType,
        }),
      };
    }
    case 'OutputStatement': {
      const values: IrExpression[] = [];
      for (const e of stmt.expressions) {
        const lowered = lowerExpression(e, ctx);
        if (!lowered) return null;
        values.push(lowered);
      }
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrOutput' as const,
          values,
        }),
      };
    }
    case 'IfStatement': {
      const condition = lowerExpression(stmt.condition, ctx);
      if (!condition) return null;
      const consequent = lowerBlock(stmt.consequent, ctx);
      const elseIfClauses: IrElseIfClause[] = [];
      for (const clause of stmt.elseIfClauses) {
        const c = lowerExpression(clause.condition, ctx);
        if (!c) return null;
        elseIfClauses.push({
          kind: 'IrElseIfClause',
          condition: c,
          consequent: lowerBlock(clause.consequent, ctx),
        });
      }
      const alternate =
        stmt.alternate === null ? null : lowerBlock(stmt.alternate, ctx);
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrIfStatement' as const,
          condition,
          consequent,
          elseIfClauses,
          alternate,
        }),
      };
    }
    case 'CaseStatement': {
      const discriminant = lowerExpression(stmt.discriminant, ctx);
      if (!discriminant) return null;
      const arms: IrCaseArm[] = [];
      for (const arm of stmt.arms) {
        let label: IrCaseLabel;
        if (arm.label.kind === 'Value') {
          const value = lowerExpression(arm.label.value, ctx);
          if (!value) return null;
          label = { kind: 'IrCaseValue', value };
        } else {
          const low = lowerExpression(arm.label.low, ctx);
          const high = lowerExpression(arm.label.high, ctx);
          if (!low || !high) return null;
          label = { kind: 'IrCaseRange', low, high };
        }
        arms.push({
          kind: 'IrCaseArm',
          label,
          body: lowerBlock(arm.body, ctx),
        });
      }
      const otherwise =
        stmt.otherwise === null ? null : lowerBlock(stmt.otherwise, ctx);
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrCaseStatement' as const,
          discriminant,
          arms,
          otherwise,
        }),
      };
    }
    case 'WhileStatement': {
      const condition = lowerExpression(stmt.condition, ctx);
      if (!condition) return null;
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrWhileStatement' as const,
          condition,
          body: lowerBlock(stmt.body, ctx),
        }),
      };
    }
    case 'RepeatStatement': {
      const condition = lowerExpression(stmt.condition, ctx);
      if (!condition) return null;
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrRepeatStatement' as const,
          body: lowerBlock(stmt.body, ctx),
          condition,
        }),
      };
    }
    case 'ForStatement': {
      if (!checkForVariableNotConstant(ctx, stmt.variable)) {
        return null;
      }
      const start = lowerExpression(stmt.start, ctx);
      const end = lowerExpression(stmt.end, ctx);
      if (!start || !end) return null;
      let step: IrExpression | null = null;
      if (stmt.step) {
        step = lowerExpression(stmt.step, ctx);
        if (!step) return null;
      }
      const variable = registerBinding(ctx, stmt.variable, 'var');
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrForStatement' as const,
          variable,
          start,
          end,
          step,
          body: lowerBlock(stmt.body, ctx),
        }),
      };
    }
    case 'DeclareStatement': {
      const typeRef = lowerTypeRef(stmt.typeRef, ctx);
      if (!typeRef) return null;
      const shape = shapeFromTypeRef(stmt.typeRef, ctx);
      const names: string[] = [];
      for (const id of stmt.names) {
        const canonical = bindName(
          ctx,
          id.name,
          'var',
          id.span,
          'DECLARE',
          shape,
        );
        if (canonical === null) continue;
        if (!names.includes(canonical)) names.push(canonical);
      }
      if (names.length === 0) return null;
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrDeclareStatement' as const,
          names,
          typeRef,
        }),
      };
    }
    case 'TypeDeclaration': {
      const typeKey = bindingKey(stmt.name.name);
      const fieldNames = new Map<string, string>();
      const fieldShapes = new Map<string, ValueShape>();
      const fields: IrTypeField[] = [];
      for (const fieldDecl of stmt.fields) {
        const typeRef = lowerTypeRef(fieldDecl.typeRef, ctx);
        if (!typeRef) return null;
        const fshape = shapeFromTypeRef(fieldDecl.typeRef, ctx);
        const names: string[] = [];
        for (const id of fieldDecl.names) {
          const fk = bindingKey(id.name);
          if (!fieldNames.has(fk)) fieldNames.set(fk, id.name);
          fieldShapes.set(fk, fshape);
          names.push(fieldNames.get(fk)!);
        }
        fields.push({ kind: 'IrTypeField', names, typeRef });
      }
      ctx.recordFields.set(typeKey, fieldNames);
      ctx.recordFieldShapes.set(typeKey, fieldShapes);
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrTypeDeclaration' as const,
          name: stmt.name.name,
          fields,
        }),
      };
    }
    case 'ConstantStatement': {
      const value = lowerExpression(stmt.value, ctx);
      if (!value) return null;
      const name = bindName(
        ctx,
        stmt.name.name,
        'const',
        stmt.name.span,
        'CONSTANT',
      );
      if (name === null) return null;
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrConstantStatement' as const,
          name,
          value,
        }),
      };
    }
    case 'ProcedureDeclaration': {
      if (
        !validateRoutineBinding(
          'PROCEDURE',
          stmt.name,
          stmt.parameters,
          diagnostics,
        )
      ) {
        return null;
      }
      const procName = registerName(ctx, stmt.name.name);
      pushScope(ctx);
      const paramShapes: ValueShape[] = [];
      const parameters = stmt.parameters.map((p) => {
        const shape = shapeFromSimpleType(p.typeName, ctx);
        paramShapes.push(shape);
        const pname =
          bindName(ctx, p.name.name, 'var', p.name.span, 'DECLARE', shape) ??
          p.name.name;
        return {
          kind: 'IrParameter' as const,
          name: pname,
          typeName: lowerSimpleType(p.typeName, ctx),
        };
      });
      ctx.routineParams.set(bindingKey(procName), paramShapes);
      const body = lowerBlock(stmt.body, ctx);
      popScope(ctx);
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrProcedureDeclaration' as const,
          name: procName,
          parameters,
          body,
        }),
      };
    }
    case 'FunctionDeclaration': {
      if (
        !validateRoutineBinding(
          'FUNCTION',
          stmt.name,
          stmt.parameters,
          diagnostics,
        )
      ) {
        return null;
      }
      const fnName = registerName(ctx, stmt.name.name);
      pushScope(ctx);
      const paramShapes: ValueShape[] = [];
      const parameters = stmt.parameters.map((p) => {
        const shape = shapeFromSimpleType(p.typeName, ctx);
        paramShapes.push(shape);
        const pname =
          bindName(ctx, p.name.name, 'var', p.name.span, 'DECLARE', shape) ??
          p.name.name;
        return {
          kind: 'IrParameter' as const,
          name: pname,
          typeName: lowerSimpleType(p.typeName, ctx),
        };
      });
      ctx.routineParams.set(bindingKey(fnName), paramShapes);
      const body = lowerBlock(stmt.body, ctx);
      popScope(ctx);
      // Missing RETURN / unreachable-after-RETURN: `@pseudopilot/checker` (`C_*`).
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrFunctionDeclaration' as const,
          name: fnName,
          parameters,
          returnType: lowerSimpleType(stmt.returnType, ctx),
          body,
        }),
      };
    }
    case 'CallStatement': {
      if (stmt.callee.kind === 'MemberExpression') {
        const object = lowerExpression(stmt.callee.object, ctx);
        if (!object) return null;
        const method = resolveMethodName(ctx, stmt.callee.object, stmt.callee.property.name);
        const args: IrExpression[] = [];
        for (const a of stmt.args) {
          let lowered = lowerExpression(a, ctx);
          if (!lowered) return null;
          lowered = maybeDeepCopy(ctx, lowered, exprShape(ctx, a));
          args.push(lowered);
        }
        return {
          span: stmt.span,
          ir: withEmptyTrivia({
            kind: 'IrExpressionStatement' as const,
            expression: { kind: 'IrMethodCallExpression', object, method, args },
          }),
        };
      }
      const calleeRaw = stmt.callee.name;
      if (isPythonSyntaxKeyword(calleeRaw)) {
        diagnostics.push({
          severity: 'error',
          code: 'T_CALL_PY_KEYWORD',
          message: `CALL target '${calleeRaw}' is a Python keyword and cannot be translated to a Python call.`,
          span: stmt.callee.span,
        });
        return null;
      }
      const callee = resolveName(ctx, calleeRaw);
      const paramShapes = ctx.routineParams.get(bindingKey(callee)) ?? [];
      const args: IrExpression[] = [];
      for (let i = 0; i < stmt.args.length; i++) {
        const arg = stmt.args[i]!;
        let lowered = lowerExpression(arg, ctx);
        if (!lowered) return null;
        const shape = paramShapes[i] ?? exprShape(ctx, arg);
        lowered = maybeDeepCopy(ctx, lowered, shape);
        args.push(lowered);
      }
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrCallStatement' as const,
          callee,
          args,
        }),
      };
    }
    case 'ReturnStatement': {
      let value = lowerExpression(stmt.value, ctx);
      if (!value) return null;
      value = maybeDeepCopy(ctx, value, exprShape(ctx, stmt.value));
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrReturnStatement' as const,
          value,
        }),
      };
    }
    case 'OpenFileStatement': {
      const fileName = lowerExpression(stmt.fileName, ctx);
      if (!fileName) return null;
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrOpenFileStatement' as const,
          fileName,
          mode: stmt.mode,
        }),
      };
    }
    case 'ReadFileStatement': {
      if (!checkAssignToConstant(ctx, stmt.target)) return null;
      const fileName = lowerExpression(stmt.fileName, ctx);
      const target = lowerTarget(stmt.target, ctx);
      if (!fileName || !target) return null;
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrReadFileStatement' as const,
          fileName,
          target,
        }),
      };
    }
    case 'WriteFileStatement': {
      const fileName = lowerExpression(stmt.fileName, ctx);
      const value = lowerExpression(stmt.value, ctx);
      if (!fileName || !value) return null;
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrWriteFileStatement' as const,
          fileName,
          value,
        }),
      };
    }
    case 'CloseFileStatement': {
      const fileName = lowerExpression(stmt.fileName, ctx);
      if (!fileName) return null;
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrCloseFileStatement' as const,
          fileName,
        }),
      };
    }
    case 'ClassDeclaration': {
      if (isPythonSyntaxKeyword(stmt.name.name)) {
        diagnostics.push({
          severity: 'error',
          code: 'T_DECL_PY_KEYWORD',
          message: `CLASS name '${stmt.name.name}' is a Python keyword and cannot be translated.`,
          span: stmt.name.span,
        });
        return null;
      }
      const classKey = bindingKey(stmt.name.name);
      const savedFields = ctx.currentClassFields;
      const savedName = ctx.currentClassName;
      ctx.currentClassFields = ctx.classFields.get(classKey) ?? new Map();
      ctx.currentClassName = stmt.name.name;

      const members: IrClassMember[] = [];
      for (const member of stmt.members) {
        const lowered = lowerClassMember(member, ctx);
        if (lowered) members.push(lowered);
      }

      ctx.currentClassFields = savedFields;
      ctx.currentClassName = savedName;

      const inherits = stmt.inherits
        ? canonicalTypeName(ctx, stmt.inherits.name)
        : null;

      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrClassDeclaration' as const,
          name: stmt.name.name,
          inherits,
          members,
        }),
      };
    }
    case 'ExpressionStatement': {
      const expression = lowerExpression(stmt.expression, ctx);
      if (!expression) return null;
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrExpressionStatement' as const,
          expression,
        }),
      };
    }
    default: {
      const _exhaustive: never = stmt;
      return _exhaustive;
    }
  }
}

/**
 * Lower a Cambridge AST Program into IR.
 * Still lowers successfully parsed statements even when the overall parse had errors.
 */
export function lowerCambridgeProgram(
  program: Program,
  source: string,
  preserveTrivia: boolean,
): LowerResult {
  const diagnostics: TranslateDiagnostic[] = [];
  const classRegistry = buildClassRegistry(program);
  const ctx: LowerCtx = {
    diagnostics,
    scopes: [{ bindings: new Map() }],
    recordFields: new Map(),
    recordFieldShapes: new Map(),
    routineParams: new Map(),
    classNames: classRegistry.classNames,
    classCanonicalName: classRegistry.canonicalName,
    classParent: classRegistry.parent,
    classFields: classRegistry.fields,
    classFieldShapes: classRegistry.fieldShapes,
    classMethods: classRegistry.methods,
    currentClassFields: null,
    currentClassName: null,
  };

  // Hoist routine names so CALL-before-def still emits first-declaration casing.
  for (const stmt of program.body) {
    if (
      stmt.kind === 'ProcedureDeclaration' ||
      stmt.kind === 'FunctionDeclaration'
    ) {
      registerName(ctx, stmt.name.name);
    }
  }
  const paired: { stmt: IrStatement; span: Statement['span'] }[] = [];

  for (const stmt of program.body) {
    const lowered = lowerStatement(stmt, ctx);
    if (lowered) {
      paired.push({ stmt: lowered.ir, span: lowered.span });
    }
  }

  warnForwardProcedureCalls(paired, diagnostics);

  if (!preserveTrivia) {
    return {
      diagnostics,
      ir: {
        kind: 'IrProgram',
        body: paired.map((p) => p.stmt),
        leadingTrivia: emptyTrivia(),
        trailingTrivia: emptyTrivia(),
      },
    };
  }

  const attached = attachTriviaToStatements(source, 'slash', paired);
  return {
    diagnostics,
    ir: {
      kind: 'IrProgram',
      body: attached.body,
      leadingTrivia: attached.leadingTrivia,
      trailingTrivia: attached.trailingTrivia,
    },
  };
}

/** Warn when a top-level CALL appears before its PROCEDURE (invalid at Python import time). */
function warnForwardProcedureCalls(
  paired: { stmt: IrStatement; span: Statement['span'] }[],
  diagnostics: TranslateDiagnostic[],
): void {
  const defined = new Set<string>();
  for (const { stmt, span } of paired) {
    if (
      stmt.kind === 'IrProcedureDeclaration' ||
      stmt.kind === 'IrFunctionDeclaration'
    ) {
      defined.add(bindingKey(stmt.name));
      continue;
    }
    if (
      stmt.kind === 'IrCallStatement' &&
      !defined.has(bindingKey(stmt.callee))
    ) {
      const declaredLater = paired.some(
        (p) =>
          (p.stmt.kind === 'IrProcedureDeclaration' ||
            p.stmt.kind === 'IrFunctionDeclaration') &&
          bindingKey(p.stmt.name) === bindingKey(stmt.callee),
      );
      if (declaredLater) {
        diagnostics.push({
          severity: 'warning',
          code: 'T_CALL_BEFORE_PROC',
          message: `CALL '${stmt.callee}' appears before its PROCEDURE/FUNCTION definition; generated Python will raise NameError if the call runs first.`,
          span,
        });
      }
    }
  }
}
