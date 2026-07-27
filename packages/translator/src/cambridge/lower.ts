import type {
  AssignTarget,
  Expression,
  Program,
  Statement,
} from '@pseudopilot/language-core';
import {
  emptyTrivia,
  withEmptyTrivia,
  type IrAssignTarget,
  type IrCaseArm,
  type IrCaseLabel,
  type IrElseIfClause,
  type IrExpression,
  type IrProgram,
  type IrStatement,
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

function lowerTarget(
  target: AssignTarget,
  diagnostics: TranslateDiagnostic[],
): IrAssignTarget | null {
  if (target.kind === 'Identifier') {
    return { kind: 'IrIdentifier', name: target.name };
  }
  const indices: IrExpression[] = [];
  for (const idx of target.indices) {
    const lowered = lowerExpression(idx, diagnostics);
    if (!lowered) return null;
    indices.push(lowered);
  }
  return {
    kind: 'IrIndexExpression',
    array: { kind: 'IrIdentifier', name: target.array.name },
    indices,
  };
}

function lowerExpression(
  expr: Expression,
  diagnostics: TranslateDiagnostic[],
): IrExpression | null {
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
      return { kind: 'IrIdentifier', name: expr.name };
    case 'IndexExpression': {
      const indices: IrExpression[] = [];
      for (const idx of expr.indices) {
        const lowered = lowerExpression(idx, diagnostics);
        if (!lowered) return null;
        indices.push(lowered);
      }
      return {
        kind: 'IrIndexExpression',
        array: { kind: 'IrIdentifier', name: expr.array.name },
        indices,
      };
    }
    case 'UnaryExpression': {
      const argument = lowerExpression(expr.argument, diagnostics);
      if (!argument) return null;
      return {
        kind: 'IrUnaryExpression',
        operator: cambridgeUnaryToIr(expr.operator),
        argument,
      };
    }
    case 'BinaryExpression': {
      const left = lowerExpression(expr.left, diagnostics);
      const right = lowerExpression(expr.right, diagnostics);
      if (!left || !right) return null;
      return {
        kind: 'IrBinaryExpression',
        operator: cambridgeBinaryToIr(expr.operator),
        left,
        right,
      };
    }
    case 'GroupingExpression': {
      const inner = lowerExpression(expr.expression, diagnostics);
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
        const lowered = lowerExpression(arg, diagnostics);
        if (!lowered) return null;
        args.push(lowered);
      }
      return {
        kind: 'IrCallExpression',
        callee: expr.callee.name,
        args,
      };
    }
    case 'EofExpression':
      diagnostics.push({
        severity: 'error',
        code: 'T_UNSUPPORTED_EOF',
        message: 'Translator does not support EOF(...).',
        span: expr.span,
      });
      return null;
    default: {
      const _exhaustive: never = expr;
      return _exhaustive;
    }
  }
}

/** Lower a statement list; skip unsupported nodes (diagnostics already emitted).
 * Warns on statements after RETURN at the same block level.
 */
function lowerBlock(
  statements: Statement[],
  diagnostics: TranslateDiagnostic[],
): IrStatement[] {
  const out: IrStatement[] = [];
  let seenReturn = false;
  for (const stmt of statements) {
    if (seenReturn) {
      diagnostics.push({
        severity: 'warning',
        code: 'T_UNREACHABLE_AFTER_RETURN',
        message: 'Unreachable statement after RETURN.',
        span: stmt.span,
      });
    }
    const lowered = lowerStatement(stmt, diagnostics);
    if (lowered) {
      out.push(lowered.ir);
      if (lowered.ir.kind === 'IrReturnStatement') seenReturn = true;
    }
  }
  return out;
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
  const seen = new Set<string>();
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
    if (seen.has(pname)) {
      diagnostics.push({
        severity: 'error',
        code: 'T_PROC_DUP_PARAM',
        message: `Duplicate parameter name '${pname}' in ${kind} '${name.name}'.`,
        span: p.name.span,
      });
      return false;
    }
    seen.add(pname);
  }
  return true;
}

function containsReturn(statements: readonly IrStatement[]): boolean {
  for (const stmt of statements) {
    if (stmt.kind === 'IrReturnStatement') return true;
    if (stmt.kind === 'IrIfStatement') {
      if (containsReturn(stmt.consequent)) return true;
      for (const c of stmt.elseIfClauses) {
        if (containsReturn(c.consequent)) return true;
      }
      if (stmt.alternate && containsReturn(stmt.alternate)) return true;
    } else if (
      stmt.kind === 'IrWhileStatement' ||
      stmt.kind === 'IrRepeatStatement' ||
      stmt.kind === 'IrForStatement'
    ) {
      if (containsReturn(stmt.body)) return true;
    } else if (stmt.kind === 'IrCaseStatement') {
      for (const arm of stmt.arms) {
        if (containsReturn(arm.body)) return true;
      }
      if (stmt.otherwise && containsReturn(stmt.otherwise)) return true;
    }
  }
  return false;
}

function lowerStatement(
  stmt: Statement,
  diagnostics: TranslateDiagnostic[],
): { ir: IrStatement; span: Statement['span'] } | null {
  switch (stmt.kind) {
    case 'AssignmentStatement': {
      const target = lowerTarget(stmt.target, diagnostics);
      const value = lowerExpression(stmt.value, diagnostics);
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
      const target = lowerTarget(stmt.target, diagnostics);
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
        const lowered = lowerExpression(e, diagnostics);
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
      const condition = lowerExpression(stmt.condition, diagnostics);
      if (!condition) return null;
      const consequent = lowerBlock(stmt.consequent, diagnostics);
      const elseIfClauses: IrElseIfClause[] = [];
      for (const clause of stmt.elseIfClauses) {
        const c = lowerExpression(clause.condition, diagnostics);
        if (!c) return null;
        elseIfClauses.push({
          kind: 'IrElseIfClause',
          condition: c,
          consequent: lowerBlock(clause.consequent, diagnostics),
        });
      }
      const alternate =
        stmt.alternate === null ? null : lowerBlock(stmt.alternate, diagnostics);
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
      const discriminant = lowerExpression(stmt.discriminant, diagnostics);
      if (!discriminant) return null;
      const arms: IrCaseArm[] = [];
      for (const arm of stmt.arms) {
        let label: IrCaseLabel;
        if (arm.label.kind === 'Value') {
          const value = lowerExpression(arm.label.value, diagnostics);
          if (!value) return null;
          label = { kind: 'IrCaseValue', value };
        } else {
          const low = lowerExpression(arm.label.low, diagnostics);
          const high = lowerExpression(arm.label.high, diagnostics);
          if (!low || !high) return null;
          label = { kind: 'IrCaseRange', low, high };
        }
        arms.push({
          kind: 'IrCaseArm',
          label,
          body: lowerBlock(arm.body, diagnostics),
        });
      }
      const otherwise =
        stmt.otherwise === null ? null : lowerBlock(stmt.otherwise, diagnostics);
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
      const condition = lowerExpression(stmt.condition, diagnostics);
      if (!condition) return null;
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrWhileStatement' as const,
          condition,
          body: lowerBlock(stmt.body, diagnostics),
        }),
      };
    }
    case 'RepeatStatement': {
      const condition = lowerExpression(stmt.condition, diagnostics);
      if (!condition) return null;
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrRepeatStatement' as const,
          body: lowerBlock(stmt.body, diagnostics),
          condition,
        }),
      };
    }
    case 'ForStatement': {
      const start = lowerExpression(stmt.start, diagnostics);
      const end = lowerExpression(stmt.end, diagnostics);
      if (!start || !end) return null;
      let step: IrExpression | null = null;
      if (stmt.step) {
        step = lowerExpression(stmt.step, diagnostics);
        if (!step) return null;
      }
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrForStatement' as const,
          variable: stmt.variable,
          start,
          end,
          step,
          body: lowerBlock(stmt.body, diagnostics),
        }),
      };
    }
    case 'DeclareStatement':
      diagnostics.push({
        severity: 'error',
        code: 'T_UNSUPPORTED_DECLARE',
        message: 'Translator does not support DECLARE (yet).',
        span: stmt.span,
      });
      return null;
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
      const parameters = stmt.parameters.map((p) => ({
        kind: 'IrParameter' as const,
        name: p.name.name,
        typeName: p.typeName.name,
      }));
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrProcedureDeclaration' as const,
          name: stmt.name.name,
          parameters,
          body: lowerBlock(stmt.body, diagnostics),
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
      const parameters = stmt.parameters.map((p) => ({
        kind: 'IrParameter' as const,
        name: p.name.name,
        typeName: p.typeName.name,
      }));
      const body = lowerBlock(stmt.body, diagnostics);
      if (!containsReturn(body)) {
        diagnostics.push({
          severity: 'warning',
          code: 'T_FUNC_NO_RETURN',
          message: `FUNCTION '${stmt.name.name}' has no RETURN statement.`,
          span: stmt.span,
        });
      }
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrFunctionDeclaration' as const,
          name: stmt.name.name,
          parameters,
          returnType: stmt.returnType.name,
          body,
        }),
      };
    }
    case 'CallStatement': {
      const callee = stmt.callee.name;
      if (isPythonSyntaxKeyword(callee)) {
        diagnostics.push({
          severity: 'error',
          code: 'T_CALL_PY_KEYWORD',
          message: `CALL target '${callee}' is a Python keyword and cannot be translated to a Python call.`,
          span: stmt.callee.span,
        });
        return null;
      }
      const args: IrExpression[] = [];
      for (const arg of stmt.args) {
        const lowered = lowerExpression(arg, diagnostics);
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
      const value = lowerExpression(stmt.value, diagnostics);
      if (!value) return null;
      return {
        span: stmt.span,
        ir: withEmptyTrivia({
          kind: 'IrReturnStatement' as const,
          value,
        }),
      };
    }
    case 'OpenFileStatement':
    case 'ReadFileStatement':
    case 'WriteFileStatement':
    case 'CloseFileStatement':
      diagnostics.push({
        severity: 'error',
        code: 'T_UNSUPPORTED_FILE',
        message: 'Translator does not support file handling.',
        span: stmt.span,
      });
      return null;
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
  const paired: { stmt: IrStatement; span: Statement['span'] }[] = [];

  for (const stmt of program.body) {
    const lowered = lowerStatement(stmt, diagnostics);
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
      defined.add(stmt.name);
      continue;
    }
    if (stmt.kind === 'IrCallStatement' && !defined.has(stmt.callee)) {
      const declaredLater = paired.some(
        (p) =>
          (p.stmt.kind === 'IrProcedureDeclaration' ||
            p.stmt.kind === 'IrFunctionDeclaration') &&
          p.stmt.name === stmt.callee,
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
