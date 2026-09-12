/**
 * Post-pass refinements for Python → Cambridge reverse translation.
 * Ensures generated IR produces valid, checkable Cambridge programs.
 */

import type {
  IrAssignTarget,
  IrExpression,
  IrParameter,
  IrSimpleType,
  IrStatement,
  IrTypeReference,
} from '../ir/nodes.js';
import type { TranslateDiagnostic } from '../types.js';

export type ArrayBounds = {
  readonly lower: IrExpression;
  readonly upper: IrExpression;
};

/** `(upper - lower + 1)` — Cambridge array element count. */
export function arrayLengthExpression(
  lower: IrExpression,
  upper: IrExpression,
): IrExpression {
  return {
    kind: 'IrBinaryExpression',
    operator: '+',
    left: {
      kind: 'IrBinaryExpression',
      operator: '-',
      left: upper,
      right: lower,
    },
    right: { kind: 'IrIntegerLiteral', value: 1 },
  };
}

export function literalArrayBounds(length: number): ArrayBounds {
  return {
    lower: { kind: 'IrIntegerLiteral', value: 1 },
    upper: { kind: 'IrIntegerLiteral', value: length },
  };
}

export function arrayTypeFromBounds(
  elementType: IrSimpleType,
  bounds: ArrayBounds,
): IrTypeReference {
  return {
    kind: 'IrArrayType',
    dimensions: [
      {
        kind: 'IrArrayDimension',
        lower: bounds.lower,
        upper: bounds.upper,
      },
    ],
    elementType,
  };
}

export function isUnknownType(typeRef: IrTypeReference): boolean {
  return typeRef.kind === 'IrNamedType' && typeRef.name === 'UNKNOWN';
}

function isPlaceholderParam(param: IrParameter): boolean {
  return param.unannotated === true && isUnknownType(param.typeName);
}

function isUnknownSimpleType(typeRef: IrSimpleType): boolean {
  return typeRef.kind === 'IrNamedType' && typeRef.name === 'UNKNOWN';
}

function collectForLoopVariables(body: readonly IrStatement[]): Set<string> {
  const vars = new Set<string>();
  const walk = (stmts: readonly IrStatement[]) => {
    for (const stmt of stmts) {
      if (stmt.kind === 'IrForStatement') {
        vars.add(stmt.variable.toLowerCase());
        walk(stmt.body);
      }
      if (stmt.kind === 'IrIfStatement') {
        walk(stmt.consequent);
        for (const c of stmt.elseIfClauses) walk(c.consequent);
        if (stmt.alternate) walk(stmt.alternate);
      }
      if (
        stmt.kind === 'IrWhileStatement' ||
        stmt.kind === 'IrRepeatStatement'
      ) {
        walk(stmt.body);
      }
      if (stmt.kind === 'IrCaseStatement') {
        for (const a of stmt.arms) walk(a.body);
        if (stmt.otherwise) walk(stmt.otherwise);
      }
    }
  };
  walk(body);
  return vars;
}

type TypeInferContext = {
  readonly forLoopVars?: ReadonlySet<string>;
  readonly paramTypes?: ReadonlyMap<string, IrSimpleType>;
  readonly paramArrayElements?: ReadonlyMap<string, IrSimpleType>;
  readonly localTypes?: ReadonlyMap<string, IrSimpleType>;
};

function buildTypeInferContext(
  parameters: readonly IrParameter[],
  body: readonly IrStatement[],
  localTypes?: ReadonlyMap<string, IrSimpleType>,
): TypeInferContext {
  const paramTypes = new Map<string, IrSimpleType>();
  const paramArrayElements = new Map<string, IrSimpleType>();
  for (const p of parameters) {
    if (p.typeName.kind === 'IrScalarType') {
      paramTypes.set(p.name.toLowerCase(), p.typeName);
    } else if (p.typeName.kind === 'IrNamedType' && p.typeName.name !== 'UNKNOWN') {
      paramTypes.set(p.name.toLowerCase(), p.typeName);
    } else if (p.typeName.kind === 'IrArrayType') {
      paramArrayElements.set(p.name.toLowerCase(), p.typeName.elementType);
    }
  }
  return {
    forLoopVars: collectForLoopVariables(body),
    paramTypes,
    paramArrayElements,
    ...(localTypes ? { localTypes } : {}),
  };
}

/** Infer local assignment types in routine body order (multi-pass for chained assigns). */
function collectLocalVariableTypes(
  body: readonly IrStatement[],
  parameters: readonly IrParameter[],
): Map<string, IrSimpleType> {
  const localTypes = new Map<string, IrSimpleType>();

  const walk = (stmts: readonly IrStatement[]): boolean => {
    let changed = false;
    const context = (): TypeInferContext =>
      buildTypeInferContext(parameters, body, localTypes);
    for (const stmt of stmts) {
      if (stmt.kind === 'IrAssignment' && stmt.target.kind === 'IrIdentifier') {
        const key = stmt.target.name.toLowerCase();
        if (!localTypes.has(key)) {
          const inferred = inferSimpleTypeFromExpr(stmt.value, context());
          if (inferred && !isUnknownSimpleType(inferred)) {
            localTypes.set(key, inferred);
            changed = true;
          }
        }
      }
      if (stmt.kind === 'IrIfStatement') {
        changed = walk(stmt.consequent) || changed;
        for (const c of stmt.elseIfClauses) changed = walk(c.consequent) || changed;
        if (stmt.alternate) changed = walk(stmt.alternate) || changed;
      }
      if (
        stmt.kind === 'IrWhileStatement' ||
        stmt.kind === 'IrRepeatStatement' ||
        stmt.kind === 'IrForStatement'
      ) {
        changed = walk(stmt.body) || changed;
      }
      if (stmt.kind === 'IrCaseStatement') {
        for (const a of stmt.arms) changed = walk(a.body) || changed;
        if (stmt.otherwise) changed = walk(stmt.otherwise) || changed;
      }
    }
    return changed;
  };

  while (walk(body)) {
    /* converge local types for `mid = f(low, high)` after `low`/`high` are known */
  }
  return localTypes;
}

export function inferSimpleTypeFromExpr(
  expr: IrExpression,
  context?: TypeInferContext,
): IrSimpleType | null {
  switch (expr.kind) {
    case 'IrIntegerLiteral':
      return { kind: 'IrScalarType', name: 'INTEGER' };
    case 'IrRealLiteral':
      return { kind: 'IrScalarType', name: 'REAL' };
    case 'IrStringLiteral':
      return { kind: 'IrScalarType', name: 'STRING' };
    case 'IrCharLiteral':
      return { kind: 'IrScalarType', name: 'CHAR' };
    case 'IrBooleanLiteral':
      return { kind: 'IrScalarType', name: 'BOOLEAN' };
    case 'IrUnaryExpression': {
      if (expr.operator !== '-') return null;
      return inferSimpleTypeFromExpr(expr.argument, context);
    }
    case 'IrIdentifier': {
      const key = expr.name.toLowerCase();
      const fromLocal = context?.localTypes?.get(key);
      if (fromLocal) return fromLocal;
      const fromParam = context?.paramTypes?.get(key);
      if (fromParam && !isUnknownSimpleType(fromParam)) return fromParam;
      if (context?.forLoopVars?.has(key)) {
        return { kind: 'IrScalarType', name: 'INTEGER' };
      }
      return null;
    }
    case 'IrBinaryExpression': {
      const left = inferSimpleTypeFromExpr(expr.left, context);
      const right = inferSimpleTypeFromExpr(expr.right, context);
      if (expr.operator === '&') {
        return { kind: 'IrScalarType', name: 'STRING' };
      }
      if (expr.operator === '//' || expr.operator === '%') {
        if (left && right) return unifyReturnTypes([left, right]);
        return { kind: 'IrScalarType', name: 'INTEGER' };
      }
      if (
        expr.operator === '+' ||
        expr.operator === '-' ||
        expr.operator === '*' ||
        expr.operator === '/'
      ) {
        if (!left || !right) return null;
        return unifyReturnTypes([left, right]);
      }
      return null;
    }
    case 'IrIndexExpression': {
      if (expr.array.kind === 'IrIdentifier') {
        const elem = context?.paramArrayElements?.get(expr.array.name.toLowerCase());
        if (elem) return elem;
      }
      return null;
    }
    case 'IrCallExpression': {
      if (expr.callee === 'LENGTH' && expr.args.length === 1) {
        return { kind: 'IrScalarType', name: 'INTEGER' };
      }
      return null;
    }
    case 'IrArrayLiteralExpression': {
      if (expr.elements.length === 0) return null;
      const first = inferSimpleTypeFromExpr(expr.elements[0]!, context);
      return first;
    }
    default:
      return null;
  }
}

export function inferTypeRefFromExpr(expr: IrExpression): IrTypeReference | null {
  if (expr.kind === 'IrArrayLiteralExpression') {
    const elem = expr.elements[0]
      ? inferSimpleTypeFromExpr(expr.elements[0])
      : null;
    if (!elem) return null;
    return arrayTypeFromBounds(elem, literalArrayBounds(expr.elements.length));
  }
  const scalar = inferSimpleTypeFromExpr(expr);
  return scalar;
}

export function unifyReturnTypes(types: readonly IrSimpleType[]): IrSimpleType | null {
  if (types.length === 0) return null;
  let acc = types[0]!;
  for (let i = 1; i < types.length; i++) {
    const next = types[i]!;
    if (acc.kind === 'IrNamedType' || next.kind === 'IrNamedType') return null;
    const a = acc.name;
    const b = next.name;
    if (a === b) continue;
    if (
      (a === 'INTEGER' && b === 'REAL') ||
      (a === 'REAL' && b === 'INTEGER')
    ) {
      acc = { kind: 'IrScalarType', name: 'REAL' };
      continue;
    }
    return null;
  }
  return acc;
}

function collectReturns(body: readonly IrStatement[]): IrExpression[] {
  const out: IrExpression[] = [];
  const walk = (stmts: readonly IrStatement[]) => {
    for (const stmt of stmts) {
      if (stmt.kind === 'IrReturnStatement') out.push(stmt.value);
      if (stmt.kind === 'IrIfStatement') {
        walk(stmt.consequent);
        for (const c of stmt.elseIfClauses) walk(c.consequent);
        if (stmt.alternate) walk(stmt.alternate);
      }
      if (
        stmt.kind === 'IrWhileStatement' ||
        stmt.kind === 'IrRepeatStatement' ||
        stmt.kind === 'IrForStatement'
      ) {
        walk(stmt.body);
      }
      if (stmt.kind === 'IrCaseStatement') {
        for (const a of stmt.arms) walk(a.body);
        if (stmt.otherwise) walk(stmt.otherwise);
      }
    }
  };
  walk(body);
  return out;
}

export function inferReturnTypeFromBody(
  body: readonly IrStatement[],
  parameters: readonly IrParameter[] = [],
): IrSimpleType | null {
  const localTypes = collectLocalVariableTypes(body, parameters);
  const context = buildTypeInferContext(parameters, body, localTypes);
  const values = collectReturns(body);
  const types = values
    .map((v) => inferSimpleTypeFromExpr(v, context))
    .filter((t): t is IrSimpleType => t !== null && !isUnknownSimpleType(t));
  return unifyReturnTypes(types);
}

function finalizeFunctionReturnType(
  stmt: Extract<IrStatement, { kind: 'IrFunctionDeclaration' }>,
): Extract<IrStatement, { kind: 'IrFunctionDeclaration' }> {
  if (!stmt.pendingReturnTypeInference) return stmt;
  const inferred = inferReturnTypeFromBody(stmt.body, stmt.parameters);
  if (inferred === null) return stmt;
  return {
    kind: 'IrFunctionDeclaration',
    name: stmt.name,
    parameters: stmt.parameters,
    returnType: inferred,
    body: stmt.body,
    leadingTrivia: stmt.leadingTrivia,
    trailingTrivia: stmt.trailingTrivia,
  };
}

/** Resolve deferred return types after parameter and local-variable refinement. */
export function inferPendingFunctionReturnTypes(
  statements: readonly IrStatement[],
): IrStatement[] {
  return statements.map((stmt) =>
    stmt.kind === 'IrFunctionDeclaration' ? finalizeFunctionReturnType(stmt) : stmt,
  );
}

/**
 * Promote bare Python `def` bodies that contain `return` but were still emitted as
 * PROCEDURE before refinement (legacy parse paths).
 */
export function promoteReturningProceduresToFunctions(
  statements: readonly IrStatement[],
): IrStatement[] {
  return statements.map((stmt) => {
    if (stmt.kind !== 'IrProcedureDeclaration') return stmt;
    if (!containsReturnInBody(stmt.body)) return stmt;
    return {
      kind: 'IrFunctionDeclaration' as const,
      name: stmt.name,
      parameters: stmt.parameters,
      returnType: { kind: 'IrNamedType' as const, name: 'UNKNOWN' },
      body: stmt.body,
      pendingReturnTypeInference: true as const,
      leadingTrivia: stmt.leadingTrivia,
      trailingTrivia: stmt.trailingTrivia,
    };
  });
}

function containsReturnInBody(body: readonly IrStatement[]): boolean {
  for (const stmt of body) {
    if (stmt.kind === 'IrReturnStatement') return true;
    if (stmt.kind === 'IrIfStatement') {
      if (containsReturnInBody(stmt.consequent)) return true;
      for (const c of stmt.elseIfClauses) {
        if (containsReturnInBody(c.consequent)) return true;
      }
      if (stmt.alternate && containsReturnInBody(stmt.alternate)) return true;
    }
    if (
      stmt.kind === 'IrWhileStatement' ||
      stmt.kind === 'IrRepeatStatement' ||
      stmt.kind === 'IrForStatement'
    ) {
      if (containsReturnInBody(stmt.body)) return true;
    }
    if (stmt.kind === 'IrCaseStatement') {
      for (const a of stmt.arms) {
        if (containsReturnInBody(a.body)) return true;
      }
      if (stmt.otherwise && containsReturnInBody(stmt.otherwise)) return true;
    }
  }
  return false;
}

export function collectUninferredReturnTypeErrors(
  statements: readonly IrStatement[],
): TranslateDiagnostic[] {
  const errors: TranslateDiagnostic[] = [];
  const walk = (stmts: readonly IrStatement[]) => {
    for (const stmt of stmts) {
      if (
        stmt.kind === 'IrFunctionDeclaration' &&
        stmt.pendingReturnTypeInference &&
        stmt.inferenceSpan
      ) {
        errors.push({
          severity: 'error',
          code: 'T_PY_PARSE',
          message:
            'Function has return statements but return type could not be inferred; add an explicit Python "->" annotation.',
          span: stmt.inferenceSpan,
        });
      }
      if (stmt.kind === 'IrIfStatement') {
        walk(stmt.consequent);
        for (const c of stmt.elseIfClauses) walk(c.consequent);
        if (stmt.alternate) walk(stmt.alternate);
      }
      if (
        stmt.kind === 'IrWhileStatement' ||
        stmt.kind === 'IrRepeatStatement' ||
        stmt.kind === 'IrForStatement'
      ) {
        walk(stmt.body);
      }
      if (stmt.kind === 'IrFunctionDeclaration' || stmt.kind === 'IrProcedureDeclaration') {
        walk(stmt.body);
      }
    }
  };
  walk(statements);
  return errors;
}

function mapExpr(
  expr: IrExpression,
  fn: (e: IrExpression) => IrExpression,
): IrExpression {
  const mapped = fn(expr);
  if (mapped !== expr) return mapped;
  switch (expr.kind) {
    case 'IrBinaryExpression':
      return {
        ...expr,
        left: mapExpr(expr.left, fn),
        right: mapExpr(expr.right, fn),
      };
    case 'IrUnaryExpression':
      return { ...expr, argument: mapExpr(expr.argument, fn) };
    case 'IrGroupingExpression':
      return { ...expr, expression: mapExpr(expr.expression, fn) };
    case 'IrIndexExpression':
      return {
        ...expr,
        array: mapExpr(expr.array, fn),
        indices: expr.indices.map((i) => mapExpr(i, fn)),
      };
    case 'IrCallExpression':
      return {
        ...expr,
        args: expr.args.map((a) => mapExpr(a, fn)),
      };
    default:
      return expr;
  }
}

function mapStmt(
  stmt: IrStatement,
  fn: (e: IrExpression) => IrExpression,
): IrStatement {
  switch (stmt.kind) {
    case 'IrAssignment':
      return {
        ...stmt,
        target:
          stmt.target.kind === 'IrIdentifier' ||
          stmt.target.kind === 'IrIndexExpression' ||
          stmt.target.kind === 'IrMemberExpression'
            ? (mapExpr(stmt.target, fn) as typeof stmt.target)
            : stmt.target,
        value: mapExpr(stmt.value, fn),
      };
    case 'IrOutput':
      return { ...stmt, values: stmt.values.map((v) => mapExpr(v, fn)) };
    case 'IrReturnStatement':
      return { ...stmt, value: mapExpr(stmt.value, fn) };
    case 'IrIfStatement':
      return {
        ...stmt,
        condition: mapExpr(stmt.condition, fn),
        consequent: stmt.consequent.map((s) => mapStmt(s, fn)),
        elseIfClauses: stmt.elseIfClauses.map((c) => ({
          ...c,
          condition: mapExpr(c.condition, fn),
          consequent: c.consequent.map((s) => mapStmt(s, fn)),
        })),
        alternate: stmt.alternate?.map((s) => mapStmt(s, fn)) ?? null,
      };
    case 'IrWhileStatement':
      return {
        ...stmt,
        condition: mapExpr(stmt.condition, fn),
        body: stmt.body.map((s) => mapStmt(s, fn)),
      };
    case 'IrRepeatStatement':
      return {
        ...stmt,
        condition: mapExpr(stmt.condition, fn),
        body: stmt.body.map((s) => mapStmt(s, fn)),
      };
    case 'IrForStatement':
      return {
        ...stmt,
        start: mapExpr(stmt.start, fn),
        end: mapExpr(stmt.end, fn),
        step: stmt.step ? mapExpr(stmt.step, fn) : null,
        body: stmt.body.map((s) => mapStmt(s, fn)),
      };
    case 'IrFunctionDeclaration':
    case 'IrProcedureDeclaration':
      return { ...stmt, body: stmt.body.map((s) => mapStmt(s, fn)) };
    default:
      return stmt;
  }
}

/** Replace `LENGTH(array)` with array length expression when bounds are known. */
export function rewriteArrayLenCalls(
  statements: readonly IrStatement[],
  bounds: ReadonlyMap<string, ArrayBounds>,
): IrStatement[] {
  const rewrite = (expr: IrExpression): IrExpression => {
    if (
      expr.kind === 'IrCallExpression' &&
      expr.callee === 'LENGTH' &&
      expr.args.length === 1
    ) {
      const arg = expr.args[0]!;
      if (arg.kind === 'IrIdentifier') {
        const b = bounds.get(arg.name.toLowerCase());
        if (b) return arrayLengthExpression(b.lower, b.upper);
      }
    }
    return expr;
  };
  return statements.map((s) => mapStmt(s, rewrite));
}

function collectTopLevelBounds(
  statements: readonly IrStatement[],
): Map<string, ArrayBounds> {
  const map = new Map<string, ArrayBounds>();
  for (const stmt of statements) {
    if (stmt.kind === 'IrDeclareStatement' && stmt.typeRef.kind === 'IrArrayType') {
      const dim = stmt.typeRef.dimensions[0];
      if (!dim) continue;
      for (const name of stmt.names) {
        map.set(name.toLowerCase(), { lower: dim.lower, upper: dim.upper });
      }
    }
    if (
      stmt.kind === 'IrAssignment' &&
      stmt.target.kind === 'IrIdentifier' &&
      stmt.value.kind === 'IrArrayLiteralExpression'
    ) {
      const lit = stmt.value;
      map.set(
        stmt.target.name.toLowerCase(),
        literalArrayBounds(lit.elements.length),
      );
    }
  }
  return map;
}

function collectRoutineSignatures(
  statements: readonly IrStatement[],
): Map<string, { params: IrParameter[]; returnType?: IrSimpleType }> {
  const map = new Map<string, { params: IrParameter[]; returnType?: IrSimpleType }>();
  for (const stmt of statements) {
    if (stmt.kind === 'IrFunctionDeclaration') {
      map.set(stmt.name.toLowerCase(), {
        params: stmt.parameters,
        returnType: stmt.returnType,
      });
    }
    if (stmt.kind === 'IrProcedureDeclaration') {
      map.set(stmt.name.toLowerCase(), { params: stmt.parameters });
    }
  }
  return map;
}

function walkCallSites(
  stmts: readonly IrStatement[],
  noteCall: (callee: string, args: readonly IrExpression[]) => void,
): void {
  for (const stmt of stmts) {
    if (stmt.kind === 'IrAssignment' && stmt.value.kind === 'IrCallExpression') {
      noteCall(stmt.value.callee, stmt.value.args);
    }
    if (stmt.kind === 'IrOutput') {
      for (const v of stmt.values) {
        if (v.kind === 'IrCallExpression') noteCall(v.callee, v.args);
      }
    }
    if (stmt.kind === 'IrCallStatement') {
      noteCall(stmt.callee, stmt.args);
    }
    if (stmt.kind === 'IrIfStatement') {
      walkCallSites(stmt.consequent, noteCall);
      for (const c of stmt.elseIfClauses) walkCallSites(c.consequent, noteCall);
      if (stmt.alternate) walkCallSites(stmt.alternate, noteCall);
    }
    if (
      stmt.kind === 'IrWhileStatement' ||
      stmt.kind === 'IrRepeatStatement' ||
      stmt.kind === 'IrForStatement'
    ) {
      walkCallSites(stmt.body, noteCall);
    }
    if (stmt.kind === 'IrFunctionDeclaration' || stmt.kind === 'IrProcedureDeclaration') {
      walkCallSites(stmt.body, noteCall);
    }
  }
}

function withoutParamInferenceMarker(p: IrParameter): IrParameter {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip inference markers
  const { unannotated, span, inferenceFallback, ...rest } = p;
  return rest;
}

/** Unify array parameter bounds with call-site argument bounds. */
export function propagateParameterBoundsFromCalls(
  statements: readonly IrStatement[],
): IrStatement[] {
  const varBounds = collectTopLevelBounds(statements);
  const routines = collectRoutineSignatures(statements);
  const paramBounds = new Map<string, ArrayBounds>();
  const paramArrayTypes = new Map<string, IrTypeReference>();

  const noteCall = (callee: string, args: readonly IrExpression[]) => {
    const sig = routines.get(callee.toLowerCase());
    if (!sig) return;
    for (let i = 0; i < sig.params.length && i < args.length; i++) {
      const arg = args[i]!;
      const param = sig.params[i]!;
      if (arg.kind !== 'IrIdentifier') continue;
      const b = varBounds.get(arg.name.toLowerCase());
      if (!b) continue;
      const key = `${callee.toLowerCase()}:${param.name.toLowerCase()}`;
      if (param.typeName.kind === 'IrArrayType') {
        paramBounds.set(key, b);
      } else if (isPlaceholderParam(param)) {
        paramArrayTypes.set(
          key,
          arrayTypeFromBounds({ kind: 'IrScalarType', name: 'INTEGER' }, b),
        );
      }
    }
  };

  walkCallSites(statements, noteCall);

  if (paramBounds.size === 0 && paramArrayTypes.size === 0) return [...statements];

  return statements.map((stmt) => {
    if (stmt.kind !== 'IrFunctionDeclaration' && stmt.kind !== 'IrProcedureDeclaration') {
      return stmt;
    }
    const parameters = stmt.parameters.map((p) => {
      const key = `${stmt.name.toLowerCase()}:${p.name.toLowerCase()}`;
      const fromCall = paramArrayTypes.get(key);
      if (fromCall) {
        return { ...withoutParamInferenceMarker(p), typeName: fromCall };
      }
      const b = paramBounds.get(key);
      if (b && p.typeName.kind === 'IrArrayType') {
        return {
          ...withoutParamInferenceMarker(p),
          typeName: arrayTypeFromBounds(p.typeName.elementType, b),
        };
      }
      return p;
    });
    if (stmt.kind === 'IrFunctionDeclaration') {
      return { ...stmt, parameters };
    }
    return { ...stmt, parameters };
  });
}

/** Insert DECLARE before first assignment of undeclared top-level names. */
export function insertTopLevelDeclarations(
  statements: readonly IrStatement[],
): IrStatement[] {
  const routines = collectRoutineSignatures(statements);
  const out: IrStatement[] = [];
  const declared = new Set<string>();

  for (const stmt of statements) {
    if (
      stmt.kind === 'IrFunctionDeclaration' ||
      stmt.kind === 'IrProcedureDeclaration'
    ) {
      declared.add(stmt.name.toLowerCase());
      out.push(stmt);
      continue;
    }
    if (stmt.kind === 'IrDeclareStatement') {
      for (const n of stmt.names) declared.add(n.toLowerCase());
      out.push(stmt);
      continue;
    }
    if (stmt.kind === 'IrConstantStatement') {
      declared.add(stmt.name.toLowerCase());
      out.push(stmt);
      continue;
    }
    if (stmt.kind === 'IrAssignment' && stmt.target.kind === 'IrIdentifier') {
      const name = stmt.target.name;
      if (!declared.has(name.toLowerCase())) {
        let typeRef: IrTypeReference | null = inferTypeRefFromExpr(stmt.value);
        if (
          !typeRef &&
          stmt.value.kind === 'IrCallExpression'
        ) {
          const sig = routines.get(stmt.value.callee.toLowerCase());
          if (sig?.returnType) {
            typeRef = sig.returnType;
          }
        }
        if (typeRef) {
          out.push({
            kind: 'IrDeclareStatement',
            names: [name],
            typeRef,
            leadingTrivia: [],
            trailingTrivia: [],
          });
          declared.add(name.toLowerCase());
        }
      }
    }
    out.push(stmt);
  }
  return out;
}

function walkRoutineBody(
  body: readonly IrStatement[],
  visit: (stmt: IrStatement) => void,
): void {
  for (const stmt of body) {
    visit(stmt);
    if (stmt.kind === 'IrIfStatement') {
      walkRoutineBody(stmt.consequent, visit);
      for (const c of stmt.elseIfClauses) walkRoutineBody(c.consequent, visit);
      if (stmt.alternate) walkRoutineBody(stmt.alternate, visit);
    } else if (
      stmt.kind === 'IrWhileStatement' ||
      stmt.kind === 'IrRepeatStatement' ||
      stmt.kind === 'IrForStatement'
    ) {
      walkRoutineBody(stmt.body, visit);
    } else if (stmt.kind === 'IrCaseStatement') {
      for (const a of stmt.arms) walkRoutineBody(a.body, visit);
      if (stmt.otherwise) walkRoutineBody(stmt.otherwise, visit);
    }
  }
}

function collectRoutineLocalAssignments(
  body: readonly IrStatement[],
): Map<string, { name: string; value: IrExpression }> {
  const assigned = new Map<string, { name: string; value: IrExpression }>();
  walkRoutineBody(body, (stmt) => {
    if (stmt.kind === 'IrAssignment' && stmt.target.kind === 'IrIdentifier') {
      const key = stmt.target.name.toLowerCase();
      if (!assigned.has(key)) {
        assigned.set(key, { name: stmt.target.name, value: stmt.value });
      }
    }
  });
  return assigned;
}

function collectExistingRoutineDeclarations(body: readonly IrStatement[]): Set<string> {
  const declared = new Set<string>();
  walkRoutineBody(body, (stmt) => {
    if (stmt.kind === 'IrDeclareStatement') {
      for (const n of stmt.names) declared.add(n.toLowerCase());
    }
  });
  return declared;
}

/** Insert DECLARE for undeclared locals inside FUNCTION/PROCEDURE bodies (hoisted). */
export function insertRoutineLocalDeclarations(
  statements: readonly IrStatement[],
): IrStatement[] {
  return statements.map((stmt) => {
    if (stmt.kind !== 'IrFunctionDeclaration' && stmt.kind !== 'IrProcedureDeclaration') {
      return stmt;
    }
    const paramNames = new Set(stmt.parameters.map((p) => p.name.toLowerCase()));
    const existing = collectExistingRoutineDeclarations(stmt.body);
    const assignments = collectRoutineLocalAssignments(stmt.body);
    const localTypes = collectLocalVariableTypes(stmt.body, stmt.parameters);
    const decls: IrStatement[] = [];
    for (const [key, { name, value }] of assignments) {
      if (paramNames.has(key) || existing.has(key)) continue;
      const fromLocals = localTypes.get(key);
      const typeRef: IrTypeReference =
        fromLocals ??
        inferTypeRefFromExpr(value) ??
        ({ kind: 'IrScalarType', name: 'INTEGER' } as const);
      decls.push({
        kind: 'IrDeclareStatement',
        names: [name],
        typeRef,
        leadingTrivia: [],
        trailingTrivia: [],
      });
    }
    if (decls.length === 0) return stmt;
    return { ...stmt, body: [...decls, ...stmt.body] };
  });
}

export function collectAllArrayBounds(
  statements: readonly IrStatement[],
): Map<string, ArrayBounds> {
  const map = collectTopLevelBounds(statements);
  const walk = (stmts: readonly IrStatement[]) => {
    for (const stmt of stmts) {
      if (stmt.kind === 'IrDeclareStatement' && stmt.typeRef.kind === 'IrArrayType') {
        const dim = stmt.typeRef.dimensions[0];
        if (!dim) continue;
        for (const name of stmt.names) {
          map.set(name.toLowerCase(), { lower: dim.lower, upper: dim.upper });
        }
      }
      if (
        stmt.kind === 'IrFunctionDeclaration' ||
        stmt.kind === 'IrProcedureDeclaration'
      ) {
        for (const p of stmt.parameters) {
          if (p.typeName.kind === 'IrArrayType') {
            const dim = p.typeName.dimensions[0];
            if (dim) {
              map.set(p.name.toLowerCase(), {
                lower: dim.lower,
                upper: dim.upper,
              });
            }
          }
        }
        walk(stmt.body);
      }
      if (stmt.kind === 'IrIfStatement') {
        walk(stmt.consequent);
        for (const c of stmt.elseIfClauses) walk(c.consequent);
        if (stmt.alternate) walk(stmt.alternate);
      }
      if (
        stmt.kind === 'IrWhileStatement' ||
        stmt.kind === 'IrRepeatStatement' ||
        stmt.kind === 'IrForStatement'
      ) {
        walk(stmt.body);
      }
    }
  };
  walk(statements);
  return map;
}

function paramUsedAsArray(name: string, body: readonly IrStatement[]): boolean {
  const key = name.toLowerCase();
  let found = false;
  const walkExpr = (expr: IrExpression) => {
    if (
      expr.kind === 'IrCallExpression' &&
      expr.callee === 'LENGTH' &&
      expr.args[0]?.kind === 'IrIdentifier' &&
      expr.args[0].name.toLowerCase() === key
    ) {
      found = true;
    }
    if (
      expr.kind === 'IrIndexExpression' &&
      expr.array.kind === 'IrIdentifier' &&
      expr.array.name.toLowerCase() === key
    ) {
      found = true;
    }
    switch (expr.kind) {
      case 'IrBinaryExpression':
        walkExpr(expr.left);
        walkExpr(expr.right);
        break;
      case 'IrUnaryExpression':
        walkExpr(expr.argument);
        break;
      case 'IrGroupingExpression':
        walkExpr(expr.expression);
        break;
      case 'IrCallExpression':
        for (const arg of expr.args) walkExpr(arg);
        break;
      case 'IrIndexExpression':
        walkExpr(expr.array);
        for (const idx of expr.indices) walkExpr(idx);
        break;
      default:
        break;
    }
  };
  const walk = (stmts: readonly IrStatement[]) => {
    for (const stmt of stmts) {
      if (stmt.kind === 'IrAssignment') {
        walkExpr(stmt.value);
        if (stmt.target.kind === 'IrIndexExpression') walkExpr(stmt.target);
      }
      if (stmt.kind === 'IrIfStatement') {
        walkExpr(stmt.condition);
        walk(stmt.consequent);
        for (const c of stmt.elseIfClauses) {
          walkExpr(c.condition);
          walk(c.consequent);
        }
        if (stmt.alternate) walk(stmt.alternate);
      }
      if (stmt.kind === 'IrReturnStatement') walkExpr(stmt.value);
      if (stmt.kind === 'IrForStatement') {
        walkExpr(stmt.start);
        walkExpr(stmt.end);
        if (stmt.step) walkExpr(stmt.step);
        walk(stmt.body);
      }
      if (
        stmt.kind === 'IrWhileStatement' ||
        stmt.kind === 'IrRepeatStatement'
      ) {
        walk(stmt.body);
      }
    }
  };
  walk(body);
  return found;
}

function exprContainsParam(expr: IrExpression, key: string): boolean {
  switch (expr.kind) {
    case 'IrIdentifier':
      return expr.name.toLowerCase() === key;
    case 'IrBinaryExpression':
      return exprContainsParam(expr.left, key) || exprContainsParam(expr.right, key);
    case 'IrUnaryExpression':
      return exprContainsParam(expr.argument, key);
    case 'IrGroupingExpression':
      return exprContainsParam(expr.expression, key);
    case 'IrIndexExpression':
      return (
        exprContainsParam(expr.array, key) ||
        expr.indices.some((i) => exprContainsParam(i, key))
      );
    case 'IrCallExpression':
      return expr.args.some((a) => exprContainsParam(a, key));
    case 'IrMemberExpression':
      return exprContainsParam(expr.object, key);
    default:
      return false;
  }
}

/**
 * Clear inference markers once reverse refinement has determined the final parameter type.
 * Warnings are emitted only for parameters that still carry `unannotated` after this pass.
 */
export function finalizeInferredParameters(
  statements: readonly IrStatement[],
): IrStatement[] {
  return statements.map((stmt) => {
    if (stmt.kind !== 'IrFunctionDeclaration' && stmt.kind !== 'IrProcedureDeclaration') {
      return stmt;
    }
    const parameters = stmt.parameters.map((p) => {
      if (!p.unannotated) return p;
      if (p.inferenceFallback) return p;
      if (isUnknownType(p.typeName)) return p;
      if (p.typeName.kind === 'IrArrayType') {
        return withoutParamInferenceMarker(p);
      }
      if (p.typeName.kind === 'IrScalarType') {
        return withoutParamInferenceMarker(p);
      }
      return p;
    });
    return { ...stmt, parameters };
  });
}

/**
 * Warn when an unannotated parameter still needed a Cambridge INTEGER fallback.
 * Successfully inferred parameters have their markers cleared before this runs.
 */
export function collectUninferredParameterWarnings(
  statements: readonly IrStatement[],
): TranslateDiagnostic[] {
  const warnings: TranslateDiagnostic[] = [];
  const walk = (stmts: readonly IrStatement[]) => {
    for (const stmt of stmts) {
      if (
        stmt.kind === 'IrFunctionDeclaration' ||
        stmt.kind === 'IrProcedureDeclaration'
      ) {
        for (const p of stmt.parameters) {
          if ((!p.unannotated && !p.inferenceFallback) || !p.span) continue;
          warnings.push({
            severity: 'warning',
            code: 'T_PROC_DEFAULT_TYPE',
            message: `Parameter '${p.name}' has no type annotation; could not infer a type from usage, using INTEGER for Cambridge output.`,
            span: p.span,
          });
        }
        walk(stmt.body);
      }
      if (stmt.kind === 'IrIfStatement') {
        walk(stmt.consequent);
        for (const c of stmt.elseIfClauses) walk(c.consequent);
        if (stmt.alternate) walk(stmt.alternate);
      }
      if (
        stmt.kind === 'IrWhileStatement' ||
        stmt.kind === 'IrRepeatStatement' ||
        stmt.kind === 'IrForStatement'
      ) {
        walk(stmt.body);
      }
    }
  };
  walk(statements);
  return warnings;
}

/** Upgrade unannotated params used with indexing/len to ARRAY placeholders. */
export function inferArrayParametersFromUsage(
  statements: readonly IrStatement[],
): IrStatement[] {
  return statements.map((stmt) => {
    if (stmt.kind !== 'IrFunctionDeclaration' && stmt.kind !== 'IrProcedureDeclaration') {
      return stmt;
    }
    const parameters = stmt.parameters.map((p) => {
      if (isPlaceholderParam(p) && paramUsedAsArray(p.name, stmt.body)) {
        return {
          ...withoutParamInferenceMarker(p),
          typeName: arrayTypeFromBounds(
            { kind: 'IrScalarType', name: 'INTEGER' },
            literalArrayBounds(1),
          ),
        };
      }
      return p;
    });
    if (stmt.kind === 'IrFunctionDeclaration') {
      return { ...stmt, parameters };
    }
    return { ...stmt, parameters };
  });
}

/** Infer scalar parameter types from literal or typed call-site arguments. */
export function inferScalarParametersFromCallSites(
  statements: readonly IrStatement[],
): IrStatement[] {
  const varBounds = collectTopLevelBounds(statements);
  const routines = collectRoutineSignatures(statements);
  const paramScalars = new Map<string, IrSimpleType>();

  const noteCall = (callee: string, args: readonly IrExpression[]) => {
    const sig = routines.get(callee.toLowerCase());
    if (!sig) return;
    for (let i = 0; i < sig.params.length && i < args.length; i++) {
      const param = sig.params[i]!;
      if (!isPlaceholderParam(param)) continue;
      const arg = args[i]!;
      if (arg.kind === 'IrArrayLiteralExpression') continue;
      if (arg.kind === 'IrIdentifier') {
        if (varBounds.has(arg.name.toLowerCase())) continue;
      }
      const inferred = inferSimpleTypeFromExpr(arg);
      if (!inferred || isUnknownSimpleType(inferred)) continue;
      paramScalars.set(`${callee.toLowerCase()}:${param.name.toLowerCase()}`, inferred);
    }
  };

  walkCallSites(statements, noteCall);
  if (paramScalars.size === 0) return [...statements];

  return statements.map((stmt) => {
    if (stmt.kind !== 'IrFunctionDeclaration' && stmt.kind !== 'IrProcedureDeclaration') {
      return stmt;
    }
    const parameters = stmt.parameters.map((p) => {
      const inferred = paramScalars.get(`${stmt.name.toLowerCase()}:${p.name.toLowerCase()}`);
      if (!inferred) return p;
      return {
        ...withoutParamInferenceMarker(p),
        typeName: inferred,
      };
    });
    if (stmt.kind === 'IrFunctionDeclaration') {
      return { ...stmt, parameters };
    }
    return { ...stmt, parameters };
  });
}

function collectParamConstraintTypes(
  paramName: string,
  parameters: readonly IrParameter[],
  body: readonly IrStatement[],
): IrSimpleType[] {
  const key = paramName.toLowerCase();
  const types: IrSimpleType[] = [];
  const context = buildTypeInferContext(
    parameters.filter((p) => !isUnknownType(p.typeName)),
    body,
  );

  const noteFromBinary = (expr: IrExpression) => {
    if (expr.kind !== 'IrBinaryExpression') return;
    const leftHas = exprContainsParam(expr.left, key);
    const rightHas = exprContainsParam(expr.right, key);
    if (leftHas && !rightHas) {
      const t = inferSimpleTypeFromExpr(expr.right, context);
      if (t && !isUnknownSimpleType(t)) types.push(t);
    }
    if (rightHas && !leftHas) {
      const t = inferSimpleTypeFromExpr(expr.left, context);
      if (t && !isUnknownSimpleType(t)) types.push(t);
    }
  };

  const walkExpr = (expr: IrExpression) => {
    noteFromBinary(expr);
    switch (expr.kind) {
      case 'IrBinaryExpression':
        walkExpr(expr.left);
        walkExpr(expr.right);
        break;
      case 'IrUnaryExpression':
        walkExpr(expr.argument);
        break;
      case 'IrGroupingExpression':
        walkExpr(expr.expression);
        break;
      case 'IrCallExpression':
        for (const arg of expr.args) walkExpr(arg);
        break;
      case 'IrIndexExpression':
        walkExpr(expr.array);
        for (const idx of expr.indices) walkExpr(idx);
        break;
      default:
        break;
    }
  };

  const walk = (stmts: readonly IrStatement[]) => {
    for (const stmt of stmts) {
      switch (stmt.kind) {
        case 'IrReturnStatement':
          walkExpr(stmt.value);
          break;
        case 'IrIfStatement':
          walkExpr(stmt.condition);
          walk(stmt.consequent);
          for (const c of stmt.elseIfClauses) {
            walkExpr(c.condition);
            walk(c.consequent);
          }
          if (stmt.alternate) walk(stmt.alternate);
          break;
        case 'IrWhileStatement':
        case 'IrRepeatStatement':
          walkExpr(stmt.condition);
          walk(stmt.body);
          break;
        case 'IrForStatement':
          walkExpr(stmt.start);
          walkExpr(stmt.end);
          if (stmt.step) walkExpr(stmt.step);
          walk(stmt.body);
          break;
        case 'IrAssignment':
          walkExpr(stmt.value);
          if (stmt.target.kind === 'IrIndexExpression') walkExpr(stmt.target);
          break;
        case 'IrOutput':
          for (const v of stmt.values) walkExpr(v);
          break;
        default:
          break;
      }
    }
  };

  walk(body);
  return types;
}

/** Infer scalar parameter types from comparisons and arithmetic in the routine body. */
export function resolveUnknownParametersFromBodyUsage(
  statements: readonly IrStatement[],
): IrStatement[] {
  return statements.map((stmt) => {
    if (stmt.kind !== 'IrFunctionDeclaration' && stmt.kind !== 'IrProcedureDeclaration') {
      return stmt;
    }
    const parameters = stmt.parameters.map((p) => {
      if (!isPlaceholderParam(p)) return p;
      const types = collectParamConstraintTypes(p.name, stmt.parameters, stmt.body);
      const inferred = unifyReturnTypes(types);
      if (!inferred || isUnknownSimpleType(inferred)) return p;
      return {
        ...withoutParamInferenceMarker(p),
        typeName: inferred,
      };
    });
    if (stmt.kind === 'IrFunctionDeclaration') {
      return { ...stmt, parameters };
    }
    return { ...stmt, parameters };
  });
}

function paramUsedOnlyInReturns(name: string, body: readonly IrStatement[]): boolean {
  const key = name.toLowerCase();
  let inReturn = false;
  let elsewhere = false;

  const walkExpr = (expr: IrExpression) => {
    if (!exprContainsParam(expr, key)) return;
    elsewhere = true;
  };

  const walkReturnExpr = (expr: IrExpression) => {
    if (expr.kind === 'IrIdentifier' && expr.name.toLowerCase() === key) {
      inReturn = true;
      return;
    }
    walkExpr(expr);
  };

  const walk = (stmts: readonly IrStatement[]) => {
    for (const stmt of stmts) {
      switch (stmt.kind) {
        case 'IrReturnStatement':
          walkReturnExpr(stmt.value);
          break;
        case 'IrIfStatement':
          walkExpr(stmt.condition);
          walk(stmt.consequent);
          for (const c of stmt.elseIfClauses) {
            walkExpr(c.condition);
            walk(c.consequent);
          }
          if (stmt.alternate) walk(stmt.alternate);
          break;
        case 'IrWhileStatement':
        case 'IrRepeatStatement':
          walkExpr(stmt.condition);
          walk(stmt.body);
          break;
        case 'IrForStatement':
          walkExpr(stmt.start);
          walkExpr(stmt.end);
          if (stmt.step) walkExpr(stmt.step);
          walk(stmt.body);
          break;
        case 'IrOutput':
          for (const v of stmt.values) walkExpr(v);
          break;
        case 'IrAssignment':
          walkExpr(stmt.value);
          break;
        default:
          break;
      }
    }
  };

  walk(body);
  return inReturn && !elsewhere;
}

/** Apply INTEGER fallback for remaining UNKNOWN Cambridge parameter types. */
export function applyCambridgeFallbackTypes(
  statements: readonly IrStatement[],
): IrStatement[] {
  return statements.map((stmt) => {
    if (stmt.kind !== 'IrFunctionDeclaration' && stmt.kind !== 'IrProcedureDeclaration') {
      return stmt;
    }
    const parameters = stmt.parameters.map((p) => {
      if (!isUnknownType(p.typeName)) return p;
      const fallbackType: IrTypeReference = { kind: 'IrScalarType', name: 'INTEGER' };
      const keepMarker =
        p.unannotated === true && !paramUsedOnlyInReturns(p.name, stmt.body);
      if (!keepMarker) {
        return { ...withoutParamInferenceMarker(p), typeName: fallbackType };
      }
      return { ...p, typeName: fallbackType, inferenceFallback: true as const };
    });
    if (stmt.kind === 'IrFunctionDeclaration') {
      return { ...stmt, parameters };
    }
    return { ...stmt, parameters };
  });
}

function foldLiteralAddSub(
  operator: '+' | '-',
  left: number,
  right: number,
): number {
  return operator === '+' ? left + right : left - right;
}

function isLiteralOne(expr: IrExpression): boolean {
  return expr.kind === 'IrIntegerLiteral' && expr.value === 1;
}

/** Fold literal integer arithmetic and cancel redundant ±1 compositions. */
export function simplifyIrExpression(expr: IrExpression): IrExpression {
  switch (expr.kind) {
    case 'IrBinaryExpression': {
      const left = simplifyIrExpression(expr.left);
      const right = simplifyIrExpression(expr.right);

      if (expr.operator === '-' && isLiteralOne(right)) {
        if (
          left.kind === 'IrBinaryExpression' &&
          left.operator === '+' &&
          isLiteralOne(left.right)
        ) {
          return left.left;
        }
      }
      if (expr.operator === '+' && isLiteralOne(right)) {
        if (
          left.kind === 'IrBinaryExpression' &&
          left.operator === '-' &&
          isLiteralOne(left.right)
        ) {
          return left.left;
        }
      }

      if (
        (expr.operator === '+' || expr.operator === '-') &&
        left.kind === 'IrIntegerLiteral' &&
        right.kind === 'IrIntegerLiteral'
      ) {
        return {
          kind: 'IrIntegerLiteral',
          value: foldLiteralAddSub(expr.operator, left.value, right.value),
        };
      }

      if (left === expr.left && right === expr.right) return expr;
      return { ...expr, left, right };
    }
    case 'IrUnaryExpression': {
      const argument = simplifyIrExpression(expr.argument);
      if (
        expr.operator === '-' &&
        argument.kind === 'IrIntegerLiteral'
      ) {
        return { kind: 'IrIntegerLiteral', value: -argument.value };
      }
      if (argument === expr.argument) return expr;
      return { ...expr, argument };
    }
    case 'IrGroupingExpression':
      // Preserve explicit parentheses from the Python source.
      return expr;
    case 'IrIndexExpression':
      return {
        ...expr,
        array: simplifyIrExpression(expr.array),
        indices: expr.indices.map((i) => simplifyIrExpression(i)),
      };
    case 'IrCallExpression':
      return {
        ...expr,
        args: expr.args.map((a) => simplifyIrExpression(a)),
      };
    default:
      return expr;
  }
}

/** Recurse into expression trees but only simplify index positions and loop/if bounds. */
function simplifyIndicesInExpr(expr: IrExpression): IrExpression {
  if (expr.kind === 'IrIndexExpression') {
    return {
      ...expr,
      array: simplifyIndicesInExpr(expr.array),
      indices: expr.indices.map((i) => simplifyIrExpression(i)),
    };
  }
  switch (expr.kind) {
    case 'IrBinaryExpression':
      return {
        ...expr,
        left: simplifyIndicesInExpr(expr.left),
        right: simplifyIndicesInExpr(expr.right),
      };
    case 'IrUnaryExpression':
      return { ...expr, argument: simplifyIndicesInExpr(expr.argument) };
    case 'IrGroupingExpression':
      return { ...expr, expression: simplifyIndicesInExpr(expr.expression) };
    case 'IrCallExpression':
      return { ...expr, args: expr.args.map((a) => simplifyIndicesInExpr(a)) };
    default:
      return expr;
  }
}

function simplifyTargetIndices(target: IrAssignTarget): IrAssignTarget {
  if (target.kind === 'IrIndexExpression') {
    return {
      ...target,
      array: simplifyIndicesInExpr(target.array),
      indices: target.indices.map((i) => simplifyIrExpression(i)),
    };
  }
  if (target.kind === 'IrMemberExpression') {
    return { ...target, object: simplifyIndicesInExpr(target.object) };
  }
  return target;
}

function simplifyLoopAndIndexStmt(stmt: IrStatement): IrStatement {
  switch (stmt.kind) {
    case 'IrForStatement':
      return {
        ...stmt,
        start: simplifyIrExpression(stmt.start),
        end: simplifyIrExpression(stmt.end),
        step: stmt.step ? simplifyIrExpression(stmt.step) : null,
        body: stmt.body.map(simplifyLoopAndIndexStmt),
      };
    case 'IrIfStatement':
      return {
        ...stmt,
        condition: simplifyIrExpression(stmt.condition),
        consequent: stmt.consequent.map(simplifyLoopAndIndexStmt),
        elseIfClauses: stmt.elseIfClauses.map((c) => ({
          ...c,
          condition: simplifyIrExpression(c.condition),
          consequent: c.consequent.map(simplifyLoopAndIndexStmt),
        })),
        alternate: stmt.alternate?.map(simplifyLoopAndIndexStmt) ?? null,
      };
    case 'IrWhileStatement':
    case 'IrRepeatStatement':
      return {
        ...stmt,
        condition: simplifyIrExpression(stmt.condition),
        body: stmt.body.map(simplifyLoopAndIndexStmt),
      };
    case 'IrAssignment':
      return {
        ...stmt,
        target: simplifyTargetIndices(stmt.target),
        value: simplifyIndicesInExpr(stmt.value),
      };
    case 'IrReturnStatement':
      return { ...stmt, value: simplifyIndicesInExpr(stmt.value) };
    case 'IrOutput':
      return { ...stmt, values: stmt.values.map((v) => simplifyIndicesInExpr(v)) };
    case 'IrFunctionDeclaration':
    case 'IrProcedureDeclaration':
      return { ...stmt, body: stmt.body.map(simplifyLoopAndIndexStmt) };
    default:
      return stmt;
  }
}

export function simplifyExpressionsInProgram(
  statements: readonly IrStatement[],
): IrStatement[] {
  return statements.map(simplifyLoopAndIndexStmt);
}

function collectScalarNameTypes(
  statements: readonly IrStatement[],
): Map<string, IrSimpleType> {
  const map = new Map<string, IrSimpleType>();
  for (const stmt of statements) {
    if (stmt.kind === 'IrDeclareStatement') {
      if (stmt.typeRef.kind === 'IrScalarType') {
        for (const name of stmt.names) {
          map.set(name.toLowerCase(), stmt.typeRef);
        }
      }
    }
    if (stmt.kind === 'IrFunctionDeclaration' || stmt.kind === 'IrProcedureDeclaration') {
      for (const p of stmt.parameters) {
        if (p.typeName.kind === 'IrScalarType') {
          map.set(p.name.toLowerCase(), p.typeName);
        }
      }
    }
  }
  return map;
}

function needsNumToStr(type: IrSimpleType): boolean {
  return (
    type.kind === 'IrScalarType' &&
    (type.name === 'INTEGER' || type.name === 'REAL')
  );
}

function wrapNumericForStringConcat(
  expr: IrExpression,
  types: ReadonlyMap<string, IrSimpleType>,
): IrExpression {
  const mapped = wrapNumericForStringConcatInner(expr, types);
  return simplifyIrExpression(mapped);
}

function wrapNumericForStringConcatInner(
  expr: IrExpression,
  types: ReadonlyMap<string, IrSimpleType>,
): IrExpression {
  switch (expr.kind) {
    case 'IrBinaryExpression':
      if (expr.operator === '&') {
        return {
          ...expr,
          left: wrapNumericOperand(expr.left, types),
          right: wrapNumericOperand(expr.right, types),
        };
      }
      return {
        ...expr,
        left: wrapNumericForStringConcatInner(expr.left, types),
        right: wrapNumericForStringConcatInner(expr.right, types),
      };
    case 'IrUnaryExpression':
      return {
        ...expr,
        argument: wrapNumericForStringConcatInner(expr.argument, types),
      };
    case 'IrGroupingExpression':
      return {
        ...expr,
        expression: wrapNumericForStringConcatInner(expr.expression, types),
      };
    default:
      return expr;
  }
}

function isNumericExpression(
  expr: IrExpression,
  types: ReadonlyMap<string, IrSimpleType>,
): boolean {
  switch (expr.kind) {
    case 'IrIntegerLiteral':
    case 'IrRealLiteral':
      return true;
    case 'IrIdentifier': {
      const t = types.get(expr.name.toLowerCase());
      return t !== undefined && needsNumToStr(t);
    }
    case 'IrBinaryExpression':
      if (
        expr.operator === '+' ||
        expr.operator === '-' ||
        expr.operator === '*' ||
        expr.operator === '/' ||
        expr.operator === '//' ||
        expr.operator === '%'
      ) {
        return (
          isNumericExpression(expr.left, types) && isNumericExpression(expr.right, types)
        );
      }
      return false;
    case 'IrUnaryExpression':
      return expr.operator === '-' && isNumericExpression(expr.argument, types);
    case 'IrGroupingExpression':
      return isNumericExpression(expr.expression, types);
    default:
      return false;
  }
}

function wrapNumericOperand(
  expr: IrExpression,
  types: ReadonlyMap<string, IrSimpleType>,
): IrExpression {
  if (isNumericExpression(expr, types)) {
    return {
      kind: 'IrCallExpression',
      callee: 'NUM_TO_STR',
      args: [expr],
    };
  }
  return wrapNumericForStringConcatInner(expr, types);
}

/** Wrap INTEGER/REAL operands in OUTPUT string concat chains with NUM_TO_STR. */
export function wrapNumericConcatInOutput(
  statements: readonly IrStatement[],
): IrStatement[] {
  const types = collectScalarNameTypes(statements);
  const fold = (expr: IrExpression): IrExpression =>
    wrapNumericForStringConcat(expr, types);
  return statements.map((s) => mapStmt(s, fold));
}

export function refineReverseProgram(body: readonly IrStatement[]): IrStatement[] {
  let stmts = [...body];
  stmts = promoteReturningProceduresToFunctions(stmts);
  stmts = inferArrayParametersFromUsage(stmts);
  stmts = propagateParameterBoundsFromCalls(stmts);
  stmts = inferScalarParametersFromCallSites(stmts);
  stmts = resolveUnknownParametersFromBodyUsage(stmts);
  stmts = inferPendingFunctionReturnTypes(stmts);
  stmts = insertTopLevelDeclarations(stmts);
  stmts = insertRoutineLocalDeclarations(stmts);
  stmts = wrapNumericConcatInOutput(stmts);
  const bounds = collectAllArrayBounds(stmts);
  stmts = rewriteArrayLenCalls(stmts, bounds);
  stmts = applyCambridgeFallbackTypes(stmts);
  stmts = inferPendingFunctionReturnTypes(stmts);
  return stmts;
}

/** Build Cambridge string concat from f-string parts. */
export function fStringPartsToConcat(
  parts: readonly { readonly kind: 'text' | 'expr'; readonly value: string | IrExpression }[],
): IrExpression {
  const exprs: IrExpression[] = [];
  for (const part of parts) {
    if (part.kind === 'text') {
      const text = part.value as string;
      if (text.length > 0) {
        exprs.push({ kind: 'IrStringLiteral', value: text });
      }
    } else {
      exprs.push(part.value as IrExpression);
    }
  }
  if (exprs.length === 0) {
    return { kind: 'IrStringLiteral', value: '' };
  }
  if (exprs.length === 1) return exprs[0]!;
  return exprs.reduce((left, right) => ({
    kind: 'IrBinaryExpression',
    operator: '&',
    left,
    right,
  }));
}

/** Parse simple f-string body: `text {expr} text` with no format specs. */
export function parseFStringContent(source: string): {
  parts: { kind: 'text' | 'expr'; value: string }[];
} | null {
  const parts: { kind: 'text' | 'expr'; value: string }[] = [];
  let i = 0;
  let text = '';
  while (i < source.length) {
    if (source[i] === '{') {
      if (text.length > 0) parts.push({ kind: 'text', value: text });
      text = '';
      i += 1;
      const start = i;
      while (i < source.length && source[i] !== '}') i += 1;
      if (i >= source.length) return null;
      const exprText = source.slice(start, i).trim();
      if (exprText.length === 0) return null;
      parts.push({ kind: 'expr', value: exprText });
      i += 1;
      continue;
    }
    text += source[i];
    i += 1;
  }
  if (text.length > 0) parts.push({ kind: 'text', value: text });
  return { parts };
}
