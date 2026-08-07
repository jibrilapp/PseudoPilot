import type {
  AssignTarget,
  ClassDeclaration,
  ClassFunctionDeclaration,
  ClassProcedureDeclaration,
  Expression,
  FunctionDeclaration,
  Identifier,
  Parameter,
  ProcedureDeclaration,
  Program,
  SourceSpan,
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
  addressOfType,
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
  ClassMethodInfo,
  PpType,
  ScalarTypeName,
} from './types.js';
import { DEFAULT_MAX_CHECKER_DIAGNOSTICS, DEFAULT_MAX_STATEMENT_NESTING, C_NESTING_TOO_DEEP } from './types.js';
import {
  checkEofExpression,
  checkFileStatement,
} from './file/check-files.js';
import {
  registerTypeDeclarations,
  resolveUserTypeRef,
} from './records.js';
import {
  findClassFieldOwner,
  findClassMethodOwner,
  isAccessible,
  registerClassDeclarations,
} from './classes.js';

const BUILTIN_SPAN = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
} as const;

type Ctx = {
  readonly diagnostics: CheckerDiagnostic[];
  readonly maxDiagnostics: number;
  readonly maxStatementNesting: number;
  diagLimitReported: boolean;
  scope: Scope;
  /** Innermost FUNCTION return type when inside a function body. */
  functionReturn: PpType | null;
  /** True when inside a PROCEDURE (RETURN forbidden — parser also checks). */
  inProcedure: boolean;
  /** Display name of the enclosing CLASS when checking a method body (implicit `this`). */
  currentClass: string | null;
  /**
   * Best-effort open-file map keyed by string-literal path.
   * Files are process-global in Cambridge; not scoped to procedures.
   */
  openFiles: Map<string, import('./file/check-files.js').FileOpenState>;
  /** All successful bindings for the language service (no second binder). */
  readonly symbols: import('./types.js').SymbolInfo[];
  /** TYPE … ENDTYPE registry (case-folded keys). */
  readonly typeTable: Map<string, PpType>;
  /** Current compound-statement nesting depth. */
  statementNesting: number;
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
  const maxStatementNesting =
    options?.maxStatementNesting ?? DEFAULT_MAX_STATEMENT_NESTING;
  const diagnostics: CheckerDiagnostic[] = [];
  const symbols: import('./types.js').SymbolInfo[] = [];
  const global = new Scope(null, 'global');
  const typeTable = new Map<string, PpType>();
  const ctx: Ctx = {
    diagnostics,
    maxDiagnostics: Math.max(1, maxDiagnostics),
    maxStatementNesting: Math.max(1, maxStatementNesting),
    diagLimitReported: false,
    scope: global,
    functionReturn: null,
    inProcedure: false,
    currentClass: null,
    openFiles: new Map(),
    symbols,
    typeTable,
    statementNesting: 0,
  };

  try {
    // Seed Core builtins before user routines (soft-reserved names).
    injectBuiltins(ctx);

    const fieldSymbolSink = (symbol: import('./types.js').SymbolInfo): void => {
      const withContainer =
        symbol.containerName !== undefined
          ? symbol
          : { ...symbol, containerName: ctx.scope.name };
      ctx.symbols.push(withContainer);
    };

    // Pass 0 — TYPE … ENDTYPE (before routines so params/returns can use them).
    registerTypeDeclarations(
      {
        typeTable: ctx.typeTable,
        diag: (partial) => diag(ctx, partial),
        defineSymbol: (symbol) => defineSymbol(ctx, symbol),
        recordFieldSymbol: fieldSymbolSink,
      },
      program,
    );

    // Pass 0b — CLASS … ENDCLASS (records must be registered first so class
    // fields may reference TYPE names; CLASS/TYPE share one name table).
    registerClassDeclarations(
      {
        typeTable: ctx.typeTable,
        diag: (partial) => diag(ctx, partial),
        defineSymbol: (symbol) => defineSymbol(ctx, symbol),
        recordFieldSymbol: fieldSymbolSink,
        classMethodSymbol: fieldSymbolSink,
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
  } catch (err) {
    if (err instanceof RangeError) {
      diagnostics.push({
        severity: 'error',
        code: C_NESTING_TOO_DEEP,
        message:
          'Program nesting is too deep to analyse (call stack exhausted). Simplify nested control-flow.',
        span: BUILTIN_SPAN,
        help: `Keep compound statement nesting under ${maxStatementNesting} levels.`,
      });
    } else {
      throw err;
    }
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
  const paramModes = stmt.parameters.map((p) => p.mode);
  if (kind === 'function') {
    for (const p of stmt.parameters) {
      if (p.mode === 'BYREF') {
        diag(ctx, {
          code: 'C_BYREF_ON_FUNCTION',
          message: `FUNCTION parameters cannot be BYREF (Cambridge §8.3); parameter '${p.name.name}' is BYREF.`,
          span: p.span,
          help: 'Use a PROCEDURE with BYREF, or pass BYVAL and return a new value.',
        });
      }
    }
  }
  const type: PpType =
    kind === 'procedure'
      ? { kind: 'procedure', params, paramModes }
      : {
          kind: 'function',
          params,
          paramModes,
          returns: resolveSimpleType(
            (stmt as FunctionDeclaration).returnType,
            ctx.typeTable,
          ),
        };

  defineSymbol(ctx, makeSymbol(stmt.name.name, kind, type, stmt.name.span));
}

function enterCompound(ctx: Ctx, span: CheckerDiagnostic['span']): boolean {
  if (ctx.statementNesting >= ctx.maxStatementNesting) {
    diag(ctx, {
      code: C_NESTING_TOO_DEEP,
      message: `Statement nesting exceeds ${ctx.maxStatementNesting} levels.`,
      span,
      help: 'Simplify nested IF / WHILE / REPEAT / FOR / CASE structures.',
    });
    return false;
  }
  ctx.statementNesting += 1;
  return true;
}

function leaveCompound(ctx: Ctx): void {
  ctx.statementNesting -= 1;
}

function checkStatement(ctx: Ctx, stmt: Statement): void {
  switch (stmt.kind) {
    case 'TypeDeclaration':
      // Registered in pass 0; still validate ARRAY bounds on fields.
      for (const field of stmt.fields) {
        checkTypeRefBounds(ctx, field.typeRef);
      }
      return;
    case 'EnumTypeDeclaration':
    case 'PointerTypeDeclaration':
    case 'SetTypeDeclaration':
      // Registered in pass 0.
      return;
    case 'DefineStatement': {
      checkDefine(ctx, stmt);
      return;
    }
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
      if (!enterCompound(ctx, stmt.span)) return;
      try {
        expectBoolean(ctx, inferExpr(ctx, stmt.condition), stmt.condition.span, 'IF');
        for (const s of stmt.consequent) checkStatement(ctx, s);
        for (const c of stmt.elseIfClauses) {
          expectBoolean(ctx, inferExpr(ctx, c.condition), c.condition.span, 'ELSE IF');
          for (const s of c.consequent) checkStatement(ctx, s);
        }
        if (stmt.alternate) {
          for (const s of stmt.alternate) checkStatement(ctx, s);
        }
      } finally {
        leaveCompound(ctx);
      }
      return;
    }
    case 'WhileStatement': {
      if (!enterCompound(ctx, stmt.span)) return;
      try {
        expectBoolean(
          ctx,
          inferExpr(ctx, stmt.condition),
          stmt.condition.span,
          'WHILE',
        );
        for (const s of stmt.body) checkStatement(ctx, s);
      } finally {
        leaveCompound(ctx);
      }
      return;
    }
    case 'RepeatStatement': {
      if (!enterCompound(ctx, stmt.span)) return;
      try {
        for (const s of stmt.body) checkStatement(ctx, s);
        expectBoolean(
          ctx,
          inferExpr(ctx, stmt.condition),
          stmt.condition.span,
          'UNTIL',
        );
      } finally {
        leaveCompound(ctx);
      }
      return;
    }
    case 'ForStatement': {
      if (!enterCompound(ctx, stmt.span)) return;
      try {
        checkFor(ctx, stmt);
      } finally {
        leaveCompound(ctx);
      }
      return;
    }
    case 'CaseStatement': {
      if (!enterCompound(ctx, stmt.span)) return;
      try {
        const disc = inferExpr(ctx, stmt.discriminant);
        for (const arm of stmt.arms) {
          if (arm.label.kind === 'Value') {
            const lt = inferExpr(ctx, arm.label.value);
            if (
              disc.kind !== 'error' &&
              lt.kind !== 'error' &&
              !isAssignable(disc, lt, ctx.typeTable) &&
              !isAssignable(lt, disc, ctx.typeTable)
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
      } finally {
        leaveCompound(ctx);
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
    case 'ClassDeclaration': {
      checkClassBody(ctx, stmt);
      return;
    }
    case 'ExpressionStatement': {
      const expr = stmt.expression;
      if (expr.kind === 'MethodCallExpression') {
        checkMethodCallCore(ctx, expr.object, expr.method, expr.args, expr.span, 'call-stmt');
      } else if (expr.kind === 'CallExpression') {
        checkCall(ctx, expr.callee.name, expr.args, expr.callee.span, 'call-stmt');
      } else {
        // Parser only ever produces MethodCallExpression / CallExpression here.
        inferExpr(ctx, expr);
      }
      return;
    }
    case 'CallStatement': {
      if (stmt.callee.kind === 'MemberExpression') {
        checkMethodCallCore(
          ctx,
          stmt.callee.object,
          stmt.callee.property,
          stmt.args,
          stmt.span,
          'call-stmt',
        );
        return;
      }
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
      if (!isAssignable(ctx.functionReturn, vt, ctx.typeTable)) {
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
    case 'SeekStatement':
    case 'GetRecordStatement':
    case 'PutRecordStatement':
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

function checkDefine(
  ctx: Ctx,
  stmt: Extract<Statement, { kind: 'DefineStatement' }>,
): void {
  const key = identKey(stmt.typeName.name);
  const setTy = ctx.typeTable.get(key);
  if (!setTy) {
    diag(ctx, {
      code: 'C_UNKNOWN_TYPE',
      message: `Unknown TYPE '${stmt.typeName.name}'.`,
      span: stmt.typeName.span,
      help: 'DEFINE requires a set TYPE (TYPE Name = SET OF T).',
    });
    for (const v of stmt.values) inferExpr(ctx, v);
    return;
  }
  if (setTy.kind !== 'set') {
    diag(ctx, {
      code: 'C_NOT_SET',
      message: `TYPE '${stmt.typeName.name}' is not a SET type.`,
      span: stmt.typeName.span,
      help: 'DEFINE only creates instances of TYPE Name = SET OF T.',
    });
    for (const v of stmt.values) inferExpr(ctx, v);
    return;
  }
  for (const v of stmt.values) {
    const vt = inferExpr(ctx, v);
    if (vt.kind === 'error') continue;
    if (!isAssignable(setTy.element, vt, ctx.typeTable)) {
      diag(ctx, {
        code: 'C_DEFINE_ELEMENT_TYPE',
        message: `DEFINE element type ${formatType(vt)} is not assignable to SET element type ${formatType(setTy.element)}.`,
        span: v.span,
      });
    }
  }
  // Cambridge DEFINE creates a named set instance — treat as a writable variable.
  defineSymbol(
    ctx,
    makeSymbol(stmt.name.name, 'variable', setTy, stmt.name.span),
  );
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

/**
 * Validate a CLASS body: ARRAY bound expressions on properties (fields
 * themselves were already bound in {@link registerClassDeclarations}), then
 * check each method body with `currentClass` set for implicit-`this` field
 * resolution and PRIVATE access checks.
 */
function checkClassBody(ctx: Ctx, decl: ClassDeclaration): void {
  for (const member of decl.members) {
    if (member.kind === 'ClassPropertyDeclaration') {
      checkTypeRefBounds(ctx, member.typeRef);
    }
  }

  const classT = ctx.typeTable.get(identKey(decl.name.name));
  if (!classT || classT.kind !== 'class') return; // duplicate CLASS — already diagnosed

  for (const member of decl.members) {
    if (
      member.kind === 'ClassProcedureDeclaration' ||
      member.kind === 'ClassFunctionDeclaration'
    ) {
      checkMethodBody(ctx, decl.name.name, member);
    }
  }
}

function checkMethodBody(
  ctx: Ctx,
  className: string,
  member: ClassProcedureDeclaration | ClassFunctionDeclaration,
): void {
  const child = new Scope(ctx.scope, `${className}.${member.name.name}`);
  const prevScope = ctx.scope;
  const prevRet = ctx.functionReturn;
  const prevProc = ctx.inProcedure;
  const prevClass = ctx.currentClass;
  const prevOpenFiles = ctx.openFiles;
  ctx.openFiles = new Map();
  ctx.scope = child;
  ctx.currentClass = className;
  const isFunction = member.kind === 'ClassFunctionDeclaration';
  ctx.inProcedure = !isFunction;
  ctx.functionReturn = isFunction
    ? resolveUserTypeRef(member.returnType, ctx.typeTable, (partial) => diag(ctx, partial))
    : null;

  try {
    for (const p of member.parameters) bindParameter(ctx, p);
    for (const s of member.body) checkStatement(ctx, s);
    const sawReturn = bodyContainsReturn(member.body);

    if (isFunction && !sawReturn) {
      diag(ctx, {
        code: 'C_FUNC_NO_RETURN',
        message: `Method '${member.name.name}' has no RETURN statement.`,
        span: member.span,
        help: 'Every FUNCTION method must include at least one RETURN.',
      });
    }

    flagUnreachableAfterReturn(ctx, member.body);
  } finally {
    ctx.scope = prevScope;
    ctx.functionReturn = prevRet;
    ctx.inProcedure = prevProc;
    ctx.currentClass = prevClass;
    ctx.openFiles = prevOpenFiles;
  }
}

/**
 * Resolve a bare identifier to an implicit `this.<field>` inside a class
 * method. Returns `undefined` when no such field exists (caller should then
 * report the identifier as undeclared) and `errorType()` when the field
 * exists but is not accessible (PRIVATE in a different class) — a
 * C_PRIVATE_ACCESS diagnostic is already reported in that case.
 */
function resolveImplicitClassField(
  ctx: Ctx,
  name: string,
  span: SourceSpan,
): PpType | undefined {
  if (!ctx.currentClass) return undefined;
  const selfType = ctx.typeTable.get(identKey(ctx.currentClass));
  if (!selfType || selfType.kind !== 'class') return undefined;
  const found = findClassFieldOwner(selfType, name, ctx.typeTable);
  if (!found) return undefined;
  if (!isAccessible(found.field.visibility, found.owner, ctx.currentClass)) {
    diag(ctx, {
      code: 'C_PRIVATE_ACCESS',
      message: `Field '${found.field.name}' is PRIVATE to CLASS '${found.owner}'.`,
      span,
    });
    return errorType();
  }
  return found.field.type;
}

/**
 * `SELF` (case-insensitive) is the optional explicit receiver inside a CLASS
 * method — equivalent to the implicit bare-field form Cambridge examples use.
 */
function resolveSelfReceiverType(ctx: Ctx): PpType | undefined {
  if (!ctx.currentClass) return undefined;
  const selfType = ctx.typeTable.get(identKey(ctx.currentClass));
  if (!selfType || selfType.kind !== 'class') return undefined;
  return selfType;
}

function isSelfReceiverName(name: string): boolean {
  return identKey(name) === 'self';
}

/** Shared argument-count / argument-type checking for calls, methods, and NEW. */
function checkArgTypes(
  ctx: Ctx,
  params: readonly PpType[],
  args: Expression[],
  span: SourceSpan,
  label: string,
  paramModes?: readonly ('BYVAL' | 'BYREF')[],
): void {
  if (args.length !== params.length) {
    diag(ctx, {
      code: 'C_ARG_COUNT',
      message: `${label} expects ${params.length} argument(s) but got ${args.length}.`,
      span,
    });
  }
  const n = Math.max(args.length, params.length);
  for (let i = 0; i < n; i++) {
    if (i >= args.length || i >= params.length) {
      if (i < args.length) inferExpr(ctx, args[i]!);
      continue;
    }
    const arg = args[i]!;
    const at = inferExpr(ctx, arg);
    const pt = params[i]!;
    const mode = paramModes?.[i] ?? 'BYVAL';
    if (mode === 'BYREF') {
      // Strip "Method '...'" / similar down to a short callee label for messages.
      const callee = label.replace(/^Method '/, '').replace(/'$/, '') || label;
      checkByRefArgument(ctx, arg, callee, i + 1);
    }
    if (!isAssignable(pt, at, ctx.typeTable)) {
      diag(ctx, {
        code: 'C_ARG_TYPE',
        message: `Argument ${i + 1} of ${label} has type ${formatType(at)}; expected ${formatType(pt)}.`,
        span: arg.span,
      });
    }
  }
}

/**
 * Type-checks `<object>.<method>(<args>)` regardless of whether it appears as
 * a `MethodCallExpression`, a `CALL Obj.Method(...)` statement, or a bare
 * `Obj.Method(...)` statement. `SUPER.Method(...)` is special-cased.
 */
function checkMethodCallCore(
  ctx: Ctx,
  object: Expression,
  method: Identifier,
  args: Expression[],
  span: SourceSpan,
  mode: 'call-stmt' | 'call-expr',
): PpType {
  if (object.kind === 'SuperExpression') {
    return checkSuperCall(ctx, method, args, span);
  }

  const objType = inferExpr(ctx, object);
  if (objType.kind === 'error') {
    for (const a of args) inferExpr(ctx, a);
    return errorType();
  }
  if (objType.kind !== 'class') {
    diag(ctx, {
      code: 'C_NOT_CLASS',
      message: `Cannot call a method on non-class type ${formatType(objType)}.`,
      span: object.span,
      help: 'Method calls require a CLASS instance (see NEW).',
    });
    for (const a of args) inferExpr(ctx, a);
    return errorType();
  }

  const found = findClassMethodOwner(objType, method.name, ctx.typeTable);
  if (!found) {
    diag(ctx, {
      code: 'C_UNKNOWN_METHOD',
      message: `Unknown method '${method.name}' on CLASS '${objType.name}'.`,
      span: method.span,
      help: 'Method names are case-insensitive.',
    });
    for (const a of args) inferExpr(ctx, a);
    return errorType();
  }

  const { method: m, owner } = found;
  if (!isAccessible(m.visibility, owner, ctx.currentClass)) {
    diag(ctx, {
      code: 'C_PRIVATE_ACCESS',
      message: `Method '${m.name}' is PRIVATE to CLASS '${owner}'.`,
      span: method.span,
    });
  }

  checkArgTypes(ctx, m.params, args, span, `Method '${m.name}'`, m.paramModes);

  if (mode === 'call-expr' && m.kind === 'procedure') {
    diag(ctx, {
      code: 'C_PROC_AS_EXPR',
      message: `PROCEDURE method '${m.name}' cannot be used as an expression.`,
      span,
    });
    return errorType();
  }

  return m.kind === 'function' ? (m.returns ?? errorType()) : errorType();
}

function checkSuperCall(
  ctx: Ctx,
  method: Identifier,
  args: Expression[],
  span: SourceSpan,
): PpType {
  if (!ctx.currentClass) {
    diag(ctx, {
      code: 'C_SUPER_OUTSIDE',
      message: 'SUPER is only valid inside a CLASS method.',
      span,
    });
    for (const a of args) inferExpr(ctx, a);
    return errorType();
  }

  const selfType = ctx.typeTable.get(identKey(ctx.currentClass));
  if (!selfType || selfType.kind !== 'class' || selfType.inherits === null) {
    diag(ctx, {
      code: 'C_SUPER_OUTSIDE',
      message: `CLASS '${ctx.currentClass}' has no parent CLASS; SUPER is not valid here.`,
      span,
      help: 'SUPER can only be used inside a subclass (CLASS … INHERITS …).',
    });
    for (const a of args) inferExpr(ctx, a);
    return errorType();
  }

  const parent = ctx.typeTable.get(identKey(selfType.inherits));
  if (!parent || parent.kind !== 'class') {
    for (const a of args) inferExpr(ctx, a);
    return errorType();
  }

  const found = findClassMethodOwner(parent, method.name, ctx.typeTable);
  if (!found) {
    diag(ctx, {
      code: 'C_UNKNOWN_METHOD',
      message: `Unknown method '${method.name}' on CLASS '${parent.name}'.`,
      span: method.span,
      help: 'Method names are case-insensitive.',
    });
    for (const a of args) inferExpr(ctx, a);
    return errorType();
  }

  const { method: m, owner } = found;
  if (!isAccessible(m.visibility, owner, ctx.currentClass)) {
    diag(ctx, {
      code: 'C_PRIVATE_ACCESS',
      message: `Method '${m.name}' is PRIVATE to CLASS '${owner}'.`,
      span: method.span,
    });
  }

  checkArgTypes(ctx, m.params, args, span, `Method '${m.name}'`, m.paramModes);
  return m.kind === 'function' ? (m.returns ?? errorType()) : errorType();
}

function checkNewExpression(
  ctx: Ctx,
  expr: Extract<Expression, { kind: 'NewExpression' }>,
): PpType {
  const key = identKey(expr.className.name);
  const classT = ctx.typeTable.get(key);
  if (!classT || classT.kind !== 'class') {
    diag(ctx, {
      code: 'C_INVALID_NEW',
      message: `Unknown CLASS '${expr.className.name}' in NEW expression.`,
      span: expr.className.span,
      help: 'Declare CLASS … ENDCLASS before using NEW.',
    });
    for (const a of expr.args) inferExpr(ctx, a);
    return errorType();
  }

  const ctor: ClassMethodInfo | undefined = findClassMethodOwner(
    classT,
    'NEW',
    ctx.typeTable,
  )?.method;

  if (!ctor) {
    if (expr.args.length !== 0) {
      diag(ctx, {
        code: 'C_ARG_COUNT',
        message: `CLASS '${classT.name}' has no constructor; NEW ${classT.name}(...) must have 0 arguments.`,
        span: expr.span,
      });
    }
    for (const a of expr.args) inferExpr(ctx, a);
    return classT;
  }

  checkArgTypes(
    ctx,
    ctor.params,
    expr.args,
    expr.span,
    `Constructor of CLASS '${classT.name}'`,
    ctor.paramModes,
  );
  return classT;
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

  const modes = sig.paramModes;
  const n = Math.max(args.length, sig.params.length);
  for (let i = 0; i < n; i++) {
    if (i >= args.length || i >= sig.params.length) {
      if (i < args.length) inferExpr(ctx, args[i]!);
      continue;
    }
    const arg = args[i]!;
    const at = inferExpr(ctx, arg);
    const pt = sig.params[i]!;
    const paramMode = modes?.[i] ?? 'BYVAL';
    if (paramMode === 'BYREF') {
      checkByRefArgument(ctx, arg, name, i + 1);
    }
    if (!isAssignable(pt, at, ctx.typeTable)) {
      diag(ctx, {
        code: 'C_ARG_TYPE',
        message: `Argument ${i + 1} of '${name}' has type ${formatType(at)}; expected ${formatType(pt)}.`,
        span: arg.span,
      });
    }
  }

  if (sig.kind === 'function') return sig.returns;
  return errorType();
}

/**
 * Cambridge §8.3: BYREF arguments must be assignable locations — not
 * literals, constants, temporaries, or other rvalue expressions.
 */
function checkByRefArgument(
  ctx: Ctx,
  arg: Expression,
  calleeName: string,
  argIndex: number,
): void {
  if (arg.kind === 'Identifier') {
    const sym = ctx.scope.lookup(arg.name);
    if (!sym) {
      // Undeclared already reported via inferExpr / later assignability.
      const implicit = resolveImplicitClassField(ctx, arg.name, arg.span);
      if (implicit) return; // class field is a mutable location
      return;
    }
    if (sym.kind === 'constant') {
      diag(ctx, {
        code: 'C_BYREF_CONSTANT',
        message: `Cannot pass CONSTANT '${arg.name}' BYREF to '${calleeName}' (argument ${argIndex}).`,
        span: arg.span,
        help: 'BYREF requires a mutable variable, array element, or field.',
      });
      return;
    }
    if (sym.kind === 'procedure' || sym.kind === 'function') {
      diag(ctx, {
        code: 'C_BYREF_TEMPORARY',
        message: `Cannot pass ${sym.kind.toUpperCase()} '${arg.name}' BYREF to '${calleeName}' (argument ${argIndex}).`,
        span: arg.span,
      });
      return;
    }
    // variable / parameter — OK
    return;
  }

  if (arg.kind === 'IndexExpression' || arg.kind === 'MemberExpression') {
    // Element / field locations are mutable (assignability checked separately).
    return;
  }

  // Literals, calls, operators, NEW, groupings of non-lvalues, etc.
  const kindLabel =
    arg.kind === 'IntegerLiteral' ||
    arg.kind === 'RealLiteral' ||
    arg.kind === 'StringLiteral' ||
    arg.kind === 'CharLiteral' ||
    arg.kind === 'BooleanLiteral' ||
    arg.kind === 'DateLiteral'
      ? 'literal'
      : arg.kind === 'CallExpression' || arg.kind === 'MethodCallExpression'
        ? 'call result'
        : arg.kind === 'NewExpression'
          ? 'NEW expression'
          : 'expression';

  diag(ctx, {
    code: kindLabel === 'literal' ? 'C_BYREF_LITERAL' : 'C_BYREF_TEMPORARY',
    message: `Cannot pass ${kindLabel} BYREF to '${calleeName}' (argument ${argIndex}).`,
    span: arg.span,
    help: 'BYREF arguments must be variables, array elements, or record/object fields.',
  });
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
      const implicit = resolveImplicitClassField(ctx, target.name, target.span);
      if (implicit) return implicit;
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
    if (
      sym.kind === 'type' ||
      sym.kind === 'field' ||
      sym.kind === 'class' ||
      sym.kind === 'method'
    ) {
      diag(ctx, {
        code: 'C_ASSIGN_TO_TYPE',
        message: `Cannot ${what} to TYPE/CLASS/field/method name '${target.name}'.`,
        span,
      });
      return errorType();
    }
    return sym.type;
  }

  if (target.kind === 'MemberExpression') {
    return inferMemberAccess(ctx, target, /*asAssign*/ true, what);
  }

  if (target.kind === 'DerefExpression') {
    return checkDeref(ctx, target.pointer, target.span, /*asAssign*/ true, what);
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
  // Explicit `SELF.Field` inside a CLASS method (reverse-translation form).
  if (
    expr.object.kind === 'Identifier' &&
    isSelfReceiverName(expr.object.name)
  ) {
    const selfType = resolveSelfReceiverType(ctx);
    if (!selfType || selfType.kind !== 'class') {
      diag(ctx, {
        code: 'C_UNDECL_IDENT',
        message: `'SELF' is only valid inside a CLASS method body.`,
        span: expr.object.span,
      });
      return errorType();
    }
    const found = findClassFieldOwner(
      selfType,
      expr.property.name,
      ctx.typeTable,
    );
    if (!found) {
      diag(ctx, {
        code: 'C_UNKNOWN_FIELD',
        message: `Unknown property '${expr.property.name}' on CLASS '${selfType.name}'.`,
        span: expr.property.span,
        help: 'Property names are case-insensitive.',
      });
      return errorType();
    }
    if (!isAccessible(found.field.visibility, found.owner, ctx.currentClass)) {
      diag(ctx, {
        code: 'C_PRIVATE_ACCESS',
        message: `Property '${found.field.name}' is PRIVATE to CLASS '${found.owner}'.`,
        span: expr.property.span,
      });
      return errorType();
    }
    return found.field.type;
  }

  const objType = inferExpr(ctx, expr.object);
  if (objType.kind === 'error') return errorType();

  if (objType.kind === 'class') {
    const found = findClassFieldOwner(objType, expr.property.name, ctx.typeTable);
    if (!found) {
      diag(ctx, {
        code: 'C_UNKNOWN_FIELD',
        message: `Unknown property '${expr.property.name}' on CLASS '${objType.name}'.`,
        span: expr.property.span,
        help: 'Property names are case-insensitive.',
      });
      return errorType();
    }
    if (!isAccessible(found.field.visibility, found.owner, ctx.currentClass)) {
      diag(ctx, {
        code: 'C_PRIVATE_ACCESS',
        message: `Property '${found.field.name}' is PRIVATE to CLASS '${found.owner}'.`,
        span: expr.property.span,
      });
      return errorType();
    }
    return found.field.type;
  }

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
  if (!isAssignable(lhs, valueType, ctx.typeTable)) {
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

function checkDeref(
  ctx: Ctx,
  pointerExpr: Expression,
  span: Expression['span'],
  asAssign: boolean,
  what: string,
): PpType {
  const ptrType = inferExpr(ctx, pointerExpr);
  if (ptrType.kind === 'error') return errorType();
  if (ptrType.kind !== 'pointer') {
    diag(ctx, {
      code: 'C_NOT_POINTER',
      message: asAssign
        ? `Cannot ${what} through non-pointer type ${formatType(ptrType)}.`
        : `Cannot dereference non-pointer type ${formatType(ptrType)}.`,
      span,
      help: 'Dereference (Ptr^) requires a pointer TYPE variable.',
    });
    return errorType();
  }
  return ptrType.target;
}

function checkAddressOf(ctx: Ctx, target: AssignTarget): PpType {
  // Address-of requires a mutable place; result is an anonymous pointer-to-place.
  if (target.kind === 'Identifier') {
    const sym = ctx.scope.lookup(target.name);
    if (!sym) {
      const implicit = resolveImplicitClassField(ctx, target.name, target.span);
      if (implicit) return addressOfType(implicit);
      diag(ctx, {
        code: 'C_UNDECL_IDENT',
        message: `Undeclared identifier '${target.name}'.`,
        span: target.span,
        help: `Add DECLARE ${target.name} : <TYPE> before taking its address.`,
      });
      return errorType();
    }
    if (sym.kind === 'constant') {
      diag(ctx, {
        code: 'C_ASSIGN_TO_CONSTANT',
        message: `Cannot take the address of CONSTANT '${target.name}'.`,
        span: target.span,
      });
      return errorType();
    }
    if (
      sym.kind === 'procedure' ||
      sym.kind === 'function' ||
      sym.kind === 'type' ||
      sym.kind === 'field' ||
      sym.kind === 'class' ||
      sym.kind === 'method'
    ) {
      diag(ctx, {
        code: 'C_ASSIGN_TO_ROUTINE',
        message: `Cannot take the address of ${sym.kind} '${target.name}'.`,
        span: target.span,
      });
      return errorType();
    }
    return addressOfType(sym.type);
  }
  const placeType = checkAssignableTarget(ctx, target, target.span, 'assign');
  if (placeType.kind === 'error') return errorType();
  return addressOfType(placeType);
}

/** Types that may be compared with relational / equality operators. */
function comparableTypes(left: PpType, right: PpType): boolean {
  if (left.kind === 'error' || right.kind === 'error') return true;
  if (isNumeric(left) && isNumeric(right)) return true;
  if (left.kind === 'enum' && right.kind === 'enum') {
    return identKey(left.name) === identKey(right.name);
  }
  if (left.kind === 'scalar' && right.kind === 'scalar') {
    return left.name === right.name;
  }
  // Whole ARRAY / RECORD / SET / CLASS values are not comparable (Cambridge
  // compares elements / fields). Keeping them here would silence diagnostics
  // while the interpreter treats every RECORD/ARRAY equality as false.
  return false;
}

function isCompositeType(t: PpType): boolean {
  return (
    t.kind === 'array' ||
    t.kind === 'record' ||
    t.kind === 'class' ||
    t.kind === 'set' ||
    t.kind === 'pointer'
  );
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
    case 'DateLiteral':
      return literalType(expr) ?? errorType();
    case 'Identifier': {
      // Bare `SELF` is not a value; use `SELF.Field` for explicit field access.
      if (isSelfReceiverName(expr.name) && ctx.currentClass) {
        diag(ctx, {
          code: 'C_SELF_BARE',
          message: `'SELF' cannot be used as a value; access a field with SELF.Name.`,
          span: expr.span,
        });
        return errorType();
      }
      const sym = ctx.scope.lookup(expr.name);
      if (!sym) {
        const implicit = resolveImplicitClassField(ctx, expr.name, expr.span);
        if (implicit) return implicit;
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
      if (sym.kind === 'type' || sym.kind === 'class') {
        diag(ctx, {
          code: 'C_TYPE_AS_VALUE',
          message: `${sym.kind === 'class' ? 'CLASS' : 'TYPE'} '${expr.name}' cannot be used as a value.`,
          span: expr.span,
          help: `DECLARE a variable of type ${expr.name} first.`,
        });
        return errorType();
      }
      if (sym.kind === 'field' || sym.kind === 'method') {
        diag(ctx, {
          code: 'C_FIELD_AS_VALUE',
          message: `${sym.kind === 'method' ? 'Method' : 'Field'} '${expr.name}' must be accessed on an object (e.g. Obj.${expr.name}).`,
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
    case 'MethodCallExpression':
      return checkMethodCallCore(ctx, expr.object, expr.method, expr.args, expr.span, 'call-expr');
    case 'NewExpression':
      return checkNewExpression(ctx, expr);
    case 'AddressOfExpression':
      return checkAddressOf(ctx, expr.target);
    case 'DerefExpression':
      return checkDeref(ctx, expr.pointer, expr.span, false, 'dereference');
    case 'SuperExpression':
      diag(ctx, {
        code: 'C_SUPER_OUTSIDE',
        message: ctx.currentClass
          ? 'SUPER can only be used as SUPER.<Method>(...).'
          : 'SUPER is only valid inside a CLASS method.',
        span: expr.span,
      });
      return errorType();
    default: {
      const _exhaustive: never = expr;
      return _exhaustive;
    }
  }
}
