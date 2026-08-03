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
} from '@pseudopilot/language-core';
import { identKey, type SymbolInfo } from '@pseudopilot/checker';

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
      // Declarations already recorded from checker symbols.
      return;
    case 'ConstantStatement':
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
      addRef(ctx, stmt.callee.name, stmt.callee.span, 'reference');
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
  addRef(ctx, target.array.name, target.array.span, kind);
  for (const idx of target.indices) walkExpr(ctx, idx);
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
      addRef(ctx, expr.array.name, expr.array.span, 'reference');
      for (const idx of expr.indices) walkExpr(ctx, idx);
      return;
    case 'CallExpression':
      addRef(ctx, expr.callee.name, expr.callee.span, 'reference');
      for (const a of expr.args) walkExpr(ctx, a);
      return;
    case 'EofExpression':
      walkExpr(ctx, expr.fileName);
      return;
    default: {
      const _exhaustive: never = expr;
      return _exhaustive;
    }
  }
}
