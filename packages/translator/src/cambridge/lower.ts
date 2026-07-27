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
  type IrElseIfClause,
  type IrExpression,
  type IrProgram,
  type IrStatement,
} from '../ir/nodes.js';
import { cambridgeBinaryToIr, cambridgeUnaryToIr } from '../rules/operators.js';
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
    case 'CallExpression':
      diagnostics.push({
        severity: 'error',
        code: 'T_UNSUPPORTED_CALL',
        message: `Translator does not support function calls (found '${expr.callee.name}').`,
        span: expr.span,
      });
      return null;
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

/** Lower a statement list; skip unsupported nodes (diagnostics already emitted). */
function lowerBlock(
  statements: Statement[],
  diagnostics: TranslateDiagnostic[],
): IrStatement[] {
  const out: IrStatement[] = [];
  for (const stmt of statements) {
    const lowered = lowerStatement(stmt, diagnostics);
    if (lowered) out.push(lowered.ir);
  }
  return out;
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
    case 'ProcedureDeclaration':
    case 'FunctionDeclaration':
      diagnostics.push({
        severity: 'error',
        code: 'T_UNSUPPORTED_ROUTINE',
        message: 'Translator does not support procedures/functions.',
        span: stmt.span,
      });
      return null;
    case 'CallStatement':
      diagnostics.push({
        severity: 'error',
        code: 'T_UNSUPPORTED_CALL',
        message: 'Translator does not support CALL statements.',
        span: stmt.span,
      });
      return null;
    case 'ReturnStatement':
      diagnostics.push({
        severity: 'error',
        code: 'T_UNSUPPORTED_RETURN',
        message: 'Translator does not support RETURN.',
        span: stmt.span,
      });
      return null;
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
