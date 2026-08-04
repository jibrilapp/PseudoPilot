import type {
  AssignTarget,
  BinaryOperator,
  Expression,
  FunctionDeclaration,
  Identifier,
  IndexExpression,
  MemberExpression,
  Parameter,
  ProcedureDeclaration,
  Program,
  SimpleType,
  SourceSpan,
  Statement,
  TypeNameKind,
  TypeReference,
  UnaryOperator,
  Visibility,
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
  allocateObject,
  allocateRecord,
  arrayOffset,
  asInteger,
  asNumber,
  booleanValue,
  charValue,
  cloneValue,
  dateValue,
  defaultScalar,
  formatValue,
  integerValue,
  isTruthyBoolean,
  realValue,
  ReturnSignal,
  RuntimeError,
  runtimeFail,
  stringValue,
  type ArrayElementType,
  type ArrayValue,
  type ObjectValue,
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

/** Registered `TYPE … ENDTYPE` shape: field name + its declared type reference. */
type RecordTypeDef = {
  readonly name: string;
  readonly fields: readonly { readonly name: string; readonly typeRef: TypeReference }[];
};

/** Registered `CLASS … ENDCLASS` method (procedure/function, including `NEW`). */
type ClassMethodDef = {
  readonly name: string;
  readonly kind: 'procedure' | 'function';
  readonly parameters: readonly Parameter[];
  readonly body: readonly Statement[];
  readonly returnType?: SimpleType;
  readonly isConstructor: boolean;
};

/** Registered `CLASS … ENDCLASS` shape. Own members only — inheritance is resolved via `inherits`. */
type ClassDef = {
  readonly name: string;
  /** Display name of the parent CLASS, or null. */
  readonly inherits: string | null;
  readonly fields: readonly {
    readonly name: string;
    readonly typeRef: TypeReference;
    readonly visibility: Visibility;
  }[];
  /** Case-folded method name → definition (own methods only). */
  readonly methods: ReadonlyMap<string, ClassMethodDef>;
};

/** A resolvable assignment target: read the current value, or store a new one. */
type Place = {
  get(): RuntimeValue;
  set(value: RuntimeValue): void;
};

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
  /** TYPE … ENDTYPE registry, case-folded name → field defs (declaration order). */
  private readonly typeRegistry = new Map<string, RecordTypeDef>();
  /** CLASS … ENDCLASS registry, case-folded name → own members. */
  private readonly classRegistry = new Map<string, ClassDef>();
  /** The object bound to implicit `this` inside the currently executing method/constructor (or null at top level). */
  private currentInstance: ObjectValue | null = null;
  /** Display name of the CLASS whose method/constructor is currently executing (defines SUPER's parent). */
  private currentMethodClass: string | null = null;

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
    this.typeRegistry.clear();
    this.classRegistry.clear();
    this.currentInstance = null;
    this.currentMethodClass = null;
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
      } else if (stmt.kind === 'TypeDeclaration') {
        const fields: { name: string; typeRef: TypeReference }[] = [];
        for (const fieldDecl of stmt.fields) {
          for (const id of fieldDecl.names) {
            fields.push({ name: id.name, typeRef: fieldDecl.typeRef });
          }
        }
        this.typeRegistry.set(identKey(stmt.name.name), {
          name: stmt.name.name,
          fields,
        });
      } else if (stmt.kind === 'ClassDeclaration') {
        const fields: {
          name: string;
          typeRef: TypeReference;
          visibility: Visibility;
        }[] = [];
        const methods = new Map<string, ClassMethodDef>();
        for (const member of stmt.members) {
          if (member.kind === 'ClassPropertyDeclaration') {
            for (const id of member.names) {
              fields.push({
                name: id.name,
                typeRef: member.typeRef,
                visibility: member.visibility ?? 'PUBLIC',
              });
            }
            continue;
          }
          const mkey = identKey(member.name.name);
          methods.set(mkey, {
            name: member.name.name,
            kind: member.kind === 'ClassFunctionDeclaration' ? 'function' : 'procedure',
            parameters: member.parameters,
            body: member.body,
            ...(member.kind === 'ClassFunctionDeclaration'
              ? { returnType: member.returnType }
              : {}),
            isConstructor: mkey === 'new',
          });
        }
        this.classRegistry.set(identKey(stmt.name.name), {
          name: stmt.name.name,
          inherits: stmt.inherits ? stmt.inherits.name : null,
          fields,
          methods,
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
        this.env().define(stmt.name.name, 'constant', value.kind, value);
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
        if (stmt.callee.kind === 'MemberExpression') {
          await this.callMethod(
            stmt.callee.object,
            stmt.callee.property,
            stmt.args,
            'procedure',
            stmt.span,
          );
          return;
        }
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
      case 'TypeDeclaration':
        // Registered into typeRegistry once at program start; nothing to do here.
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
      case 'ClassDeclaration':
        // Registered into classRegistry once at program start; nothing to do here.
        return;
      case 'ExpressionStatement':
        // Parser only ever produces MethodCallExpression / CallExpression
        // here (bare `Obj.Method(...)` / `Routine(...)` statements). Treat
        // as a statement-position ('procedure') call — mirrors the
        // checker's ExpressionStatement handling — so calling a PROCEDURE
        // method this way (e.g. `SUPER.NEW(...)`, `P.SetAttempts(5)`)
        // doesn't trip the "PROCEDURE used as expression" guard.
        if (stmt.expression.kind === 'MethodCallExpression') {
          await this.callMethod(
            stmt.expression.object,
            stmt.expression.method,
            stmt.expression.args,
            'procedure',
            stmt.expression.span,
          );
        } else if (stmt.expression.kind === 'CallExpression') {
          await this.callRoutine(
            stmt.expression.callee.name,
            stmt.expression.args,
            'procedure',
            stmt.expression.span,
          );
        } else {
          await this.evalExpr(stmt.expression);
        }
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
    const factory = await this.buildValueFactory(typeRef, span);
    const typeName = typeDisplayName(typeRef);
    for (const name of names) {
      this.env().define(name, 'variable', typeName, factory());
    }
  }

  /**
   * Build a reusable, side-effect-free factory that instantiates a fresh
   * default value for `typeRef`. Array bounds / nested TYPE lookups are
   * resolved once (async); the returned closure is synchronous so it can be
   * invoked once per DECLARE'd name / array slot / record field without
   * aliasing nested arrays or records.
   */
  private async buildValueFactory(
    typeRef: TypeReference,
    span: SourceSpan,
  ): Promise<() => RuntimeValue> {
    if (typeRef.kind === 'TypeName') {
      const name = typeRef.name;
      return () => defaultScalar(name);
    }
    if (typeRef.kind === 'NamedType') {
      if (this.classRegistry.has(identKey(typeRef.name))) {
        return this.buildClassFactory(typeRef.name, span);
      }
      return this.buildRecordFactory(typeRef.name, span);
    }
    // ArrayType
    const lowers: number[] = [];
    const uppers: number[] = [];
    for (const dim of typeRef.dimensions) {
      lowers.push(asInteger(await this.evalExpr(dim.lower), 'array lower bound'));
      uppers.push(asInteger(await this.evalExpr(dim.upper), 'array upper bound'));
    }
    const elementType = this.elementTypeOf(typeRef.elementType, span);
    const elementFactory = await this.buildSimpleValueFactory(typeRef.elementType, span);
    return () => allocateArray(elementType, lowers, uppers, elementFactory, span);
  }

  private async buildSimpleValueFactory(
    t: SimpleType,
    span: SourceSpan,
  ): Promise<() => RuntimeValue> {
    if (t.kind === 'TypeName') {
      const name = t.name;
      return () => defaultScalar(name);
    }
    if (this.classRegistry.has(identKey(t.name))) {
      return this.buildClassFactory(t.name, span);
    }
    return this.buildRecordFactory(t.name, span);
  }

  private elementTypeOf(t: SimpleType, span: SourceSpan): ArrayElementType {
    if (t.kind === 'TypeName') return { kind: 'SCALAR', name: t.name };
    const cls = this.classRegistry.get(identKey(t.name));
    if (cls) return { kind: 'CLASS', className: cls.name };
    const def = this.typeRegistry.get(identKey(t.name));
    if (!def) {
      throw runtimeFail('R_UNKNOWN_TYPE', `Unknown TYPE '${t.name}'.`, span);
    }
    return { kind: 'RECORD', typeName: def.name };
  }

  private async buildRecordFactory(
    typeName: string,
    span: SourceSpan,
  ): Promise<() => RuntimeValue> {
    const def = this.typeRegistry.get(identKey(typeName));
    if (!def) {
      throw runtimeFail('R_UNKNOWN_TYPE', `Unknown TYPE '${typeName}'.`, span);
    }
    const fieldFactories: {
      readonly key: string;
      readonly displayName: string;
      readonly factory: () => RuntimeValue;
    }[] = [];
    for (const f of def.fields) {
      const factory = await this.buildValueFactory(f.typeRef, span);
      fieldFactories.push({ key: identKey(f.name), displayName: f.name, factory });
    }
    return () =>
      allocateRecord(
        def.name,
        fieldFactories.map((f) => ({
          key: f.key,
          displayName: f.displayName,
          init: f.factory,
        })),
      );
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
    const place = await this.resolvePlace(target, span);
    const current = place.get();
    if (current.kind === 'ARRAY') {
      throw runtimeFail(
        'R_INPUT',
        'Cannot INPUT a whole array; INPUT an element.',
        span,
      );
    }
    if (current.kind === 'RECORD') {
      throw runtimeFail(
        'R_INPUT',
        'Cannot INPUT a whole record; INPUT a field.',
        span,
      );
    }
    if (current.kind === 'OBJECT') {
      throw runtimeFail(
        'R_INPUT',
        'Cannot INPUT a whole object; INPUT a field.',
        span,
      );
    }
    const typeHint: TypeNameKind = current.kind;
    place.set(parseInput(await this.readLine(), typeHint, span));
  }

  private async assignTarget(
    target: AssignTarget,
    value: RuntimeValue,
    span: SourceSpan,
  ): Promise<void> {
    const place = await this.resolvePlace(target, span);
    place.set(value);
  }

  /**
   * Resolve an Identifier / IndexExpression / MemberExpression (possibly
   * chained, e.g. `Class[1].Home.City`, `Students[i].Marks[j]`) to a place
   * that can be read or written. Records/arrays are reference types, so once
   * the innermost container is found, mutating it in place is sufficient —
   * no need to write the result back up the chain.
   */
  private async resolvePlace(
    target: Identifier | IndexExpression | MemberExpression,
    span: SourceSpan,
  ): Promise<Place> {
    if (target.kind === 'Identifier') {
      const b = this.env().lookup(target.name);
      if (b) {
        return {
          get: () => b.value,
          set: (value) => {
            if (b.kind === 'constant') {
              throw runtimeFail(
                'R_ASSIGN_CONSTANT',
                `Cannot assign to CONSTANT '${b.name}'.`,
                span,
              );
            }
            b.value = this.coerceForStore(b.value, value, span);
          },
        };
      }
      // Implicit `this`: bare identifiers inside a CLASS method resolve to
      // a field on the currently-executing instance when no local/param
      // shadows the name (mirrors the checker's resolveImplicitClassField).
      if (this.currentInstance) {
        const obj = this.currentInstance;
        const key = identKey(target.name);
        if (obj.fields.has(key)) {
          return {
            get: () => obj.fields.get(key)!,
            set: (value) => {
              obj.fields.set(key, this.coerceForStore(obj.fields.get(key)!, value, span));
            },
          };
        }
      }
      throw runtimeFail(
        'R_UNDECL',
        `Undeclared identifier '${target.name}'.`,
        span,
      );
    }

    if (target.kind === 'MemberExpression') {
      const obj = await this.evalExpr(target.object);
      if (obj.kind !== 'RECORD' && obj.kind !== 'OBJECT') {
        throw runtimeFail(
          'R_TYPE',
          `Cannot access field '${target.property.name}' on non-record/object value.`,
          span,
        );
      }
      const key = identKey(target.property.name);
      if (!obj.fields.has(key)) {
        const owner = obj.kind === 'RECORD' ? `TYPE '${obj.typeName}'` : `CLASS '${obj.className}'`;
        throw runtimeFail(
          'R_UNKNOWN_FIELD',
          `Unknown field '${target.property.name}' on ${owner}.`,
          span,
        );
      }
      return {
        get: () => obj.fields.get(key)!,
        set: (value) => {
          obj.fields.set(key, this.coerceForStore(obj.fields.get(key)!, value, span));
        },
      };
    }

    // IndexExpression
    const base = await this.evalExpr(target.array);
    if (base.kind !== 'ARRAY') {
      throw runtimeFail('R_TYPE', 'Cannot index a non-array value.', span);
    }
    const indices: number[] = [];
    for (const ix of target.indices) {
      indices.push(asInteger(await this.evalExpr(ix), 'array index'));
    }
    const offset = arrayOffset(base, indices, span);
    return {
      get: () => base.data[offset]!,
      set: (value) => {
        base.data[offset] = this.coerceForStore(base.data[offset]!, value, span);
      },
    };
  }

  /** Coerce/validate `incoming` against whatever currently occupies a place. */
  private coerceForStore(
    existing: RuntimeValue,
    incoming: RuntimeValue,
    span: SourceSpan,
  ): RuntimeValue {
    if (existing.kind === 'ARRAY' || incoming.kind === 'ARRAY') {
      if (existing.kind !== 'ARRAY' || incoming.kind !== 'ARRAY') {
        throw runtimeFail('R_TYPE', 'Array assignment type mismatch.', span);
      }
      if (!arrayShapesEqual(existing, incoming)) {
        throw runtimeFail(
          'R_TYPE',
          'Array shapes do not match (element type and bounds).',
          span,
        );
      }
      for (let i = 0; i < existing.data.length; i++) {
        existing.data[i] = cloneValue(incoming.data[i]!);
      }
      return existing;
    }
    if (existing.kind === 'RECORD' || incoming.kind === 'RECORD') {
      if (existing.kind !== 'RECORD' || incoming.kind !== 'RECORD') {
        throw runtimeFail('R_TYPE', 'Record assignment type mismatch.', span);
      }
      if (identKey(existing.typeName) !== identKey(incoming.typeName)) {
        throw runtimeFail(
          'R_TYPE',
          `Cannot assign TYPE '${incoming.typeName}' to TYPE '${existing.typeName}'.`,
          span,
        );
      }
      return cloneValue(incoming);
    }
    if (existing.kind === 'OBJECT' || incoming.kind === 'OBJECT') {
      if (existing.kind !== 'OBJECT' || incoming.kind !== 'OBJECT') {
        throw runtimeFail('R_TYPE', 'Object assignment type mismatch.', span);
      }
      // Objects are reference types: store the same instance (aliasing) —
      // the Cambridge 9618 semantic that distinguishes CLASS from TYPE.
      // Never clone, unlike RECORD/ARRAY above.
      return incoming;
    }
    return coerceAssign(existing.kind, incoming, span);
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
      case 'DateLiteral':
        return dateValue(expr.day, expr.month, expr.year);
      case 'Identifier': {
        const b = this.env().lookup(expr.name);
        if (b) return b.value;
        // Implicit `this`: see the matching branch in resolvePlace().
        if (this.currentInstance) {
          const key = identKey(expr.name);
          if (this.currentInstance.fields.has(key)) {
            return this.currentInstance.fields.get(key)!;
          }
        }
        throw runtimeFail(
          'R_UNDECL',
          `Undeclared identifier '${expr.name}'.`,
          expr.span,
        );
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
      case 'IndexExpression':
        return (await this.resolvePlace(expr, expr.span)).get();
      case 'MemberExpression':
        return (await this.resolvePlace(expr, expr.span)).get();
      case 'EofExpression': {
        const path = await this.evalFilePath(expr.fileName, expr.span);
        try {
          const atEnd = await this.files.eof(path);
          return booleanValue(Boolean(atEnd));
        } catch (e) {
          throw mapFileError(e, expr.span);
        }
      }
      case 'NewExpression':
        return await this.evalNew(expr, expr.span);
      case 'MethodCallExpression':
        return await this.callMethod(expr.object, expr.method, expr.args, 'function', expr.span);
      case 'SuperExpression':
        // Only meaningful as the `.object` of a MethodCallExpression
        // (`SUPER.Method(...)`), which is special-cased in callMethod()
        // before this expression is ever evaluated directly.
        throw runtimeFail(
          'R_SUPER_OUTSIDE',
          'SUPER is only valid as SUPER.<Method>(...) inside a CLASS method.',
          expr.span,
        );
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

  // ── CLASS / OOP runtime ────────────────────────────────────────────────

  private resolveClass(name: string): ClassDef | undefined {
    return this.classRegistry.get(identKey(name));
  }

  /** All fields (ancestors first, then own), for allocation order. */
  private collectAllFields(
    cls: ClassDef,
    depth = 0,
  ): readonly { readonly name: string; readonly typeRef: TypeReference }[] {
    if (cls.inherits === null || depth >= 64) return cls.fields;
    const parent = this.resolveClass(cls.inherits);
    if (!parent) return cls.fields;
    return [...this.collectAllFields(parent, depth + 1), ...cls.fields];
  }

  /** Walk inheritance to find `name` — child overrides win. Reports the owning CLASS. */
  private lookupMethod(
    cls: ClassDef,
    name: string,
    depth = 0,
  ): { readonly method: ClassMethodDef; readonly owner: string } | undefined {
    const own = cls.methods.get(identKey(name));
    if (own) return { method: own, owner: cls.name };
    if (cls.inherits === null || depth >= 64) return undefined;
    const parent = this.resolveClass(cls.inherits);
    if (!parent) return undefined;
    return this.lookupMethod(parent, name, depth + 1);
  }

  /**
   * Build a reusable, side-effect-free factory that allocates a fresh
   * default-initialised instance of `className` (fields zeroed/empty, no
   * constructor invoked) — mirrors {@link buildRecordFactory}.
   */
  private async buildClassFactory(
    className: string,
    span: SourceSpan,
  ): Promise<() => RuntimeValue> {
    const cls = this.resolveClass(className);
    if (!cls) {
      throw runtimeFail('R_UNKNOWN_CLASS', `Unknown CLASS '${className}'.`, span);
    }
    const fieldFactories: {
      readonly key: string;
      readonly displayName: string;
      readonly factory: () => RuntimeValue;
    }[] = [];
    for (const f of this.collectAllFields(cls)) {
      const factory = await this.buildValueFactory(f.typeRef, span);
      fieldFactories.push({ key: identKey(f.name), displayName: f.name, factory });
    }
    return () =>
      allocateObject(
        cls.name,
        fieldFactories.map((f) => ({
          key: f.key,
          displayName: f.displayName,
          init: f.factory,
        })),
      );
  }

  private async allocateDefaultObject(
    className: string,
    span: SourceSpan,
  ): Promise<ObjectValue> {
    const factory = await this.buildClassFactory(className, span);
    return factory() as ObjectValue;
  }

  /** `NEW ClassName(args)` — allocate, then run the (possibly inherited) constructor. */
  private async evalNew(
    expr: Extract<Expression, { kind: 'NewExpression' }>,
    span: SourceSpan,
  ): Promise<RuntimeValue> {
    const cls = this.resolveClass(expr.className.name);
    if (!cls) {
      throw runtimeFail(
        'R_UNKNOWN_CLASS',
        `Unknown CLASS '${expr.className.name}'.`,
        span,
      );
    }
    const obj = await this.allocateDefaultObject(cls.name, span);

    const found = this.lookupMethod(cls, 'NEW');
    if (!found) {
      if (expr.args.length !== 0) {
        throw runtimeFail(
          'R_ARG_COUNT',
          `CLASS '${cls.name}' has no constructor; NEW ${cls.name}(...) must have 0 arguments.`,
          span,
        );
      }
      return obj;
    }

    await this.invokeMethod(obj, found.owner, found.method, expr.args, span, 'procedure');
    return obj;
  }

  /**
   * Resolve and invoke `<object>.<method>(<args>)` — used for
   * `MethodCallExpression` (as a value) and `CallStatement` /
   * `ExpressionStatement` (as a statement). `SUPER.Method(...)` dispatches
   * from the parent of the CLASS whose method is *currently executing*
   * (lexical), not the runtime class of the object.
   */
  private async callMethod(
    objectExpr: Expression,
    methodIdent: Identifier,
    argExprs: readonly Expression[],
    mode: 'procedure' | 'function',
    span: SourceSpan,
  ): Promise<RuntimeValue> {
    let target: ObjectValue;
    let searchClass: ClassDef;

    if (objectExpr.kind === 'SuperExpression') {
      if (!this.currentInstance || !this.currentMethodClass) {
        throw runtimeFail(
          'R_SUPER_OUTSIDE',
          'SUPER is only valid inside a CLASS method.',
          span,
        );
      }
      const currentDef = this.resolveClass(this.currentMethodClass);
      if (!currentDef || currentDef.inherits === null) {
        throw runtimeFail(
          'R_SUPER_OUTSIDE',
          `CLASS '${this.currentMethodClass}' has no parent CLASS; SUPER is not valid here.`,
          span,
        );
      }
      const parent = this.resolveClass(currentDef.inherits);
      if (!parent) {
        throw runtimeFail(
          'R_UNKNOWN_CLASS',
          `Unknown CLASS '${currentDef.inherits}'.`,
          span,
        );
      }
      target = this.currentInstance;
      searchClass = parent;
    } else {
      const objVal = await this.evalExpr(objectExpr);
      if (objVal.kind !== 'OBJECT') {
        throw runtimeFail(
          'R_TYPE',
          `Cannot call method '${methodIdent.name}' on non-object value (got ${objVal.kind}).`,
          span,
          'Method calls require a CLASS instance (see NEW).',
        );
      }
      const cls = this.resolveClass(objVal.className);
      if (!cls) {
        throw runtimeFail('R_UNKNOWN_CLASS', `Unknown CLASS '${objVal.className}'.`, span);
      }
      // Dynamic dispatch: resolve from the object's *runtime* class, not the
      // static declared type of the expression — enables polymorphism.
      target = objVal;
      searchClass = cls;
    }

    const found = this.lookupMethod(searchClass, methodIdent.name);
    if (!found) {
      throw runtimeFail(
        'R_UNKNOWN_METHOD',
        `Unknown method '${methodIdent.name}' on CLASS '${searchClass.name}'.`,
        span,
      );
    }
    return this.invokeMethod(target, found.owner, found.method, argExprs, span, mode);
  }

  /** Shared call machinery for constructors and methods: bind params, push a frame, run the body, restore implicit-`this` state. */
  private async invokeMethod(
    target: ObjectValue,
    owner: string,
    method: ClassMethodDef,
    argExprs: readonly Expression[],
    span: SourceSpan,
    mode: 'procedure' | 'function',
  ): Promise<RuntimeValue> {
    if (mode === 'function' && method.kind === 'procedure') {
      throw runtimeFail(
        'R_PROC_AS_EXPR',
        `PROCEDURE method '${method.name}' cannot be used as an expression.`,
        span,
      );
    }
    if (argExprs.length !== method.parameters.length) {
      throw runtimeFail(
        'R_ARG_COUNT',
        `'${method.name}' expects ${method.parameters.length} argument(s) but got ${argExprs.length}.`,
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
    bindParameters(local, method.parameters, argValues, span);
    const frameKind = method.kind === 'function' ? 'function' : 'procedure';
    const frame = this.stack.push(frameKind, `${owner}.${method.name}`, local, span);
    this.hooks?.onEnterFrame?.(frame);

    const prevInstance = this.currentInstance;
    const prevMethodClass = this.currentMethodClass;
    this.currentInstance = target;
    this.currentMethodClass = owner;

    try {
      await this.execBlock(method.body);
      this.hooks?.onExitFrame?.(frame);
      this.stack.pop();
      if (method.kind === 'function') {
        throw runtimeFail(
          'R_NO_RETURN',
          `Method '${method.name}' ended without RETURN.`,
          span,
        );
      }
      return integerValue(0);
    } catch (e) {
      if (e instanceof ReturnSignal) {
        this.hooks?.onExitFrame?.(frame, e.value);
        this.stack.pop();
        return method.kind === 'procedure' ? integerValue(0) : e.value;
      }
      try {
        this.hooks?.onExitFrame?.(frame);
      } catch {
        // Debugger hooks must not mask the original runtime error.
      }
      this.stack.pop();
      throw e;
    } finally {
      this.currentInstance = prevInstance;
      this.currentMethodClass = prevMethodClass;
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

function typeDisplayName(typeRef: TypeReference): string {
  if (typeRef.kind === 'TypeName') return typeRef.name;
  if (typeRef.kind === 'NamedType') return typeRef.name;
  return 'ARRAY';
}

function bindParameters(
  env: Environment,
  params: readonly Parameter[],
  values: readonly RuntimeValue[],
  span: SourceSpan,
): void {
  for (let i = 0; i < params.length; i++) {
    const p = params[i]!;
    const value = values[i]!;
    if (p.typeName.kind === 'NamedType') {
      if (value.kind === 'OBJECT') {
        // CLASS parameters are reference types: alias the same instance
        // (covariance already validated statically by the checker).
        env.define(p.name.name, 'parameter', value.className, value);
        continue;
      }
      if (value.kind !== 'RECORD' || identKey(value.typeName) !== identKey(p.typeName.name)) {
        throw runtimeFail(
          'R_TYPE',
          `Parameter '${p.name.name}' expects TYPE '${p.typeName.name}' (got ${value.kind}).`,
          span,
        );
      }
      env.define(p.name.name, 'parameter', p.typeName.name, cloneValue(value));
      continue;
    }
    env.define(
      p.name.name,
      'parameter',
      p.typeName.name,
      coerceAssign(p.typeName.name, value, span),
    );
  }
}

function arrayElementTypesEqual(a: ArrayElementType, b: ArrayElementType): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'SCALAR') return b.kind === 'SCALAR' && a.name === b.name;
  if (a.kind === 'RECORD') return b.kind === 'RECORD' && identKey(a.typeName) === identKey(b.typeName);
  return b.kind === 'CLASS' && identKey(a.className) === identKey(b.className);
}

function arrayShapesEqual(a: ArrayValue, b: ArrayValue): boolean {
  if (!arrayElementTypesEqual(a.element, b.element)) return false;
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
  if (value.kind === 'ARRAY' || value.kind === 'RECORD' || value.kind === 'OBJECT') {
    throw runtimeFail('R_TYPE', `Cannot assign ${value.kind} to scalar.`, span);
  }
  if (value.kind === to) return value;
  if (to === 'REAL' && value.kind === 'INTEGER') return realValue(value.value);
  throw runtimeFail('R_TYPE', `Cannot assign ${value.kind} to ${to}.`, span);
}

function valuesEqual(a: RuntimeValue, b: RuntimeValue): boolean {
  if (a.kind === 'ARRAY' || b.kind === 'ARRAY') return false;
  if (a.kind === 'RECORD' || b.kind === 'RECORD') return false;
  if (a.kind === 'OBJECT' || b.kind === 'OBJECT') return false;
  if (
    (a.kind === 'INTEGER' || a.kind === 'REAL') &&
    (b.kind === 'INTEGER' || b.kind === 'REAL')
  ) {
    return a.value === b.value;
  }
  if (a.kind === 'DATE' && b.kind === 'DATE') {
    return a.day === b.day && a.month === b.month && a.year === b.year;
  }
  if (a.kind !== b.kind) return false;
  if (
    a.kind === 'STRING' ||
    a.kind === 'CHAR' ||
    a.kind === 'BOOLEAN' ||
    a.kind === 'INTEGER' ||
    a.kind === 'REAL'
  ) {
    return a.value === (b as typeof a).value;
  }
  return false;
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
  if (left.kind === 'DATE' && right.kind === 'DATE') {
    const l = left.year * 10000 + left.month * 100 + left.day;
    const r = right.year * 10000 + right.month * 100 + right.day;
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
    case 'DATE': {
      const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
      if (!m) {
        throw runtimeFail(
          'R_INPUT',
          `Invalid DATE INPUT '${raw}' (expected dd/mm/yyyy).`,
          span,
        );
      }
      const day = Number(m[1]);
      const month = Number(m[2]);
      const year = Number(m[3]);
      const dt = new Date(Date.UTC(year, month - 1, day));
      if (
        dt.getUTCFullYear() !== year ||
        dt.getUTCMonth() !== month - 1 ||
        dt.getUTCDate() !== day
      ) {
        throw runtimeFail('R_INPUT', `Invalid calendar DATE '${raw}'.`, span);
      }
      return dateValue(day, month, year);
    }
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
