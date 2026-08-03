import type {
  AssignTarget,
  Expression,
  FunctionDeclaration,
  Parameter,
  ProcedureDeclaration,
  Program,
  Statement,
  TypeReference,
} from '@pseudopilot/language-core';
import {
  lookupBuiltin,
  CORE_BUILTINS,
  type BuiltinSpec,
} from '@pseudopilot/language-core';
import { makeSymbol, Scope, identKey } from './scope.js';
import {
  binaryResultType,
  errorType,
  formatType,
  isAssignable,
  isBoolean,
  isIndexType,
  isNumeric,
  literalType,
  lookupRecordField,
  resolveSimpleType,
  scalar,
  unaryResultType,
} from './type-system.js';
import type {
  CheckerDiagnostic,
  CheckOptions,
  CheckResult,
  PpType,
  ScalarTypeName,
} from './types.js';
import { DEFAULT_MAX_CHECKER_DIAGNOSTICS } from './types.js';
import {
  checkEofExpression,
  checkFileStatement,
} from './file/check-files.js';
import {
  registerTypeDeclarations,
  resolveUserTypeRef,
} from './records.js';

const BUILTIN_SPAN = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
} as const;

type Ctx = {
  readonly diagnostics: CheckerDiagnostic[];
  readonly maxDiagnostics: number;
  diagLimitReported: boolean;
  scope: Scope;
  /** Innermost FUNCTION return type when inside a function body. */
  functionReturn: PpType | null;
  /** True when inside a PROCEDURE (RETURN forbidden — parser also checks). */
  inProcedure: boolean;
  /**
   * Best-effort open-file map keyed by string-literal path.
   * Files are process-global in Cambridge; not scoped to procedures.
   */
  openFiles: Map<string, import('./file/check-files.js').FileOpenState>;
  /** All successful bindings for the language service (no second binder). */
  readonly symbols: import('./types.js').SymbolInfo[];
  /** TYPE … ENDTYPE registry (case-folded keys). */
  readonly typeTable: Map<string, PpType>;
};

function diag(
  ctx: Ctx,
  partial: {
    severity?: CheckerDiagnostic['severity'];
    code: string;
    message: string;
    span: CheckerDiagnostic['span'];
    help?: string;
  },
): void {
  if (ctx.diagnostics.length >= ctx.maxDiagnostics) {
    if (!ctx.diagLimitReported) {
      ctx.diagLimitReported = true;
      ctx.diagnostics.push({
        severity: 'warning',
        code: 'C_TOO_MANY_DIAGNOSTICS',
        message: `Too many diagnostics (limit ${ctx.maxDiagnostics}); further messages suppressed.`,
        span: partial.span,
        help: 'Fix earlier errors first, or raise CheckOptions.maxDiagnostics.',
      });
    }
    return;
  }
  if (partial.help !== undefined) {
    ctx.diagnostics.push({
      severity: partial.severity ?? 'error',
      code: partial.code,
      message: partial.message,
      span: partial.span,
      help: partial.help,
    });
    return;
  }
  ctx.diagnostics.push({
    severity: partial.severity ?? 'error',
    code: partial.code,
    message: partial.message,
    span: partial.span,
  });
}

function reportDup(ctx: Ctx, diagnostic: CheckerDiagnostic): void {
  if (diagnostic.help !== undefined) {
    diag(ctx, {
      severity: diagnostic.severity,
      code: diagnostic.code,
      message: diagnostic.message,
      span: diagnostic.span,
      help: diagnostic.help,
    });
    return;
  }
  diag(ctx, {
    severity: diagnostic.severity,
    code: diagnostic.code,
    message: diagnostic.message,
    span: diagnostic.span,
  });
}

function defineSymbol(
  ctx: Ctx,
  symbol: Parameters<Scope['define']>[0],
): boolean {
  const ok = ctx.scope.define(symbol, (d) => reportDup(ctx, d));
  if (ok) {
    const withContainer =
      symbol.containerName !== undefined
        ? symbol
        : { ...symbol, containerName: ctx.scope.name };
    ctx.symbols.push(withContainer);
  }
  return ok;
}

/**
 * Semantic check of a Cambridge AST program.
 *
 * Pass 0: register TYPE … ENDTYPE into the type table.
 * Pass 1: hoist global PROCEDURE / FUNCTION signatures.
 * Pass 2: check statements in order (DECLARE/CONSTANT bind when seen).
 *
 * Identifier binding is **case-insensitive** (Cambridge / SPECIFICATION §13.6).
 */
export function check(
  program: Program,
  options?: CheckOptions,
): CheckResult {
  const maxDiagnostics =
    options?.maxDiagnostics ?? DEFAULT_MAX_CHECKER_DIAGNOSTICS;
  const diagnostics: CheckerDiagnostic[] = [];
  const symbols: import('./types.js').SymbolInfo[] = [];
  const global = new Scope(null, 'global');
  const typeTable = new Map<string, PpType>();
  const ctx: Ctx = {
    diagnostics,
    maxDiagnostics: Math.max(1, maxDiagnostics),
    diagLimitReported: false,
    scope: global,
    functionReturn: null,
    inProcedure: false,
    openFiles: new Map(),
    symbols,
    typeTable,
  };

  // Seed Core builtins before user routines (soft-reserved names).
  injectBuiltins(ctx);

  // Pass 0 — TYPE … ENDTYPE (before routines so params/returns can use them).
  registerTypeDeclarations(
    {
      typeTable: ctx.typeTable,
      diag: (partial) => diag(ctx, partial),
      defineSymbol: (symbol) => defineSymbol(ctx, symbol),
      recordFieldSymbol: (symbol) => {
        const withContainer =
          symbol.containerName !== undefined
            ? symbol
            : { ...symbol, containerName: ctx.scope.name };
        ctx.symbols.push(withContainer);
      },
    },
    program,
  );

  // Pass 1 — routine signatures (enables CALL before definition).
  for (const stmt of program.body) {
    if (stmt.kind === 'ProcedureDeclaration') {
      hoistRoutine(ctx, stmt, 'procedure');
    } else if (stmt.kind === 'FunctionDeclaration') {
      hoistRoutine(ctx, stmt, 'function');
    }
  }

  // Pass 2 — full check.
  for (const stmt of program.body) {
    checkStatement(ctx, stmt);
  }

  return {
    ok: !diagnostics.some((d) => d.severity === 'error'),
    diagnostics,
    globalSymbols: global.snapshot(),
    symbols,
  };
}

function injectBuiltins(ctx: Ctx): void {
  for (const b of CORE_BUILTINS) {
    const params = b.params.map((p) =>
      scalar(primaryAccept(p.accept)),
    );
    const returns: ScalarTypeName =
      b.returns === 'same-as-arg0' ? 'STRING' : b.returns;
    defineSymbol(
      ctx,
      makeSymbol(
        b.name,
        'function',
        { kind: 'function', params, returns: scalar(returns) },
        BUILTIN_SPAN,
        { builtin: true, containerName: 'global' },
      ),
    );
  }
}

/** Representative type for symbol tables (first accepted scalar). */
function primaryAccept(accept: readonly ScalarTypeName[]): ScalarTypeName {
  return accept[0]!;
}

function hoistRoutine(
  ctx: Ctx,
  stmt: ProcedureDeclaration | FunctionDeclaration,
  kind: 'procedure' | 'function',
): void {
  const params = stmt.parameters.map((p) =>
    resolveUserTypeRef(p.typeName, ctx.typeTable, (partial) => diag(ctx, partial)),
  );
  const type: PpType =
    kind === 'procedure'
      ? { kind: 'procedure', params }
      : {
          kind: 'function',
          params,
          returns: resolveSimpleType(
            (stmt as FunctionDeclaration).returnType,
            ctx.typeTable,
          ),
        };

  defineSymbol(ctx, makeSymbol(stmt.name.name, kind, type, stmt.name.span));
}

function checkStatement(ctx: Ctx, stmt: Statement): void {
  switch (stmt.kind) {
    case 'TypeDeclaration':
      // Registered in pass 0; still validate ARRAY bounds on fields.
      for (const field of stmt.fields) {
        checkTypeRefBounds(ctx, field.typeRef);
      }
      return;
    case 'DeclareStatement': {
      const type = resolveUserTypeRef(stmt.typeRef, ctx.typeTable, (partial) =>
        diag(ctx, partial),
      );
      checkTypeRefBounds(ctx, stmt.typeRef);
      const seen = new Set<string>();
      for (const id of stmt.names) {
        const key = identKey(id.name);
        if (seen.has(key)) {
          diag(ctx, {
            code: 'C_DUP_VARIABLE',
            message: `Duplicate name '${id.name}' in DECLARE list.`,
            span: id.span,
            help: 'Names in a single DECLARE are case-insensitive.',
          });
          continue;
        }
        seen.add(key);
        defineSymbol(ctx, makeSymbol(id.name, 'variable', type, id.span));
      }
      return;
    }
    case 'ConstantStatement': {
      const valueType = inferExpr(ctx, stmt.value);
      const lit = literalType(stmt.value);
      if (!lit) {
        diag(ctx, {
          code: 'C_CONSTANT_NOT_LITERAL',
          message: `CONSTANT '${stmt.name.name}' value must be a literal.`,
          span: stmt.value.span,
        });
      }
      defineSymbol(
        ctx,
        makeSymbol(
          stmt.name.name,
          'constant',
          lit ?? valueType,
          stmt.name.span,
        ),
      );
      return;
    }
    case 'AssignmentStatement': {
      checkAssignment(ctx, stmt.target, inferExpr(ctx, stmt.value), stmt.span);
      return;
    }
    case 'InputStatement': {
      checkAssignableTarget(ctx, stmt.target, stmt.span, 'INPUT');
      return;
    }
    case 'OutputStatement': {
      for (const e of stmt.expressions) inferExpr(ctx, e);
      return;
    }
    case 'IfStatement': {
      expectBoolean(ctx, inferExpr(ctx, stmt.condition), stmt.condition.span, 'IF');
      for (const s of stmt.consequent) checkStatement(ctx, s);
      for (const c of stmt.elseIfClauses) {
        expectBoolean(ctx, inferExpr(ctx, c.condition), c.condition.span, 'ELSE IF');
        for (const s of c.consequent) checkStatement(ctx, s);
      }
      if (stmt.alternate) {
        for (const s of stmt.alternate) checkStatement(ctx, s);
      }
      return;
    }
    case 'WhileStatement': {
      expectBoolean(
        ctx,
        inferExpr(ctx, stmt.condition),
        stmt.condition.span,
        'WHILE',
      );
      for (const s of stmt.body) checkStatement(ctx, s);
      return;
    }
    case 'RepeatStatement': {
      for (const s of stmt.body) checkStatement(ctx, s);
      expectBoolean(
        ctx,
        inferExpr(ctx, stmt.condition),
        stmt.condition.span,
        'UNTIL',
      );
      return;
    }
    case 'ForStatement': {
      checkFor(ctx, stmt);
      return;
    }
    case 'CaseStatement': {
      const disc = inferExpr(ctx, stmt.discriminant);
      for (const arm of stmt.arms) {
        if (arm.label.kind === 'Value') {
          const lt = inferExpr(ctx, arm.label.value);
          if (
            disc.kind !== 'error' &&
            lt.kind !== 'error' &&
            !isAssignable(disc, lt) &&
            !isAssignable(lt, disc)
          ) {
            diag(ctx, {
              severity: 'warning',
              code: 'C_CASE_LABEL_TYPE',
              message: `CASE label type ${formatType(lt)} may not match discriminant ${formatType(disc)}.`,
              span: arm.label.span,
            });
          }
        } else {
          const low = inferExpr(ctx, arm.label.low);
          const high = inferExpr(ctx, arm.label.high);
          if (!isNumeric(low) && low.kind !== 'error') {
            diag(ctx, {
              code: 'C_CASE_RANGE_TYPE',
              message: 'CASE range bounds should be numeric.',
              span: arm.label.low.span,
            });
          }
          if (!isNumeric(high) && high.kind !== 'error') {
            diag(ctx, {
              code: 'C_CASE_RANGE_TYPE',
              message: 'CASE range bounds should be numeric.',
              span: arm.label.high.span,
            });
          }
        }
        for (const s of arm.body) checkStatement(ctx, s);
      }
      if (stmt.otherwise) {
        for (const s of stmt.otherwise) checkStatement(ctx, s);
      }
      return;
    }
    case 'ProcedureDeclaration': {
      checkRoutineBody(ctx, stmt, 'procedure');
      return;
    }
    case 'FunctionDeclaration': {
      checkRoutineBody(ctx, stmt, 'function');
      return;
    }
    case 'CallStatement': {
      checkCall(
        ctx,
        stmt.callee.name,
        stmt.args,
        stmt.callee.span,
        'call-stmt',
      );
      return;
    }
    case 'ReturnStatement': {
      if (ctx.functionReturn === null) {
        diag(ctx, {
          code: 'C_RETURN_OUTSIDE',
          message: ctx.inProcedure
            ? 'RETURN is not allowed inside a PROCEDURE.'
            : 'RETURN is only valid inside a FUNCTION.',
          span: stmt.span,
        });
        inferExpr(ctx, stmt.value);
        return;
      }
      const vt = inferExpr(ctx, stmt.value);
      if (!isAssignable(ctx.functionReturn, vt)) {
        diag(ctx, {
          code: 'C_RETURN_TYPE',
          message: `RETURN type ${formatType(vt)} is not assignable to FUNCTION return type ${formatType(ctx.functionReturn)}.`,
          span: stmt.value.span,
        });
      }
      return;
    }
    case 'OpenFileStatement':
    case 'ReadFileStatement':
    case 'WriteFileStatement':
    case 'CloseFileStatement':
      checkFileStatement(
        {
          openFiles: ctx.openFiles,
          diag: (partial) => diag(ctx, partial),
          inferExpr: (e) => inferExpr(ctx, e),
          checkAssignableTarget: (target, span, via) =>
            checkAssignableTarget(ctx, target, span, via),
          formatType,
          isAssignable,
        },
        stmt,
      );
      return;
    default: {
      const _exhaustive: never = stmt;
      return _exhaustive;
    }
  }
}

function checkTypeRefBounds(ctx: Ctx, ref: TypeReference): void {
  if (ref.kind !== 'ArrayType') return;
  for (const dim of ref.dimensions) {
    const lo = inferExpr(ctx, dim.lower);
    const hi = inferExpr(ctx, dim.upper);
    if (!isIndexType(lo) && lo.kind !== 'error') {
      diag(ctx, {
        code: 'C_ARRAY_BOUND_TYPE',
        message: 'ARRAY lower bound must be INTEGER.',
        span: dim.lower.span,
      });
    }
    if (!isIndexType(hi) && hi.kind !== 'error') {
      diag(ctx, {
        code: 'C_ARRAY_BOUND_TYPE',
        message: 'ARRAY upper bound must be INTEGER.',
        span: dim.upper.span,
      });
    }
  }
}

function checkFor(
  ctx: Ctx,
  stmt: Extract<Statement, { kind: 'ForStatement' }>,
): void {
  const existing = ctx.scope.lookup(stmt.variable);
  if (existing?.kind === 'constant') {
    diag(ctx, {
      code: 'C_ASSIGN_TO_CONSTANT',
      message: `Cannot use CONSTANT '${stmt.variable}' as a FOR loop variable.`,
      span: stmt.span,
    });
  } else if (existing?.kind === 'procedure' || existing?.kind === 'function') {
    diag(ctx, {
      code: 'C_FOR_VAR_TYPE',
      message: `Cannot use ${existing.kind.toUpperCase()} '${stmt.variable}' as a FOR loop variable.`,
      span: stmt.span,
      help: 'FOR control variables must be INTEGER.',
    });
  } else if (existing) {
    // Cambridge 9618: FOR control variable is INTEGER (not REAL / ARRAY / …).
    const okInteger =
      existing.type.kind === 'scalar' && existing.type.name === 'INTEGER';
    if (!okInteger) {
      diag(ctx, {
        code: 'C_FOR_VAR_TYPE',
        message: `FOR variable '${stmt.variable}' has type ${formatType(existing.type)}; expected INTEGER.`,
        span: stmt.span,
      });
    }
  } else {
    // Cambridge teaching style: FOR without prior DECLARE introduces INTEGER.
    defineSymbol(
      ctx,
      makeSymbol(
        stmt.variable,
        'variable',
        scalar('INTEGER'),
        stmt.span,
        { implicit: true },
      ),
    );
  }

  const start = inferExpr(ctx, stmt.start);
  const end = inferExpr(ctx, stmt.end);
  if (!isNumeric(start) && start.kind !== 'error') {
    diag(ctx, {
      code: 'C_FOR_BOUND_TYPE',
      message: 'FOR start expression should be numeric.',
      span: stmt.start.span,
    });
  }
  if (!isNumeric(end) && end.kind !== 'error') {
    diag(ctx, {
      code: 'C_FOR_BOUND_TYPE',
      message: 'FOR end expression should be numeric.',
      span: stmt.end.span,
    });
  }
  if (stmt.step) {
    const step = inferExpr(ctx, stmt.step);
    if (!isNumeric(step) && step.kind !== 'error') {
      diag(ctx, {
        code: 'C_FOR_BOUND_TYPE',
        message: 'FOR STEP expression should be numeric.',
        span: stmt.step.span,
      });
    }
  }
  for (const s of stmt.body) checkStatement(ctx, s);
}

function checkRoutineBody(
  ctx: Ctx,
  stmt: ProcedureDeclaration | FunctionDeclaration,
  kind: 'procedure' | 'function',
): void {
  const child = new Scope(ctx.scope, stmt.name.name);
  const prevScope = ctx.scope;
  const prevRet = ctx.functionReturn;
  const prevProc = ctx.inProcedure;
  // Isolate open-file tracking: routine bodies are checked at definition
  // time, not call time. Mutating the process-global map here would pollute
  // top-level analysis (false C_FILE_ALREADY_OPEN / missed C_FILE_NOT_OPEN).
  const prevOpenFiles = ctx.openFiles;
  ctx.openFiles = new Map();
  ctx.scope = child;
  ctx.inProcedure = kind === 'procedure';
  ctx.functionReturn =
    kind === 'function' && stmt.kind === 'FunctionDeclaration'
      ? resolveSimpleType(stmt.returnType, ctx.typeTable)
      : null;

  try {
    for (const p of stmt.parameters) {
      bindParameter(ctx, p);
    }

    for (const s of stmt.body) {
      checkStatement(ctx, s);
    }
    const sawReturn = bodyContainsReturn(stmt.body);

    if (kind === 'function' && !sawReturn) {
      diag(ctx, {
        severity: 'error',
        code: 'C_FUNC_NO_RETURN',
        message: `FUNCTION '${stmt.name.name}' has no RETURN statement.`,
        span: stmt.span,
        help: 'Every FUNCTION must include at least one RETURN.',
      });
    }

    flagUnreachableAfterReturn(ctx, stmt.body);
  } finally {
    ctx.scope = prevScope;
    ctx.functionReturn = prevRet;
    ctx.inProcedure = prevProc;
    ctx.openFiles = prevOpenFiles;
  }
}

/**
 * Warn on statements that follow RETURN in the same block (including nested
 * IF / WHILE / FOR / CASE / REPEAT bodies). Not path-sensitive across branches.
 */
function flagUnreachableAfterReturn(
  ctx: Ctx,
  statements: readonly Statement[],
): void {
  let afterReturn = false;
  for (const s of statements) {
    if (afterReturn) {
      diag(ctx, {
        severity: 'warning',
        code: 'C_UNREACHABLE',
        message: 'Unreachable statement after RETURN.',
        span: s.span,
        help: 'Remove or move this statement above the RETURN.',
      });
    }
    if (s.kind === 'ReturnStatement') {
      afterReturn = true;
      continue;
    }
    if (s.kind === 'IfStatement') {
      flagUnreachableAfterReturn(ctx, s.consequent);
      for (const c of s.elseIfClauses) {
        flagUnreachableAfterReturn(ctx, c.consequent);
      }
      if (s.alternate) flagUnreachableAfterReturn(ctx, s.alternate);
    } else if (
      s.kind === 'WhileStatement' ||
      s.kind === 'RepeatStatement' ||
      s.kind === 'ForStatement'
    ) {
      flagUnreachableAfterReturn(ctx, s.body);
    } else if (s.kind === 'CaseStatement') {
      for (const arm of s.arms) {
        flagUnreachableAfterReturn(ctx, arm.body);
      }
      if (s.otherwise) flagUnreachableAfterReturn(ctx, s.otherwise);
    } else if (
      s.kind === 'ProcedureDeclaration' ||
      s.kind === 'FunctionDeclaration'
    ) {
      // Nested routines rejected by parser; ignore if recovered.
    }
  }
}

function bindParameter(ctx: Ctx, p: Parameter): void {
  defineSymbol(
    ctx,
    makeSymbol(
      p.name.name,
      'parameter',
      resolveUserTypeRef(p.typeName, ctx.typeTable, (partial) =>
        diag(ctx, partial),
      ),
      p.name.span,
    ),
  );
}

/** True if any RETURN appears in this statement list (nested control flow included). */
function bodyContainsReturn(statements: readonly Statement[]): boolean {
  for (const s of statements) {
    if (s.kind === 'ReturnStatement') return true;
    if (s.kind === 'IfStatement') {
      if (bodyContainsReturn(s.consequent)) return true;
      for (const c of s.elseIfClauses) {
        if (bodyContainsReturn(c.consequent)) return true;
      }
      if (s.alternate && bodyContainsReturn(s.alternate)) return true;
    } else if (
      s.kind === 'WhileStatement' ||
      s.kind === 'RepeatStatement' ||
      s.kind === 'ForStatement'
    ) {
      if (bodyContainsReturn(s.body)) return true;
    } else if (s.kind === 'CaseStatement') {
      for (const arm of s.arms) {
        if (bodyContainsReturn(arm.body)) return true;
      }
      if (s.otherwise && bodyContainsReturn(s.otherwise)) return true;
    }
  }
  return false;
}

function checkCall(
  ctx: Ctx,
  name: string,
  args: Expression[],
  span: Statement['span'],
  mode: 'call-stmt' | 'call-expr',
): PpType {
  const builtin = lookupBuiltin(name);
  if (builtin) {
    return checkBuiltinCall(ctx, builtin, args, span, mode);
  }

  const sym = ctx.scope.lookup(name);
  if (!sym) {
    diag(ctx, {
      code: mode === 'call-expr' ? 'C_UNDECL_FUNCTION' : 'C_UNDECL_ROUTINE',
      message:
        mode === 'call-expr'
          ? `Undeclared FUNCTION '${name}'.`
          : `Undeclared PROCEDURE or FUNCTION '${name}'.`,
      span,
      help:
        mode === 'call-expr'
          ? `Define FUNCTION ${name}(...) RETURNS <TYPE> before calling it.`
          : `Define PROCEDURE/FUNCTION '${name}' before CALL.`,
    });
    for (const a of args) inferExpr(ctx, a);
    return errorType();
  }

  if (mode === 'call-expr' && sym.kind === 'procedure') {
    diag(ctx, {
      code: 'C_PROC_AS_EXPR',
      message: `PROCEDURE '${name}' cannot be used as an expression (use CALL ${name}(...)).`,
      span,
    });
    for (const a of args) inferExpr(ctx, a);
    return errorType();
  }

  if (sym.kind !== 'procedure' && sym.kind !== 'function') {
    diag(ctx, {
      code: 'C_NOT_CALLABLE',
      message: `'${name}' is not a PROCEDURE or FUNCTION.`,
      span,
    });
    for (const a of args) inferExpr(ctx, a);
    return errorType();
  }

  const sig = sym.type;
  if (sig.kind !== 'procedure' && sig.kind !== 'function') {
    for (const a of args) inferExpr(ctx, a);
    return errorType();
  }

  if (args.length !== sig.params.length) {
    diag(ctx, {
      code: 'C_ARG_COUNT',
      message: `'${name}' expects ${sig.params.length} argument(s) but got ${args.length}.`,
      span,
    });
  }

  const n = Math.max(args.length, sig.params.length);
  for (let i = 0; i < n; i++) {
    if (i >= args.length || i >= sig.params.length) {
      if (i < args.length) inferExpr(ctx, args[i]!);
      continue;
    }
    const at = inferExpr(ctx, args[i]!);
    const pt = sig.params[i]!;
    if (!isAssignable(pt, at)) {
      diag(ctx, {
        code: 'C_ARG_TYPE',
        message: `Argument ${i + 1} of '${name}' has type ${formatType(at)}; expected ${formatType(pt)}.`,
        span: args[i]!.span,
      });
    }
  }

  if (sig.kind === 'function') return sig.returns;
  return errorType();
}

function checkBuiltinCall(
  ctx: Ctx,
  builtin: BuiltinSpec,
  args: Expression[],
  span: Statement['span'],
  mode: 'call-stmt' | 'call-expr',
): PpType {
  if (mode === 'call-stmt') {
    // CALL LENGTH(...) is unusual but Cambridge CALL of function is allowed.
  }

  if (args.length !== builtin.params.length) {
    diag(ctx, {
      code: 'C_BUILTIN_ARG_COUNT',
      message: `Builtin ${builtin.name} expects ${builtin.params.length} argument(s) but got ${args.length}.`,
      span,
      help: builtin.summary,
    });
  }

  const argTypes: PpType[] = [];
  const n = Math.max(args.length, builtin.params.length);
  for (let i = 0; i < n; i++) {
    if (i >= args.length) break;
    const at = inferExpr(ctx, args[i]!);
    argTypes.push(at);
    if (i >= builtin.params.length) continue;
    const accept = builtin.params[i]!.accept;
    if (at.kind !== 'error' && !argAccepted(accept, at)) {
      diag(ctx, {
        code: 'C_BUILTIN_ARG_TYPE',
        message: `Argument ${i + 1} of ${builtin.name} has type ${formatType(at)}; expected ${accept.join(' | ')}.`,
        span: args[i]!.span,
        help: builtin.summary,
      });
    }
  }

  if (builtin.returns === 'same-as-arg0') {
    const a0 = argTypes[0];
    if (a0 && a0.kind === 'scalar' && (a0.name === 'CHAR' || a0.name === 'STRING')) {
      return a0;
    }
    return scalar('STRING');
  }
  return scalar(builtin.returns);
}

function argAccepted(
  accept: readonly ScalarTypeName[],
  from: PpType,
): boolean {
  if (from.kind !== 'scalar') return false;
  if (accept.includes(from.name)) return true;
  // INTEGER may widen into REAL parameters (INT already accepts both).
  if (accept.includes('REAL') && from.name === 'INTEGER') return true;
  return false;
}

function checkAssignableTarget(
  ctx: Ctx,
  target: AssignTarget,
  span: Statement['span'],
  what: string,
): PpType {
  if (target.kind === 'Identifier') {
    const sym = ctx.scope.lookup(target.name);
    if (!sym) {
      diag(ctx, {
        code: 'C_UNDECL_IDENT',
        message: `Undeclared identifier '${target.name}'.`,
        span: target.span,
        help: `Add DECLARE ${target.name} : <TYPE> before ${what}.`,
      });
      return errorType();
    }
    if (sym.kind === 'constant') {
      diag(ctx, {
        code: 'C_ASSIGN_TO_CONSTANT',
        message: `Cannot ${what} to CONSTANT '${target.name}'.`,
        span,
      });
      return errorType();
    }
    if (sym.kind === 'procedure' || sym.kind === 'function') {
      diag(ctx, {
        code: 'C_ASSIGN_TO_ROUTINE',
        message: `Cannot ${what} to ${sym.kind.toUpperCase()} '${target.name}'.`,
        span,
      });
      return errorType();
    }
    if (sym.kind === 'type' || sym.kind === 'field') {
      diag(ctx, {
        code: 'C_ASSIGN_TO_TYPE',
        message: `Cannot ${what} to TYPE/field name '${target.name}'.`,
        span,
      });
      return errorType();
    }
    return sym.type;
  }

  if (target.kind === 'MemberExpression') {
    return inferMemberAccess(ctx, target, /*asAssign*/ true, what);
  }

  // Index expression
  if (target.array.kind === 'Identifier') {
    const arr = ctx.scope.lookup(target.array.name);
    if (!arr) {
      diag(ctx, {
        code: 'C_UNDECL_ARRAY',
        message: `Undeclared array '${target.array.name}'.`,
        span: target.array.span,
        help: `Add DECLARE ${target.array.name} : ARRAY[...] OF <TYPE>.`,
      });
      for (const idx of target.indices) inferExpr(ctx, idx);
      return errorType();
    }
  }
  const baseType = inferExpr(ctx, target.array);
  if (baseType.kind === 'error') {
    for (const idx of target.indices) inferExpr(ctx, idx);
    return errorType();
  }
  if (baseType.kind !== 'array') {
    diag(ctx, {
      code: 'C_NOT_ARRAY',
      message: `Value of type ${formatType(baseType)} is not an ARRAY.`,
      span: target.array.span,
    });
    for (const idx of target.indices) inferExpr(ctx, idx);
    return errorType();
  }
  if (target.indices.length !== baseType.dimensions) {
    diag(ctx, {
      code: 'C_ARRAY_RANK',
      message: `Array has ${baseType.dimensions} dimension(s) but ${target.indices.length} index(es) were given.`,
      span: target.span,
    });
  }
  for (const idx of target.indices) {
    const it = inferExpr(ctx, idx);
    if (!isIndexType(it) && it.kind !== 'error') {
      diag(ctx, {
        code: 'C_INDEX_TYPE',
        message: 'Array index must be INTEGER.',
        span: idx.span,
      });
    }
  }
  return baseType.element;
}

function inferMemberAccess(
  ctx: Ctx,
  expr: Extract<Expression, { kind: 'MemberExpression' }> | Extract<
    AssignTarget,
    { kind: 'MemberExpression' }
  >,
  asAssign: boolean,
  what: string,
): PpType {
  const objType = inferExpr(ctx, expr.object);
  if (objType.kind === 'error') return errorType();
  if (objType.kind !== 'record') {
    diag(ctx, {
      code: 'C_NOT_RECORD',
      message: asAssign
        ? `Cannot ${what} field on non-record type ${formatType(objType)}.`
        : `Cannot access field on non-record type ${formatType(objType)}.`,
      span: expr.object.span,
      help: 'Field access requires a TYPE … ENDTYPE instance.',
    });
    return errorType();
  }
  const field = lookupRecordField(objType, expr.property.name);
  if (!field) {
    diag(ctx, {
      code: 'C_UNKNOWN_FIELD',
      message: `Unknown field '${expr.property.name}' on TYPE '${objType.name}'.`,
      span: expr.property.span,
      help: 'Field names are case-insensitive.',
    });
    return errorType();
  }
  return field.type;
}

function checkAssignment(
  ctx: Ctx,
  target: AssignTarget,
  valueType: PpType,
  span: Statement['span'],
): void {
  const lhs = checkAssignableTarget(ctx, target, span, 'assign');
  if (lhs.kind === 'error' || valueType.kind === 'error') return;
  if (!isAssignable(lhs, valueType)) {
    const help =
      lhs.kind === 'scalar' &&
      lhs.name === 'INTEGER' &&
      valueType.kind === 'scalar' &&
      valueType.name === 'REAL'
        ? 'REAL values cannot be assigned to INTEGER without INT(...).'
        : undefined;
    if (help !== undefined) {
      diag(ctx, {
        code: 'C_ASSIGN_TYPE',
        message: `Cannot assign ${formatType(valueType)} to ${formatType(lhs)}.`,
        span,
        help,
      });
    } else {
      diag(ctx, {
        code: 'C_ASSIGN_TYPE',
        message: `Cannot assign ${formatType(valueType)} to ${formatType(lhs)}.`,
        span,
      });
    }
  }
}

function expectBoolean(
  ctx: Ctx,
  t: PpType,
  span: Statement['span'],
  where: string,
): void {
  if (t.kind === 'error') return;
  if (!isBoolean(t)) {
    diag(ctx, {
      code: 'C_COND_TYPE',
      message: `${where} condition has type ${formatType(t)}; expected BOOLEAN.`,
      span,
    });
  }
}

/** Types that may be compared with relational / equality operators. */
function comparableTypes(left: PpType, right: PpType): boolean {
  if (left.kind === 'error' || right.kind === 'error') return true;
  if (isNumeric(left) && isNumeric(right)) return true;
  if (left.kind === 'scalar' && right.kind === 'scalar') {
    return left.name === right.name;
  }
  // Whole ARRAY / RECORD values are not comparable (Cambridge compares
  // elements / fields). Keeping them here would silence diagnostics while the
  // interpreter treats every RECORD/ARRAY equality as false.
  return false;
}

function isCompositeType(t: PpType): boolean {
  return t.kind === 'array' || t.kind === 'record';
}

function isStringy(t: PpType): boolean {
  return t.kind === 'scalar' && (t.name === 'STRING' || t.name === 'CHAR');
}

function inferExpr(ctx: Ctx, expr: Expression): PpType {
  switch (expr.kind) {
    case 'IntegerLiteral':
    case 'RealLiteral':
    case 'StringLiteral':
    case 'CharLiteral':
    case 'BooleanLiteral':
      return literalType(expr) ?? errorType();
    case 'Identifier': {
      const sym = ctx.scope.lookup(expr.name);
      if (!sym) {
        diag(ctx, {
          code: 'C_UNDECL_IDENT',
          message: `Undeclared identifier '${expr.name}'.`,
          span: expr.span,
          help: `Add DECLARE ${expr.name} : <TYPE> (or CONSTANT) before use.`,
        });
        return errorType();
      }
      if (sym.kind === 'procedure') {
        diag(ctx, {
          code: 'C_PROC_AS_EXPR',
          message: `PROCEDURE '${expr.name}' cannot be used as a value.`,
          span: expr.span,
        });
        return errorType();
      }
      if (sym.kind === 'function') {
        diag(ctx, {
          code: 'C_FUNC_AS_VALUE',
          message: `FUNCTION '${expr.name}' must be called with arguments.`,
          span: expr.span,
          help: `Use ${expr.name}(...)`,
        });
        return errorType();
      }
      if (sym.kind === 'type') {
        diag(ctx, {
          code: 'C_TYPE_AS_VALUE',
          message: `TYPE '${expr.name}' cannot be used as a value.`,
          span: expr.span,
          help: `DECLARE a variable of type ${expr.name} first.`,
        });
        return errorType();
      }
      if (sym.kind === 'field') {
        diag(ctx, {
          code: 'C_FIELD_AS_VALUE',
          message: `Field '${expr.name}' must be accessed on a record (e.g. S.${expr.name}).`,
          span: expr.span,
        });
        return errorType();
      }
      return sym.type;
    }
    case 'MemberExpression':
      return inferMemberAccess(ctx, expr, false, 'access');
    case 'IndexExpression': {
      if (expr.array.kind === 'Identifier') {
        const arr = ctx.scope.lookup(expr.array.name);
        if (!arr) {
          diag(ctx, {
            code: 'C_UNDECL_ARRAY',
            message: `Undeclared array '${expr.array.name}'.`,
            span: expr.array.span,
          });
          for (const idx of expr.indices) inferExpr(ctx, idx);
          return errorType();
        }
      }
      const baseType = inferExpr(ctx, expr.array);
      if (baseType.kind === 'error') {
        for (const idx of expr.indices) inferExpr(ctx, idx);
        return errorType();
      }
      if (baseType.kind !== 'array') {
        diag(ctx, {
          code: 'C_NOT_ARRAY',
          message: `Value of type ${formatType(baseType)} is not an ARRAY.`,
          span: expr.array.span,
        });
        for (const idx of expr.indices) inferExpr(ctx, idx);
        return errorType();
      }
      if (expr.indices.length !== baseType.dimensions) {
        diag(ctx, {
          code: 'C_ARRAY_RANK',
          message: `Array has ${baseType.dimensions} dimension(s) but ${expr.indices.length} index(es) were given.`,
          span: expr.span,
        });
      }
      for (const idx of expr.indices) {
        const it = inferExpr(ctx, idx);
        if (!isIndexType(it) && it.kind !== 'error') {
          diag(ctx, {
            code: 'C_INDEX_TYPE',
            message: 'Array index must be INTEGER.',
            span: idx.span,
          });
        }
      }
      return baseType.element;
    }
    case 'CallExpression':
      return checkCall(ctx, expr.callee.name, expr.args, expr.callee.span, 'call-expr');
    case 'UnaryExpression': {
      const arg = inferExpr(ctx, expr.argument);
      if (expr.operator === 'NOT') {
        if (!isBoolean(arg) && arg.kind !== 'error') {
          diag(ctx, {
            code: 'C_UNARY_TYPE',
            message: `NOT requires BOOLEAN; got ${formatType(arg)}.`,
            span: expr.argument.span,
          });
        }
        return scalar('BOOLEAN');
      }
      const result = unaryResultType(expr.operator, arg);
      if (result.kind === 'error' && arg.kind !== 'error') {
        diag(ctx, {
          code: 'C_UNARY_TYPE',
          message: `Operator '${expr.operator}' is not valid for type ${formatType(arg)}.`,
          span: expr.span,
        });
      }
      return result;
    }
    case 'BinaryExpression': {
      const left = inferExpr(ctx, expr.left);
      const right = inferExpr(ctx, expr.right);
      if (
        (expr.operator === 'AND' || expr.operator === 'OR') &&
        left.kind !== 'error' &&
        right.kind !== 'error'
      ) {
        if (!isBoolean(left)) {
          diag(ctx, {
            code: 'C_BINARY_TYPE',
            message: `Left operand of ${expr.operator} has type ${formatType(left)}; expected BOOLEAN.`,
            span: expr.left.span,
          });
        }
        if (!isBoolean(right)) {
          diag(ctx, {
            code: 'C_BINARY_TYPE',
            message: `Right operand of ${expr.operator} has type ${formatType(right)}; expected BOOLEAN.`,
            span: expr.right.span,
          });
        }
      }
      if (
        (expr.operator === 'DIV' || expr.operator === 'MOD') &&
        left.kind !== 'error' &&
        right.kind !== 'error'
      ) {
        if (!(left.kind === 'scalar' && left.name === 'INTEGER')) {
          diag(ctx, {
            code: 'C_BINARY_TYPE',
            message: `${expr.operator} requires INTEGER operands.`,
            span: expr.left.span,
          });
        }
        if (!(right.kind === 'scalar' && right.name === 'INTEGER')) {
          diag(ctx, {
            code: 'C_BINARY_TYPE',
            message: `${expr.operator} requires INTEGER operands.`,
            span: expr.right.span,
          });
        }
      }
      if (expr.operator === '&') {
        if (left.kind !== 'error' && !isStringy(left)) {
          diag(ctx, {
            code: 'C_CONCAT_TYPE',
            message: `Left operand of & has type ${formatType(left)}; expected STRING or CHAR.`,
            span: expr.left.span,
          });
        }
        if (right.kind !== 'error' && !isStringy(right)) {
          diag(ctx, {
            code: 'C_CONCAT_TYPE',
            message: `Right operand of & has type ${formatType(right)}; expected STRING or CHAR.`,
            span: expr.right.span,
          });
        }
      }
      if (
        (expr.operator === '=' ||
          expr.operator === '<>' ||
          expr.operator === '<' ||
          expr.operator === '<=' ||
          expr.operator === '>' ||
          expr.operator === '>=') &&
        left.kind !== 'error' &&
        right.kind !== 'error'
      ) {
        if (isCompositeType(left) || isCompositeType(right)) {
          diag(ctx, {
            code: 'C_COMPARE_TYPE',
            message: `Cannot compare ${formatType(left)} with ${formatType(right)}; compare fields or elements instead.`,
            span: expr.span,
            help: 'Cambridge equality applies to scalar values, not whole ARRAY or TYPE values.',
          });
        } else if (!comparableTypes(left, right)) {
          diag(ctx, {
            severity: 'warning',
            code: 'C_COMPARE_TYPE',
            message: `Comparing ${formatType(left)} with ${formatType(right)} may be invalid.`,
            span: expr.span,
          });
        }
      }
      const result = binaryResultType(expr.operator, left, right);
      if (
        result.kind === 'error' &&
        left.kind !== 'error' &&
        right.kind !== 'error' &&
        (expr.operator === '+' ||
          expr.operator === '-' ||
          expr.operator === '*' ||
          expr.operator === '/')
      ) {
        const help =
          left.kind === 'scalar' &&
          right.kind === 'scalar' &&
          (left.name === 'STRING' ||
            left.name === 'CHAR' ||
            right.name === 'STRING' ||
            right.name === 'CHAR')
            ? 'Use & for string concatenation, not +.'
            : undefined;
        if (help !== undefined) {
          diag(ctx, {
            code: 'C_BINARY_TYPE',
            message: `Operator '${expr.operator}' is not valid for ${formatType(left)} and ${formatType(right)}.`,
            span: expr.span,
            help,
          });
        } else {
          diag(ctx, {
            code: 'C_BINARY_TYPE',
            message: `Operator '${expr.operator}' is not valid for ${formatType(left)} and ${formatType(right)}.`,
            span: expr.span,
          });
        }
      }
      return result;
    }
    case 'GroupingExpression':
      return inferExpr(ctx, expr.expression);
    case 'EofExpression':
      return checkEofExpression(
        {
          openFiles: ctx.openFiles,
          diag: (partial) => diag(ctx, partial),
          inferExpr: (e) => inferExpr(ctx, e),
        },
        expr.fileName,
        expr.span,
      );
    default: {
      const _exhaustive: never = expr;
      return _exhaustive;
    }
  }
}
