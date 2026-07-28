import type {
  ArrayType,
  AssignTarget,
  BinaryOperator,
  Expression,
  FunctionDeclaration,
  Identifier,
  Parameter,
  ProcedureDeclaration,
  Program,
  SourceSpan,
  Statement,
  TypeNameKind,
  TypeReference,
  UnaryOperator,
} from '@pseudopilot/language-core';
import { identKey } from '@pseudopilot/checker';
import { lookupBuiltin } from '@pseudopilot/language-core';
import { executeBuiltin } from './builtins.js';
import { Environment } from './environment.js';
import { CallStack, type DebuggerHooks } from './frame.js';
import {
  defaultRandom,
  type FileSystemHost,
  type RandomSource,
  type RuntimeHost,
} from './host.js';
import { FileSystemError, VirtualFileSystem } from './files/VirtualFileSystem.js';
import {
  allocateArray,
  arrayOffset,
  asInteger,
  asNumber,
  booleanValue,
  charValue,
  defaultScalar,
  formatValue,
  integerValue,
  isTruthyBoolean,
  realValue,
  ReturnSignal,
  RuntimeError,
  runtimeFail,
  stringValue,
  type ArrayValue,
  type RuntimeDiagnostic,
  type RuntimeValue,
  type ScalarValue,
} from './value.js';

export type InterpretOptions = {
  readonly host: RuntimeHost;
  readonly random?: RandomSource;
  /** Max frames including global. Default 256. */
  readonly maxCallDepth?: number;
  /** Max statement ticks. Default 1_000_000. */
  readonly maxSteps?: number;
  readonly debugger?: DebuggerHooks;
  /** Cooperative cancellation (Stop in the IDE). */
  readonly signal?: AbortSignal;
};

export type VariableSnapshot = {
  readonly name: string;
  readonly kind: string;
  readonly typeName: string;
  readonly value: string;
};

export type FrameSnapshot = {
  readonly id: number;
  readonly kind: string;
  readonly name: string;
  readonly variables: readonly VariableSnapshot[];
};

export type InterpretResult = {
  readonly ok: boolean;
  readonly diagnostics: readonly RuntimeDiagnostic[];
  readonly steps: number;
  readonly callStack: readonly FrameSnapshot[];
  readonly globals: readonly VariableSnapshot[];
};

type Routine =
  | { readonly kind: 'procedure'; readonly decl: ProcedureDeclaration }
  | { readonly kind: 'function'; readonly decl: FunctionDeclaration };

/**
 * Tree-walk interpreter over a semantically validated Cambridge AST.
 * Independent of translator IR; statement spans feed future debugger hooks.
 */
export class Interpreter {
  private readonly host: RuntimeHost;
  private readonly files: FileSystemHost;
  private readonly random: RandomSource;
  private readonly maxCallDepth: number;
  private readonly maxSteps: number;
  private readonly hooks: DebuggerHooks | undefined;
  private readonly signal: AbortSignal | undefined;

  private globalEnv: Environment = new Environment(null);
  private readonly stack = new CallStack();
  private readonly routines = new Map<string, Routine>();

  private steps = 0;
  private diagnostics: RuntimeDiagnostic[] = [];
  /** How often to yield to the macrotask queue so Stop / AbortSignal can run. */
  private readonly eventLoopYieldEvery: number;

  constructor(options: InterpretOptions) {
    this.host = options.host;
    this.files = options.host.files ?? new VirtualFileSystem();
    this.random = options.random ?? defaultRandom;
    this.maxCallDepth = options.maxCallDepth ?? 256;
    this.maxSteps = options.maxSteps ?? 1_000_000;
    this.hooks = options.debugger;
    this.signal = options.signal;
    // Microtask-only yields (`Promise.resolve`) never flush UI / setTimeout;
    // macrotask yields are required for cooperative cancellation.
    this.eventLoopYieldEvery = 256;
  }

  async interpret(program: Program): Promise<InterpretResult> {
    this.diagnostics = [];
    this.steps = 0;
    this.routines.clear();
    this.stack.clear();
    this.globalEnv = new Environment(null);

    try {
      await this.runProgram(program);
      return {
        ok: true,
        diagnostics: this.diagnostics,
        steps: this.steps,
        callStack: this.snapshotStack(),
        globals: snapshotEnv(this.globalEnv),
      };
    } catch (e) {
      if (e instanceof RuntimeError) {
        this.diagnostics.push(e.diagnostic);
      } else if (e instanceof FileSystemError) {
        this.diagnostics.push({
          severity: 'error',
          code: e.code,
          message: e.message,
        });
      } else if (e instanceof ReturnSignal) {
        this.diagnostics.push({
          severity: 'error',
          code: 'R_RETURN_OUTSIDE',
          message: 'RETURN outside of a FUNCTION.',
        });
      } else if (isAbortError(e)) {
        this.diagnostics.push({
          severity: 'error',
          code: 'R_CANCELLED',
          message: 'Execution stopped.',
        });
      } else {
        throw e;
      }
      return {
        ok: false,
        diagnostics: this.diagnostics,
        steps: this.steps,
        callStack: this.snapshotStack(),
        globals: snapshotEnv(this.globalEnv),
      };
    }
  }

  private async runProgram(program: Program): Promise<void> {
    this.stack.push('global', '<global>', this.globalEnv);
    this.hooks?.onEnterFrame?.(this.stack.current());

    for (const stmt of program.body) {
      if (stmt.kind === 'ProcedureDeclaration') {
        this.routines.set(identKey(stmt.name.name), {
          kind: 'procedure',
          decl: stmt,
        });
      } else if (stmt.kind === 'FunctionDeclaration') {
        this.routines.set(identKey(stmt.name.name), {
          kind: 'function',
          decl: stmt,
        });
      }
    }

    for (const stmt of program.body) {
      if (
        stmt.kind === 'ProcedureDeclaration' ||
        stmt.kind === 'FunctionDeclaration'
      ) {
        continue;
      }
      await this.execStatement(stmt);
    }
  }

  private env(): Environment {
    return this.stack.current().env;
  }

  private async tick(span: SourceSpan): Promise<void> {
    if (this.signal?.aborted) {
      throw runtimeFail('R_CANCELLED', 'Execution stopped.', span);
    }
    this.steps += 1;
    if (this.steps > this.maxSteps) {
      throw runtimeFail(
        'R_STEP_LIMIT',
        `Instruction limit exceeded (${this.maxSteps} steps). Possible infinite loop.`,
        span,
      );
    }
    const action = await this.hooks?.onBeforeStatement?.({
      span,
      frame: this.stack.current(),
      step: this.steps,
      depth: this.stack.depth(),
    });
    // Re-check after async debugger suspend (Stop may have fired while parked).
    if (this.signal?.aborted) {
      throw runtimeFail('R_CANCELLED', 'Execution stopped.', span);
    }
    if (action === 'pause') {
      // Legacy sync pause — prefer awaiting a resume gate inside the hook.
      throw runtimeFail(
        'R_DEBUG_PAUSE',
        'Execution paused by debugger hook.',
        span,
      );
    }
  }

  /**
   * Periodically yield to the macrotask queue so IDE Stop clicks and
   * `AbortController.abort()` scheduled via timers can run. Checking
   * `signal.aborted` alone is insufficient while only microtasks run.
   */
  private async maybeYieldEventLoop(span: SourceSpan): Promise<void> {
    if (this.steps % this.eventLoopYieldEvery !== 0) return;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    if (this.signal?.aborted) {
      throw runtimeFail('R_CANCELLED', 'Execution stopped.', span);
    }
  }

  private async execStatement(stmt: Statement): Promise<void> {
    await this.tick(stmt.span);
    await this.maybeYieldEventLoop(stmt.span);

    switch (stmt.kind) {
      case 'DeclareStatement':
        await this.execDeclare(
          stmt.names.map((n: Identifier) => n.name),
          stmt.typeRef,
          stmt.span,
        );
        return;
      case 'ConstantStatement': {
        const value = await this.evalExpr(stmt.value);
        this.env().define(
          stmt.name.name,
          'constant',
          value.kind === 'ARRAY' ? 'ARRAY' : value.kind,
          value,
        );
        return;
      }
      case 'AssignmentStatement':
        await this.assignTarget(stmt.target, await this.evalExpr(stmt.value), stmt.span);
        return;
      case 'InputStatement':
        await this.execInput(stmt.target, stmt.span);
        return;
      case 'OutputStatement': {
        // SPEC §13.15: multi-value OUTPUT joins with a space separator.
        const parts: string[] = [];
        for (const e of stmt.expressions) {
          parts.push(formatValue(await this.evalExpr(e)));
        }
        await this.writeOut(parts.join(' '));
        return;
      }
      case 'IfStatement':
        await this.execIf(stmt);
        return;
      case 'CaseStatement':
        await this.execCase(stmt);
        return;
      case 'WhileStatement':
        // Tick each iteration so empty `WHILE TRUE` cannot bypass maxSteps.
        for (;;) {
          if (!isTruthyBoolean(await this.evalExpr(stmt.condition))) break;
          await this.execBlock(stmt.body);
          await this.tick(stmt.span);
          await this.maybeYieldEventLoop(stmt.span);
        }
        return;
      case 'RepeatStatement':
        for (;;) {
          await this.execBlock(stmt.body);
          await this.tick(stmt.span);
          if (isTruthyBoolean(await this.evalExpr(stmt.condition))) break;
          await this.maybeYieldEventLoop(stmt.span);
        }
        return;
      case 'ForStatement':
        await this.execFor(stmt);
        return;
      case 'CallStatement':
        await this.callRoutine(stmt.callee.name, stmt.args, 'procedure', stmt.span);
        return;
      case 'ReturnStatement': {
        if (this.stack.current().kind !== 'function') {
          throw runtimeFail(
            'R_RETURN_OUTSIDE',
            'RETURN is only valid inside a FUNCTION.',
            stmt.span,
          );
        }
        throw new ReturnSignal(await this.evalExpr(stmt.value));
      }
      case 'ProcedureDeclaration':
      case 'FunctionDeclaration':
        return;
      case 'OpenFileStatement':
        await this.execOpenFile(stmt);
        return;
      case 'ReadFileStatement':
        await this.execReadFile(stmt);
        return;
      case 'WriteFileStatement':
        await this.execWriteFile(stmt);
        return;
      case 'CloseFileStatement':
        await this.execCloseFile(stmt);
        return;
      default: {
        const _exhaustive: never = stmt;
        return _exhaustive;
      }
    }
  }

  private async writeOut(line: string): Promise<void> {
    await this.host.writeOutput(line);
  }

  private async evalFilePath(
    expr: Expression,
    span: SourceSpan,
  ): Promise<string> {
    const v = await this.evalExpr(expr);
    if (v.kind !== 'STRING' && v.kind !== 'CHAR') {
      throw runtimeFail(
        'R_FILE_PATH',
        `File name must be STRING (got ${v.kind}).`,
        span,
      );
    }
    return v.value;
  }

  private async execOpenFile(
    stmt: Extract<Statement, { kind: 'OpenFileStatement' }>,
  ): Promise<void> {
    const path = await this.evalFilePath(stmt.fileName, stmt.span);
    try {
      await this.files.open(path, stmt.mode);
    } catch (e) {
      throw mapFileError(e, stmt.span);
    }
  }

  private async execReadFile(
    stmt: Extract<Statement, { kind: 'ReadFileStatement' }>,
  ): Promise<void> {
    const path = await this.evalFilePath(stmt.fileName, stmt.span);
    try {
      const line = await this.files.readLine(path);
      await this.assignTarget(stmt.target, stringValue(line), stmt.span);
    } catch (e) {
      throw mapFileError(e, stmt.span);
    }
  }

  private async execWriteFile(
    stmt: Extract<Statement, { kind: 'WriteFileStatement' }>,
  ): Promise<void> {
    const path = await this.evalFilePath(stmt.fileName, stmt.span);
    const value = await this.evalExpr(stmt.value);
    try {
      await this.files.writeLine(path, formatValue(value));
    } catch (e) {
      throw mapFileError(e, stmt.span);
    }
  }

  private async execCloseFile(
    stmt: Extract<Statement, { kind: 'CloseFileStatement' }>,
  ): Promise<void> {
    const path = await this.evalFilePath(stmt.fileName, stmt.span);
    try {
      await this.files.close(path);
    } catch (e) {
      throw mapFileError(e, stmt.span);
    }
  }

  private async execBlock(body: readonly Statement[]): Promise<void> {
    for (const s of body) await this.execStatement(s);
  }

  private async execDeclare(
    names: readonly string[],
    typeRef: TypeReference,
    span: SourceSpan,
  ): Promise<void> {
    if (typeRef.kind === 'TypeName') {
      for (const name of names) {
        this.env().define(
          name,
          'variable',
          typeRef.name,
          defaultScalar(typeRef.name),
        );
      }
      return;
    }
    for (let i = 0; i < names.length; i++) {
      const arr = await this.allocateFromType(typeRef, span);
      this.env().define(names[i]!, 'variable', 'ARRAY', arr);
    }
  }

  private async allocateFromType(typeRef: ArrayType, span: SourceSpan): Promise<ArrayValue> {
    const lowers: number[] = [];
    const uppers: number[] = [];
    for (const dim of typeRef.dimensions) {
      lowers.push(asInteger(await this.evalExpr(dim.lower), 'array lower bound'));
      uppers.push(asInteger(await this.evalExpr(dim.upper), 'array upper bound'));
    }
    return allocateArray(typeRef.elementType.name, lowers, uppers, span);
  }

  private async execIf(stmt: Extract<Statement, { kind: 'IfStatement' }>): Promise<void> {
    if (isTruthyBoolean(await this.evalExpr(stmt.condition))) {
      await this.execBlock(stmt.consequent);
      return;
    }
    for (const clause of stmt.elseIfClauses) {
      if (isTruthyBoolean(await this.evalExpr(clause.condition))) {
        await this.execBlock(clause.consequent);
        return;
      }
    }
    if (stmt.alternate) await this.execBlock(stmt.alternate);
  }

  private async execCase(stmt: Extract<Statement, { kind: 'CaseStatement' }>): Promise<void> {
    const disc = await this.evalExpr(stmt.discriminant);
    for (const arm of stmt.arms) {
      if (arm.label.kind === 'Value') {
        if (valuesEqual(disc, await this.evalExpr(arm.label.value))) {
          await this.execBlock(arm.body);
          return;
        }
      } else {
        const low = asNumber(await this.evalExpr(arm.label.low), 'CASE range');
        const high = asNumber(await this.evalExpr(arm.label.high), 'CASE range');
        const v = asNumber(disc, 'CASE discriminant');
        if (v >= low && v <= high) {
          await this.execBlock(arm.body);
          return;
        }
      }
    }
    if (stmt.otherwise) await this.execBlock(stmt.otherwise);
  }

  private async execFor(stmt: Extract<Statement, { kind: 'ForStatement' }>): Promise<void> {
    const start = asInteger(await this.evalExpr(stmt.start), 'FOR start');
    const end = asInteger(await this.evalExpr(stmt.end), 'FOR end');
    const step = stmt.step
      ? asInteger(await this.evalExpr(stmt.step), 'FOR STEP')
      : 1;
    if (step === 0) {
      throw runtimeFail('R_FOR_STEP', 'FOR STEP must not be 0.', stmt.span);
    }

    const env = this.env();
    let binding = env.lookup(stmt.variable);
    if (!binding) {
      env.define(stmt.variable, 'variable', 'INTEGER', integerValue(start));
      binding = env.lookup(stmt.variable)!;
    } else if (binding.kind === 'constant') {
      throw runtimeFail(
        'R_ASSIGN_CONSTANT',
        `Cannot use CONSTANT '${binding.name}' as FOR variable.`,
        stmt.span,
      );
    } else if (binding.typeName !== 'INTEGER') {
      throw runtimeFail(
        'R_TYPE',
        `FOR variable '${binding.name}' must be INTEGER (got ${binding.typeName}).`,
        stmt.span,
      );
    }

    const goingUp = step > 0;
    for (let i = start; goingUp ? i <= end : i >= end; ) {
      binding.value = integerValue(i);
      await this.execBlock(stmt.body);
      const cur = asInteger(binding.value, 'FOR variable');
      i = cur + step;
      // Budget each iteration (empty FOR bodies still count).
      if (goingUp ? i <= end : i >= end) {
        await this.tick(stmt.span);
        await this.maybeYieldEventLoop(stmt.span);
      }
    }
  }

  private async readLine(): Promise<string> {
    const v = await this.host.readInput();
    if (typeof v !== 'string') {
      throw runtimeFail(
        'R_INPUT',
        'RuntimeHost.readInput must resolve to a string.',
      );
    }
    return v;
  }

  private async execInput(target: AssignTarget, span: SourceSpan): Promise<void> {
    let typeHint: TypeNameKind = 'STRING';
    if (target.kind === 'Identifier') {
      const b = this.env().lookup(target.name);
      if (!b) {
        throw runtimeFail(
          'R_UNDECL',
          `Undeclared identifier '${target.name}'.`,
          span,
        );
      }
      if (b.typeName === 'ARRAY') {
        throw runtimeFail(
          'R_INPUT',
          'Cannot INPUT a whole array; INPUT an element.',
          span,
        );
      }
      typeHint = b.typeName;
    } else {
      const b = this.env().lookup(target.array.name);
      if (!b || b.value.kind !== 'ARRAY') {
        throw runtimeFail(
          'R_UNDECL',
          `Undeclared array '${target.array.name}'.`,
          span,
        );
      }
      typeHint = b.value.element;
    }
    await this.assignTarget(target, parseInput(await this.readLine(), typeHint, span), span);
  }

  private async assignTarget(
    target: AssignTarget,
    value: RuntimeValue,
    span: SourceSpan,
  ): Promise<void> {
    if (target.kind === 'Identifier') {
      const b = this.env().lookup(target.name);
      if (!b) {
        throw runtimeFail(
          'R_UNDECL',
          `Undeclared identifier '${target.name}'.`,
          span,
        );
      }
      if (b.kind === 'constant') {
        throw runtimeFail(
          'R_ASSIGN_CONSTANT',
          `Cannot assign to CONSTANT '${b.name}'.`,
          span,
        );
      }
      if (b.typeName === 'ARRAY' || value.kind === 'ARRAY') {
        if (b.value.kind !== 'ARRAY' || value.kind !== 'ARRAY') {
          throw runtimeFail('R_TYPE', 'Array assignment type mismatch.', span);
        }
        if (!arrayShapesEqual(b.value, value)) {
          throw runtimeFail(
            'R_TYPE',
            'Array shapes do not match (element type and bounds).',
            span,
          );
        }
        for (let i = 0; i < b.value.data.length; i++) {
          b.value.data[i] = value.data[i]!;
        }
        return;
      }
      b.value = coerceAssign(b.typeName, value, span);
      return;
    }

    const arrBinding = this.env().lookup(target.array.name);
    if (!arrBinding || arrBinding.value.kind !== 'ARRAY') {
      throw runtimeFail(
        'R_UNDECL',
        `Undeclared array '${target.array.name}'.`,
        span,
      );
    }
    const arr = arrBinding.value;
    const indices: number[] = [];
    for (const ix of target.indices) {
      indices.push(asInteger(await this.evalExpr(ix), 'array index'));
    }
    const offset = arrayOffset(arr, indices, span);
    arr.data[offset] = coerceAssign(arr.element, value, span);
  }

  private async evalExpr(expr: Expression): Promise<RuntimeValue> {
    switch (expr.kind) {
      case 'IntegerLiteral':
        return integerValue(expr.value);
      case 'RealLiteral':
        return realValue(expr.value);
      case 'StringLiteral':
        return stringValue(expr.value);
      case 'CharLiteral':
        return charValue(expr.value);
      case 'BooleanLiteral':
        return booleanValue(expr.value);
      case 'Identifier': {
        const b = this.env().lookup(expr.name);
        if (!b) {
          throw runtimeFail(
            'R_UNDECL',
            `Undeclared identifier '${expr.name}'.`,
            expr.span,
          );
        }
        return b.value;
      }
      case 'GroupingExpression':
        return await this.evalExpr(expr.expression);
      case 'UnaryExpression':
        return evalUnary(
          expr.operator,
          await this.evalExpr(expr.argument),
          expr.span,
        );
      case 'BinaryExpression':
        // Short-circuit AND/OR (Cambridge-style; avoids evaluating RHS side effects).
        if (expr.operator === 'AND') {
          const left = await this.evalExpr(expr.left);
          if (!isTruthyBoolean(left)) return booleanValue(false);
          return booleanValue(isTruthyBoolean(await this.evalExpr(expr.right)));
        }
        if (expr.operator === 'OR') {
          const left = await this.evalExpr(expr.left);
          if (isTruthyBoolean(left)) return booleanValue(true);
          return booleanValue(isTruthyBoolean(await this.evalExpr(expr.right)));
        }
        return evalBinary(
          expr.operator,
          await this.evalExpr(expr.left),
          await this.evalExpr(expr.right),
          expr.span,
        );
      case 'CallExpression':
        return await this.callRoutine(
          expr.callee.name,
          expr.args,
          'function',
          expr.span,
        );
      case 'IndexExpression': {
        const b = this.env().lookup(expr.array.name);
        if (!b || b.value.kind !== 'ARRAY') {
          throw runtimeFail(
            'R_UNDECL',
            `Undeclared array '${expr.array.name}'.`,
            expr.span,
          );
        }
        const indices: number[] = [];
        for (const ix of expr.indices) {
          indices.push(asInteger(await this.evalExpr(ix), 'array index'));
        }
        return b.value.data[arrayOffset(b.value, indices, expr.span)]!;
      }
      case 'EofExpression': {
        const path = await this.evalFilePath(expr.fileName, expr.span);
        try {
          const atEnd = await this.files.eof(path);
          return booleanValue(Boolean(atEnd));
        } catch (e) {
          throw mapFileError(e, expr.span);
        }
      }
      default: {
        const _exhaustive: never = expr;
        return _exhaustive;
      }
    }
  }

  private async callRoutine(
    name: string,
    argExprs: readonly Expression[],
    mode: 'procedure' | 'function',
    span: SourceSpan,
  ): Promise<RuntimeValue> {
    if (lookupBuiltin(name)) {
      const args: RuntimeValue[] = [];
      for (const a of argExprs) args.push(await this.evalExpr(a));
      const result = executeBuiltin(name, args, this.random, span);
      return mode === 'procedure' ? integerValue(0) : result;
    }

    const routine = this.routines.get(identKey(name));
    if (!routine) {
      throw runtimeFail(
        'R_UNDECL_ROUTINE',
        `Undeclared PROCEDURE or FUNCTION '${name}'.`,
        span,
      );
    }
    if (mode === 'function' && routine.kind === 'procedure') {
      throw runtimeFail(
        'R_PROC_AS_EXPR',
        `PROCEDURE '${name}' cannot be used as an expression.`,
        span,
      );
    }

    const decl = routine.decl;
    if (argExprs.length !== decl.parameters.length) {
      throw runtimeFail(
        'R_ARG_COUNT',
        `'${name}' expects ${decl.parameters.length} argument(s) but got ${argExprs.length}.`,
        span,
      );
    }

    const argValues: RuntimeValue[] = [];
    for (const a of argExprs) argValues.push(await this.evalExpr(a));
    if (this.stack.depth() >= this.maxCallDepth) {
      throw runtimeFail(
        'R_STACK_OVERFLOW',
        `Call stack overflow (max depth ${this.maxCallDepth}).`,
        span,
        'Check for unbounded recursion.',
      );
    }

    const local = new Environment(this.globalEnv);
    bindParameters(local, decl.parameters, argValues, span);
    const frameKind = routine.kind === 'function' ? 'function' : 'procedure';
    const frame = this.stack.push(frameKind, decl.name.name, local, span);
    this.hooks?.onEnterFrame?.(frame);

    try {
      await this.execBlock(decl.body);
      this.hooks?.onExitFrame?.(frame);
      this.stack.pop();
      if (routine.kind === 'function') {
        throw runtimeFail(
          'R_NO_RETURN',
          `FUNCTION '${name}' ended without RETURN.`,
          span,
        );
      }
      return integerValue(0);
    } catch (e) {
      if (e instanceof ReturnSignal) {
        this.hooks?.onExitFrame?.(frame, e.value);
        this.stack.pop();
        return routine.kind === 'procedure' ? integerValue(0) : e.value;
      }
      // Still notify debugger so frames stay balanced on runtime errors.
      try {
        this.hooks?.onExitFrame?.(frame);
      } catch {
        // Debugger hooks must not mask the original runtime error.
      }
      this.stack.pop();
      throw e;
    }
  }

  private snapshotStack(): FrameSnapshot[] {
    return this.stack.snapshot().map((f) => ({
      id: f.id,
      kind: f.kind,
      name: f.name,
      variables: snapshotEnv(f.env),
    }));
  }
}

function snapshotEnv(env: Environment): VariableSnapshot[] {
  const vars: VariableSnapshot[] = [];
  for (const b of env.snapshot().values()) {
    vars.push({
      name: b.name,
      kind: b.kind,
      typeName: b.typeName,
      value: formatValue(b.value),
    });
  }
  return vars;
}

function bindParameters(
  env: Environment,
  params: readonly Parameter[],
  values: readonly RuntimeValue[],
  span: SourceSpan,
): void {
  for (let i = 0; i < params.length; i++) {
    const p = params[i]!;
    env.define(
      p.name.name,
      'parameter',
      p.typeName.name,
      coerceAssign(p.typeName.name, values[i]!, span),
    );
  }
}

function arrayShapesEqual(a: ArrayValue, b: ArrayValue): boolean {
  if (a.element !== b.element) return false;
  if (a.lowers.length !== b.lowers.length) return false;
  for (let i = 0; i < a.lowers.length; i++) {
    if (a.lowers[i] !== b.lowers[i] || a.uppers[i] !== b.uppers[i]) {
      return false;
    }
  }
  return true;
}

function coerceAssign(
  to: TypeNameKind,
  value: RuntimeValue,
  span: SourceSpan,
): ScalarValue {
  if (value.kind === 'ARRAY') {
    throw runtimeFail('R_TYPE', 'Cannot assign ARRAY to scalar.', span);
  }
  if (value.kind === to) return value;
  if (to === 'REAL' && value.kind === 'INTEGER') return realValue(value.value);
  throw runtimeFail('R_TYPE', `Cannot assign ${value.kind} to ${to}.`, span);
}

function valuesEqual(a: RuntimeValue, b: RuntimeValue): boolean {
  if (a.kind === 'ARRAY' || b.kind === 'ARRAY') return false;
  if (
    (a.kind === 'INTEGER' || a.kind === 'REAL') &&
    (b.kind === 'INTEGER' || b.kind === 'REAL')
  ) {
    return a.value === b.value;
  }
  if (a.kind !== b.kind) return false;
  return a.value === b.value;
}

function evalUnary(
  op: UnaryOperator,
  arg: RuntimeValue,
  _span: SourceSpan,
): RuntimeValue {
  void _span;
  if (op === 'NOT') return booleanValue(!isTruthyBoolean(arg));
  if (op === '-' || op === '+') {
    const n = asNumber(arg, `unary ${op}`);
    const v = op === '-' ? -n : n;
    return arg.kind === 'INTEGER' ? integerValue(v) : realValue(v);
  }
  const _exhaustive: never = op;
  return _exhaustive;
}

function evalBinary(
  op: BinaryOperator,
  left: RuntimeValue,
  right: RuntimeValue,
  span: SourceSpan,
): RuntimeValue {
  switch (op) {
    case '&': {
      if (
        (left.kind !== 'STRING' && left.kind !== 'CHAR') ||
        (right.kind !== 'STRING' && right.kind !== 'CHAR')
      ) {
        throw runtimeFail(
          'R_TYPE',
          `& requires STRING/CHAR operands (got ${left.kind}, ${right.kind}).`,
          span,
        );
      }
      return stringValue(left.value + right.value);
    }
    case 'AND':
    case 'OR':
      // Callers must short-circuit in Interpreter.evalExpr; keep arms for exhaustiveness.
      return booleanValue(
        op === 'AND'
          ? isTruthyBoolean(left) && isTruthyBoolean(right)
          : isTruthyBoolean(left) || isTruthyBoolean(right),
      );
    case '=':
      return booleanValue(valuesEqual(left, right));
    case '<>':
      return booleanValue(!valuesEqual(left, right));
    case '<':
    case '<=':
    case '>':
    case '>=':
      return booleanValue(compare(left, right, op, span));
    case '+':
    case '-':
    case '*':
    case '/':
    case 'DIV':
    case 'MOD':
      return numericOp(op, left, right, span);
    default: {
      const _exhaustive: never = op;
      return _exhaustive;
    }
  }
}

function compare(
  left: RuntimeValue,
  right: RuntimeValue,
  op: '<' | '<=' | '>' | '>=',
  span: SourceSpan,
): boolean {
  if (
    (left.kind === 'INTEGER' || left.kind === 'REAL') &&
    (right.kind === 'INTEGER' || right.kind === 'REAL')
  ) {
    const l = left.value;
    const r = right.value;
    if (op === '<') return l < r;
    if (op === '<=') return l <= r;
    if (op === '>') return l > r;
    return l >= r;
  }
  if (
    (left.kind === 'STRING' || left.kind === 'CHAR') &&
    (right.kind === 'STRING' || right.kind === 'CHAR')
  ) {
    const l = left.value;
    const r = right.value;
    if (op === '<') return l < r;
    if (op === '<=') return l <= r;
    if (op === '>') return l > r;
    return l >= r;
  }
  throw runtimeFail(
    'R_TYPE',
    `Cannot compare ${left.kind} and ${right.kind} with ${op}.`,
    span,
  );
}

function numericOp(
  op: string,
  left: RuntimeValue,
  right: RuntimeValue,
  span: SourceSpan,
): RuntimeValue {
  const l = asNumber(left, op);
  const r = asNumber(right, op);
  const bothInt = left.kind === 'INTEGER' && right.kind === 'INTEGER';
  switch (op) {
    case '+':
      return bothInt ? integerValue(l + r) : realValue(l + r);
    case '-':
      return bothInt ? integerValue(l - r) : realValue(l - r);
    case '*':
      return bothInt ? integerValue(l * r) : realValue(l * r);
    case '/':
      if (r === 0) throw runtimeFail('R_DIV_ZERO', 'Division by zero.', span);
      return realValue(l / r);
    case 'DIV':
      if (!bothInt) {
        throw runtimeFail('R_TYPE', 'DIV requires INTEGER operands.', span);
      }
      if (r === 0) throw runtimeFail('R_DIV_ZERO', 'DIV by zero.', span);
      return integerValue(Math.trunc(l / r));
    case 'MOD':
      if (!bothInt) {
        throw runtimeFail('R_TYPE', 'MOD requires INTEGER operands.', span);
      }
      if (r === 0) throw runtimeFail('R_DIV_ZERO', 'MOD by zero.', span);
      return integerValue(l - Math.trunc(l / r) * r);
    default:
      throw runtimeFail('R_TYPE', `Unknown numeric op '${op}'.`, span);
  }
}

function parseInput(
  raw: string,
  type: TypeNameKind,
  span: SourceSpan,
): ScalarValue {
  const t = raw.trim();
  switch (type) {
    case 'INTEGER': {
      if (!/^[+-]?\d+$/.test(t)) {
        throw runtimeFail('R_INPUT', `Invalid INTEGER INPUT '${raw}'.`, span);
      }
      return integerValue(Number(t));
    }
    case 'REAL': {
      const n = Number(t);
      if (!Number.isFinite(n) || t === '') {
        throw runtimeFail('R_INPUT', `Invalid REAL INPUT '${raw}'.`, span);
      }
      return realValue(n);
    }
    case 'BOOLEAN': {
      const u = t.toUpperCase();
      if (u === 'TRUE') return booleanValue(true);
      if (u === 'FALSE') return booleanValue(false);
      throw runtimeFail(
        'R_INPUT',
        `Invalid BOOLEAN INPUT '${raw}' (expected TRUE or FALSE).`,
        span,
      );
    }
    case 'STRING':
      return stringValue(raw);
    case 'CHAR':
      if (raw.length === 0) {
        throw runtimeFail('R_INPUT', 'CHAR INPUT requires one character.', span);
      }
      return charValue(raw[0]!);
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

function mapFileError(e: unknown, span: SourceSpan): RuntimeError {
  if (e instanceof FileSystemError) {
    return runtimeFail(e.code, e.message, span);
  }
  if (e instanceof RuntimeError) return e;
  throw e;
}

function isAbortError(e: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' &&
      e instanceof DOMException &&
      e.name === 'AbortError') ||
    (e instanceof Error && e.name === 'AbortError')
  );
}
