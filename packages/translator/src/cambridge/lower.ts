import type {
  AssignTarget,
  Expression,
  Program,
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
  type IrElseIfClause,
  type IrExpression,
  type IrProgram,
  type IrStatement,
  type IrTypeReference,
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

type ScopeBinding = {
  readonly kind: BindingKind;
  readonly canonical: string;
};

type ScopeFrame = {
  readonly bindings: Map<string, ScopeBinding>;
};

type LowerCtx = {
  readonly diagnostics: TranslateDiagnostic[];
  readonly scopes: ScopeFrame[];
};

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

/**
 * Resolve an identifier to first-declaration casing in the nearest scope.
 * Python is case-sensitive; Cambridge is not — without this, `Count`/`count`
 * become different Python names and crash at runtime.
 */
function resolveName(ctx: LowerCtx, name: string): string {
  const key = bindingKey(name);
  for (let i = ctx.scopes.length - 1; i >= 0; i--) {
    const found = ctx.scopes[i]!.bindings.get(key);
    if (found) return found.canonical;
  }
  return name;
}

/** Register a binding; keeps first-seen casing within the current frame. */
function registerBinding(
  ctx: LowerCtx,
  name: string,
  kind: BindingKind,
): string {
  const key = bindingKey(name);
  const frame = ctx.scopes[ctx.scopes.length - 1]!;
  const existing = frame.bindings.get(key);
  if (existing) return existing.canonical;
  frame.bindings.set(key, { kind, canonical: name });
  return name;
}

/** Register a name (routine) without treating it as assignable storage. */
function registerName(ctx: LowerCtx, name: string): string {
  return registerBinding(ctx, name, 'var');
}

function bindName(
  ctx: LowerCtx,
  name: string,
  kind: BindingKind,
  span: Statement['span'],
  what: 'DECLARE' | 'CONSTANT',
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
  return registerBinding(ctx, name, kind);
}

function lookupBinding(ctx: LowerCtx, name: string): BindingKind | undefined {
  const key = bindingKey(name);
  for (let i = ctx.scopes.length - 1; i >= 0; i--) {
    const found = ctx.scopes[i]!.bindings.get(key);
    if (found) return found.kind;
  }
  return undefined;
}

/** Skip emitting when target is a CONSTANT (checker already diagnosed). */
function checkAssignToConstant(
  ctx: LowerCtx,
  target: AssignTarget,
): boolean {
  const name = target.kind === 'Identifier' ? target.name : target.array.name;
  return lookupBinding(ctx, name) !== 'const';
}

function checkForVariableNotConstant(ctx: LowerCtx, variable: string): boolean {
  return lookupBinding(ctx, variable) !== 'const';
}

function lowerTarget(
  target: AssignTarget,
  ctx: LowerCtx,
): IrAssignTarget | null {
  if (target.kind === 'Identifier') {
    return { kind: 'IrIdentifier', name: resolveName(ctx, target.name) };
  }
  const indices: IrExpression[] = [];
  for (const idx of target.indices) {
    const lowered = lowerExpression(idx, ctx);
    if (!lowered) return null;
    indices.push(lowered);
  }
  return {
    kind: 'IrIndexExpression',
    array: { kind: 'IrIdentifier', name: resolveName(ctx, target.array.name) },
    indices,
  };
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
    case 'Identifier':
      return { kind: 'IrIdentifier', name: resolveName(ctx, expr.name) };
    case 'IndexExpression': {
      const indices: IrExpression[] = [];
      for (const idx of expr.indices) {
        const lowered = lowerExpression(idx, ctx);
        if (!lowered) return null;
        indices.push(lowered);
      }
      return {
        kind: 'IrIndexExpression',
        array: {
          kind: 'IrIdentifier',
          name: resolveName(ctx, expr.array.name),
        },
        indices,
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
      const args: IrExpression[] = [];
      for (const arg of expr.args) {
        const lowered = lowerExpression(arg, ctx);
        if (!lowered) return null;
        args.push(lowered);
      }
      return {
        kind: 'IrCallExpression',
        callee: resolveName(ctx, expr.callee.name),
        args,
      };
    }
    case 'EofExpression': {
      const fileName = lowerExpression(expr.fileName, ctx);
      if (!fileName) return null;
      return { kind: 'IrEofExpression', fileName };
    }
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

function lowerTypeRef(
  typeRef: TypeReference,
  ctx: LowerCtx,
): IrTypeReference | null {
  if (typeRef.kind === 'TypeName') {
    return { kind: 'IrScalarType', name: typeRef.name };
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
    elementType: typeRef.elementType.name,
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

function lowerStatement(
  stmt: Statement,
  ctx: LowerCtx,
): { ir: IrStatement; span: Statement['span'] } | null {
  const diagnostics = ctx.diagnostics;
  switch (stmt.kind) {
    case 'AssignmentStatement': {
      if (!checkAssignToConstant(ctx, stmt.target)) return null;
      const target = lowerTarget(stmt.target, ctx);
      const value = lowerExpression(stmt.value, ctx);
      if (!target || !value) return null;
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
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrInput' as const,
          target,
          prompt: null,
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
      const names: string[] = [];
      for (const id of stmt.names) {
        // Duplicate DECLARE names are diagnosed by `@pseudopilot/checker`.
        const canonical = bindName(ctx, id.name, 'var', id.span, 'DECLARE');
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
      const parameters = stmt.parameters.map((p) => {
        const pname =
          bindName(ctx, p.name.name, 'var', p.name.span, 'DECLARE') ??
          p.name.name;
        return {
          kind: 'IrParameter' as const,
          name: pname,
          typeName: p.typeName.name,
        };
      });
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
      const parameters = stmt.parameters.map((p) => {
        const pname =
          bindName(ctx, p.name.name, 'var', p.name.span, 'DECLARE') ??
          p.name.name;
        return {
          kind: 'IrParameter' as const,
          name: pname,
          typeName: p.typeName.name,
        };
      });
      const body = lowerBlock(stmt.body, ctx);
      popScope(ctx);
      // Missing RETURN / unreachable-after-RETURN: `@pseudopilot/checker` (`C_*`).
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrFunctionDeclaration' as const,
          name: fnName,
          parameters,
          returnType: stmt.returnType.name,
          body,
        }),
      };
    }
    case 'CallStatement': {
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
      const args: IrExpression[] = [];
      for (const arg of stmt.args) {
        const lowered = lowerExpression(arg, ctx);
        if (!lowered) return null;
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
      const value = lowerExpression(stmt.value, ctx);
      if (!value) return null;
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
  const ctx: LowerCtx = {
    diagnostics,
    scopes: [{ bindings: new Map() }],
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
