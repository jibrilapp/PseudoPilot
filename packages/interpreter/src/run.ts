import { check, type CheckResult, type CheckerDiagnostic } from '@pseudopilot/checker';
import { parse, type ParseResult, type Diagnostic } from '@pseudopilot/language-core';
import { Interpreter, type InterpretOptions, type InterpretResult } from './interpreter.js';
import type { RuntimeDiagnostic } from './value.js';

export type RunOptions = {
  readonly host: InterpretOptions['host'];
  readonly random?: InterpretOptions['random'];
  readonly maxCallDepth?: number;
  readonly maxSteps?: number;
  readonly debugger?: InterpretOptions['debugger'];
  /**
   * Run semantic checker before execute (default true).
   * Set false only for experiments; production should keep true.
   */
  readonly semanticCheck?: boolean;
};

export type RunResult = InterpretResult & {
  readonly parseDiagnostics: readonly Diagnostic[];
  readonly checkDiagnostics: readonly CheckerDiagnostic[];
};

/**
 * Full pipeline: parse → (check) → interpret AST.
 * Does not translate to Python.
 */
export function runPseudocode(source: string, options: RunOptions): RunResult {
  const parsed: ParseResult = parse(source);
  if (!parsed.ok) {
    return {
      ok: false,
      diagnostics: parsed.diagnostics.map(parseDiagToRuntime),
      steps: 0,
      callStack: [],
      globals: [],
      parseDiagnostics: parsed.diagnostics,
      checkDiagnostics: [],
    };
  }

  let checkDiagnostics: CheckerDiagnostic[] = [];
  if (options.semanticCheck !== false) {
    const checked: CheckResult = check(parsed.ast);
    checkDiagnostics = checked.diagnostics;
    if (!checked.ok) {
      return {
        ok: false,
        diagnostics: checked.diagnostics.map(checkDiagToRuntime),
        steps: 0,
        callStack: [],
        globals: [],
        parseDiagnostics: parsed.diagnostics,
        checkDiagnostics,
      };
    }
  }

  const interpreter = new Interpreter({
    host: options.host,
    ...(options.random !== undefined ? { random: options.random } : {}),
    ...(options.maxCallDepth !== undefined
      ? { maxCallDepth: options.maxCallDepth }
      : {}),
    ...(options.maxSteps !== undefined ? { maxSteps: options.maxSteps } : {}),
    ...(options.debugger !== undefined ? { debugger: options.debugger } : {}),
  });
  const result = interpreter.interpret(parsed.ast);
  return {
    ...result,
    parseDiagnostics: parsed.diagnostics,
    checkDiagnostics,
  };
}

function parseDiagToRuntime(d: Diagnostic): RuntimeDiagnostic {
  const out: RuntimeDiagnostic = {
    severity: d.severity === 'warning' ? 'warning' : 'error',
    code: d.code,
    message: d.message,
    span: d.span,
  };
  return out;
}

function checkDiagToRuntime(d: CheckerDiagnostic): RuntimeDiagnostic {
  const out: RuntimeDiagnostic = {
    severity: d.severity,
    code: d.code,
    message: d.message,
    span: d.span,
  };
  if (d.help !== undefined) {
    return { ...out, help: d.help };
  }
  return out;
}
