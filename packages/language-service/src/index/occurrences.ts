/**
 * Walk the AST once to record every identifier use / declaration site.
 * Resolves each occurrence against checker symbols (no second semantic check).
 */

import type {
  AssignTarget,
  Expression,
  Program,
  Statement,
  SourceSpan,
  TypeReference,
} from '@pseudopilot/language-core';
import {
  identKey,
  lookupRecordField,
  type PpType,
  type SymbolInfo,
} from '@pseudopilot/checker';

export type OccurrenceKind = 'declaration' | 'reference' | 'write';

export type Occurrence = {
  readonly name: string;
  readonly span: SourceSpan;
  readonly kind: OccurrenceKind;
  /** Case-folded key linking to {@link SymbolInfo}. */
  readonly symbolKey: string;
  /** Scope container at the use site (`global` or routine name). */
  readonly containerName: string;
  /** Matched declaration from checker symbols (best-effort). */
  readonly symbol: SymbolInfo | null;
};

export type OccurrenceIndex = {
  /** All occurrences sorted by start offset. */
  readonly byOffset: readonly Occurrence[];
  /** symbolKey → occurrences (decl + refs). */
  readonly bySymbolKey: ReadonlyMap<string, readonly Occurrence[]>;
};

type BinderCtx = {
  containerName: string;
  /** Local keys visible in this container (params + locals), plus globals. */
  locals: Map<string, SymbolInfo>;
  readonly globals: Map<string, SymbolInfo>;
  readonly allByKey: Map<string, SymbolInfo[]>;
  readonly out: Occurrence[];
};

/**
 * Build occurrence index from AST + checker symbol list.
 * Scope resolution mirrors Cambridge case-insensitivity and routine containers.
 */
export function buildOccurrenceIndex(
  program: Program,
  symbols: readonly SymbolInfo[],
): OccurrenceIndex {
  const globals = new Map<string, SymbolInfo>();
  const allByKey = new Map<string, SymbolInfo[]>();
  for (const s of symbols) {
    const key = identKey(s.name);
    const list = allByKey.get(key) ?? [];
    list.push(s);
    allByKey.set(key, list);
    if ((s.containerName ?? 'global') === 'global') {
      globals.set(key, s);
    }
  }

  const out: Occurrence[] = [];
  const ctx: BinderCtx = {
    containerName: 'global',
    locals: new Map(),
    globals,
    allByKey,
    out,
  };

  for (const s of symbols) {
    if (s.builtin) continue;
    out.push({
      name: s.name,
      span: s.span,
      kind: 'declaration',
      symbolKey: symbolKeyOf(s),
      containerName: s.containerName ?? 'global',
      symbol: s,
    });
  }

  for (const stmt of program.body) {
    walkStatement(ctx, stmt);
  }

  out.sort((a, b) => a.span.start.offset - b.span.start.offset);

  const bySymbolKey = new Map<string, Occurrence[]>();
  for (const occ of out) {
    const list = bySymbolKey.get(occ.symbolKey) ?? [];
    list.push(occ);
    bySymbolKey.set(occ.symbolKey, list);
  }

  return { byOffset: out, bySymbolKey };
}

export function symbolKeyOf(s: SymbolInfo): string {
  return `${s.containerName ?? 'global'}::${identKey(s.name)}::${s.kind}`;
}

function resolve(
  ctx: BinderCtx,
  name: string,
): SymbolInfo | null {
  const key = identKey(name);
  const local = ctx.locals.get(key);
  if (local) return local;
  return ctx.globals.get(key) ?? null;
}

function addRef(
  ctx: BinderCtx,
  name: string,
  span: SourceSpan,
  kind: OccurrenceKind,
): void {
  const symbol = resolve(ctx, name);
  const container = symbol?.containerName ?? ctx.containerName;
  const symbolKey = symbol
    ? symbolKeyOf(symbol)
    : `${container}::${identKey(name)}::unknown`;
  ctx.out.push({
    name,
    span,
    kind,
    symbolKey,
    containerName: ctx.containerName,
    symbol,
  });
}

function walkStatement(ctx: BinderCtx, stmt: Statement): void {
  switch (stmt.kind) {
    case 'DeclareStatement':
      walkTypeRef(ctx, stmt.typeRef);
      return;
    case 'ConstantStatement':
      return;
    case 'TypeDeclaration':
      for (const field of stmt.fields) {
        walkTypeRef(ctx, field.typeRef);
      }
      return;
    case 'AssignmentStatement':
      walkAssignTarget(ctx, stmt.target, 'write');
      walkExpr(ctx, stmt.value);
      return;
    case 'InputStatement':
      walkAssignTarget(ctx, stmt.target, 'write');
      return;
    case 'OutputStatement':
      for (const e of stmt.expressions) walkExpr(ctx, e);
      return;
    case 'IfStatement':
      walkExpr(ctx, stmt.condition);
      for (const s of stmt.consequent) walkStatement(ctx, s);
      for (const c of stmt.elseIfClauses) {
        walkExpr(ctx, c.condition);
        for (const s of c.consequent) walkStatement(ctx, s);
      }
      if (stmt.alternate) {
        for (const s of stmt.alternate) walkStatement(ctx, s);
      }
      return;
    case 'WhileStatement':
      walkExpr(ctx, stmt.condition);
      for (const s of stmt.body) walkStatement(ctx, s);
      return;
    case 'RepeatStatement':
      for (const s of stmt.body) walkStatement(ctx, s);
      walkExpr(ctx, stmt.condition);
      return;
    case 'ForStatement':
      addRef(ctx, stmt.variable, stmt.span, 'write');
      walkExpr(ctx, stmt.start);
      walkExpr(ctx, stmt.end);
      if (stmt.step) walkExpr(ctx, stmt.step);
      for (const s of stmt.body) walkStatement(ctx, s);
      return;
    case 'CaseStatement':
      walkExpr(ctx, stmt.discriminant);
      for (const arm of stmt.arms) {
        if (arm.label.kind === 'Range') {
          walkExpr(ctx, arm.label.low);
          walkExpr(ctx, arm.label.high);
        } else {
          walkExpr(ctx, arm.label.value);
        }
        for (const s of arm.body) walkStatement(ctx, s);
      }
      if (stmt.otherwise) {
        for (const s of stmt.otherwise) walkStatement(ctx, s);
      }
      return;
    case 'CallStatement':
      if (stmt.callee.kind === 'MemberExpression') {
        walkExpr(ctx, stmt.callee.object);
        addMethodRef(ctx, stmt.callee.object, stmt.callee.property.name, stmt.callee.property.span, 'reference');
      } else {
        addRef(ctx, stmt.callee.name, stmt.callee.span, 'reference');
      }
      for (const a of stmt.args) walkExpr(ctx, a);
      return;
    case 'ReturnStatement':
      walkExpr(ctx, stmt.value);
      return;
    case 'ProcedureDeclaration':
    case 'FunctionDeclaration': {
      const prev = ctx.containerName;
      const prevLocals = ctx.locals;
      ctx.containerName = stmt.name.name;
      ctx.locals = new Map();
      for (const s of ctx.allByKey.values()) {
        for (const sym of s) {
          if (
            (sym.containerName ?? 'global') === stmt.name.name &&
            (sym.kind === 'parameter' ||
              sym.kind === 'variable' ||
              sym.kind === 'constant')
          ) {
            ctx.locals.set(identKey(sym.name), sym);
          }
        }
      }
      for (const p of stmt.parameters) {
        walkTypeRef(ctx, p.typeName);
      }
      if (stmt.kind === 'FunctionDeclaration') {
        walkTypeRef(ctx, stmt.returnType);
      }
      for (const s of stmt.body) walkStatement(ctx, s);
      ctx.containerName = prev;
      ctx.locals = prevLocals;
      return;
    }
    case 'OpenFileStatement':
      walkExpr(ctx, stmt.fileName);
      return;
    case 'ReadFileStatement':
      walkExpr(ctx, stmt.fileName);
      walkAssignTarget(ctx, stmt.target, 'write');
      return;
    case 'WriteFileStatement':
      walkExpr(ctx, stmt.fileName);
      walkExpr(ctx, stmt.value);
      return;
    case 'CloseFileStatement':
      walkExpr(ctx, stmt.fileName);
      return;
    case 'ClassDeclaration': {
      for (const member of stmt.members) {
        if (member.kind === 'ClassPropertyDeclaration') {
          walkTypeRef(ctx, member.typeRef);
          continue;
        }
        const prev = ctx.containerName;
        const prevLocals = ctx.locals;
        ctx.containerName = `${stmt.name.name}.${member.name.name}`;
        ctx.locals = new Map();
        for (const list of ctx.allByKey.values()) {
          for (const sym of list) {
            if (
              (sym.containerName ?? 'global') === ctx.containerName &&
              (sym.kind === 'parameter' ||
                sym.kind === 'variable' ||
                sym.kind === 'constant')
            ) {
              ctx.locals.set(identKey(sym.name), sym);
            }
          }
        }
        for (const p of member.parameters) walkTypeRef(ctx, p.typeName);
        if (member.kind === 'ClassFunctionDeclaration') {
          walkTypeRef(ctx, member.returnType);
        }
        for (const s of member.body) walkStatement(ctx, s);
        ctx.containerName = prev;
        ctx.locals = prevLocals;
      }
      return;
    }
    case 'ExpressionStatement':
      walkExpr(ctx, stmt.expression);
      return;
    default: {
      const _exhaustive: never = stmt;
      return _exhaustive;
    }
  }
}

function walkAssignTarget(
  ctx: BinderCtx,
  target: AssignTarget,
  kind: OccurrenceKind,
): void {
  if (target.kind === 'Identifier') {
    addRef(ctx, target.name, target.span, kind);
    return;
  }
  if (target.kind === 'MemberExpression') {
    walkExpr(ctx, target.object);
    addFieldRef(ctx, target.object, target.property.name, target.property.span, kind);
    return;
  }
  walkExpr(ctx, target.array);
  for (const idx of target.indices) walkExpr(ctx, idx);
}

/** Depth guard against pathological/undetected inheritance cycles. */
const MAX_INHERITANCE_DEPTH = 64;

/** The `class`-kind symbol named `name`, if any (case-insensitive). */
function classSymbolByName(ctx: BinderCtx, name: string): SymbolInfo | undefined {
  const key = identKey(name);
  return (ctx.allByKey.get(key) ?? []).find((s) => s.kind === 'class');
}

/**
 * Resolve `memberName` (a field or method) declared on CLASS `className` or
 * one of its ancestors — own members first, so a child override wins.
 * Mirrors `@pseudopilot/checker`'s `findClassFieldOwner` / `findClassMethodOwner`,
 * but works off the language-service's flat symbol list (no checker re-run).
 */
function resolveClassMemberSymbol(
  ctx: BinderCtx,
  className: string,
  memberName: string,
  memberKind: 'field' | 'method',
): SymbolInfo | null {
  const memberKey = identKey(memberName);
  let current = classSymbolByName(ctx, className);
  let depth = 0;
  while (current && depth < MAX_INHERITANCE_DEPTH) {
    const currentClassKey = identKey(current.name);
    const found = (ctx.allByKey.get(memberKey) ?? []).find(
      (s) => s.kind === memberKind && identKey(s.containerName ?? '') === currentClassKey,
    );
    if (found) return found;
    if (current.type.kind !== 'class' || !current.type.inherits) return null;
    current = classSymbolByName(ctx, current.type.inherits);
    depth += 1;
  }
  return null;
}

function addFieldRef(
  ctx: BinderCtx,
  object: Expression,
  name: string,
  span: SourceSpan,
  kind: OccurrenceKind,
): void {
  const objType = resolveExprType(ctx, object);
  let symbol: SymbolInfo | null = null;
  if (objType?.kind === 'record') {
    const field = lookupRecordField(objType, name);
    if (field) {
      const key = identKey(name);
      const typeKey = identKey(objType.name);
      symbol =
        (ctx.allByKey.get(key) ?? []).find(
          (s) =>
            s.kind === 'field' &&
            identKey(s.containerName ?? '') === typeKey,
        ) ?? null;
    }
  } else if (objType?.kind === 'class') {
    // Resolves properties declared on this CLASS or any ancestor (child
    // overrides shadow a same-named ancestor field, matching the checker).
    symbol = resolveClassMemberSymbol(ctx, objType.name, name, 'field');
  }
  const container = symbol?.containerName ?? ctx.containerName;
  const symbolKey = symbol
    ? symbolKeyOf(symbol)
    : `${container}::${identKey(name)}::field`;
  ctx.out.push({
    name,
    span,
    kind,
    symbolKey,
    containerName: ctx.containerName,
    symbol,
  });
}

/** Same as {@link addFieldRef} but for `Obj.Method(...)` / `SUPER.Method(...)`. */
function addMethodRef(
  ctx: BinderCtx,
  object: Expression,
  name: string,
  span: SourceSpan,
  kind: OccurrenceKind,
): void {
  let symbol: SymbolInfo | null = null;
  if (object.kind !== 'SuperExpression') {
    const objType = resolveExprType(ctx, object);
    if (objType?.kind === 'class') {
      symbol = resolveClassMemberSymbol(ctx, objType.name, name, 'method');
    }
  } else if (ctx.containerName.includes('.')) {
    // `SUPER.Method(...)` resolves against the enclosing class's *parent*.
    const ownerClass = ctx.containerName.split('.')[0]!;
    const ownerSym = classSymbolByName(ctx, ownerClass);
    if (ownerSym && ownerSym.type.kind === 'class' && ownerSym.type.inherits) {
      symbol = resolveClassMemberSymbol(ctx, ownerSym.type.inherits, name, 'method');
    }
  }
  const container = symbol?.containerName ?? ctx.containerName;
  const symbolKey = symbol
    ? symbolKeyOf(symbol)
    : `${container}::${identKey(name)}::method`;
  ctx.out.push({
    name,
    span,
    kind,
    symbolKey,
    containerName: ctx.containerName,
    symbol,
  });
}

/** Best-effort static type of an expression for field binding (no second checker). */
function resolveExprType(ctx: BinderCtx, expr: Expression): PpType | null {
  switch (expr.kind) {
    case 'Identifier': {
      const sym = resolve(ctx, expr.name);
      return sym?.type ?? null;
    }
    case 'MemberExpression': {
      const obj = resolveExprType(ctx, expr.object);
      if (obj?.kind === 'record') {
        return lookupRecordField(obj, expr.property.name)?.type ?? null;
      }
      if (obj?.kind === 'class') {
        const sym = resolveClassMemberSymbol(ctx, obj.name, expr.property.name, 'field');
        return sym?.type ?? null;
      }
      return null;
    }
    case 'IndexExpression': {
      const arr = resolveExprType(ctx, expr.array);
      if (arr?.kind !== 'array') return null;
      return arr.element;
    }
    case 'GroupingExpression':
      return resolveExprType(ctx, expr.expression);
    default:
      return null;
  }
}

function walkTypeRef(ctx: BinderCtx, ref: TypeReference): void {
  if (ref.kind === 'NamedType') {
    addTypeRef(ctx, ref.name, ref.span);
    return;
  }
  if (ref.kind === 'ArrayType') {
    for (const dim of ref.dimensions) {
      walkExpr(ctx, dim.lower);
      walkExpr(ctx, dim.upper);
    }
    if (ref.elementType.kind === 'NamedType') {
      addTypeRef(ctx, ref.elementType.name, ref.elementType.span);
    }
  }
}

function addTypeRef(ctx: BinderCtx, name: string, span: SourceSpan): void {
  const key = identKey(name);
  const candidates = (ctx.allByKey.get(key) ?? []).filter(
    (s) => s.kind === 'type' || s.kind === 'class',
  );
  const symbol = candidates[0] ?? null;
  const container = symbol?.containerName ?? 'global';
  const symbolKey = symbol
    ? symbolKeyOf(symbol)
    : `${container}::${identKey(name)}::type`;
  ctx.out.push({
    name,
    span,
    kind: 'reference',
    symbolKey,
    containerName: ctx.containerName,
    symbol,
  });
}

function walkExpr(ctx: BinderCtx, expr: Expression): void {
  switch (expr.kind) {
    case 'Identifier':
      addRef(ctx, expr.name, expr.span, 'reference');
      return;
    case 'IntegerLiteral':
    case 'RealLiteral':
    case 'StringLiteral':
    case 'CharLiteral':
    case 'BooleanLiteral':
    case 'DateLiteral':
      return;
    case 'UnaryExpression':
      walkExpr(ctx, expr.argument);
      return;
    case 'BinaryExpression':
      walkExpr(ctx, expr.left);
      walkExpr(ctx, expr.right);
      return;
    case 'GroupingExpression':
      walkExpr(ctx, expr.expression);
      return;
    case 'IndexExpression':
      walkExpr(ctx, expr.array);
      for (const idx of expr.indices) walkExpr(ctx, idx);
      return;
    case 'MemberExpression':
      walkExpr(ctx, expr.object);
      addFieldRef(ctx, expr.object, expr.property.name, expr.property.span, 'reference');
      return;
    case 'CallExpression':
      addRef(ctx, expr.callee.name, expr.callee.span, 'reference');
      for (const a of expr.args) walkExpr(ctx, a);
      return;
    case 'EofExpression':
      walkExpr(ctx, expr.fileName);
      return;
    case 'MethodCallExpression':
      if (expr.object.kind !== 'SuperExpression') walkExpr(ctx, expr.object);
      addMethodRef(ctx, expr.object, expr.method.name, expr.method.span, 'reference');
      for (const a of expr.args) walkExpr(ctx, a);
      return;
    case 'NewExpression':
      addTypeRef(ctx, expr.className.name, expr.className.span);
      for (const a of expr.args) walkExpr(ctx, a);
      return;
    case 'SuperExpression':
      return;
    default: {
      const _exhaustive: never = expr;
      return _exhaustive;
    }
  }
}
