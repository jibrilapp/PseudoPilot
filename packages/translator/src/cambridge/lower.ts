import type {
  AssignTarget,
  Expression,
  Program,
  Statement,
} from '@pseudopilot/language-core';
import {
  emptyTrivia,
  withEmptyTrivia,
  type IrExpression,
  type IrIdentifier,
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
): IrIdentifier | null {
  if (target.kind === 'Identifier') {
    return { kind: 'IrIdentifier', name: target.name };
  }
  diagnostics.push({
    severity: 'error',
    code: 'T_UNSUPPORTED_INDEX',
    message: 'V1 translator does not support array indexing as an assignment target.',
    span: target.span,
  });
  return null;
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
    case 'BooleanLiteral':
      return { kind: 'IrBooleanLiteral', value: expr.value };
    case 'Identifier':
      return { kind: 'IrIdentifier', name: expr.name };
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
        message: `V1 translator does not support function calls (found '${expr.callee.name}').`,
        span: expr.span,
      });
      return null;
    case 'IndexExpression':
      diagnostics.push({
        severity: 'error',
        code: 'T_UNSUPPORTED_INDEX',
        message: 'V1 translator does not support array index expressions.',
        span: expr.span,
      });
      return null;
    case 'EofExpression':
      diagnostics.push({
        severity: 'error',
        code: 'T_UNSUPPORTED_EOF',
        message: 'V1 translator does not support EOF(...).',
        span: expr.span,
      });
      return null;
    default: {
      const _exhaustive: never = expr;
      return _exhaustive;
    }
  }
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
    case 'IfStatement':
      diagnostics.push({
        severity: 'error',
        code: 'T_UNSUPPORTED_IF',
        message: 'V1 translator does not support IF statements.',
        span: stmt.span,
      });
      return null;
    case 'DeclareStatement':
      diagnostics.push({
        severity: 'error',
        code: 'T_UNSUPPORTED_DECLARE',
        message: 'V1 translator does not support DECLARE (yet).',
        span: stmt.span,
      });
      return null;
    case 'ProcedureDeclaration':
    case 'FunctionDeclaration':
      diagnostics.push({
        severity: 'error',
        code: 'T_UNSUPPORTED_ROUTINE',
        message: 'V1 translator does not support procedures/functions.',
        span: stmt.span,
      });
      return null;
    case 'CallStatement':
      diagnostics.push({
        severity: 'error',
        code: 'T_UNSUPPORTED_CALL',
        message: 'V1 translator does not support CALL statements.',
        span: stmt.span,
      });
      return null;
    case 'ReturnStatement':
      diagnostics.push({
        severity: 'error',
        code: 'T_UNSUPPORTED_RETURN',
        message: 'V1 translator does not support RETURN.',
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
        message: 'V1 translator does not support file handling.',
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
 * Lower a Cambridge AST Program into IR (V1 subset).
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
