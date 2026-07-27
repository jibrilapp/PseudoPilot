import { check as checkCambridge } from '@pseudopilot/checker';
import { parse as parseCambridge } from '@pseudopilot/language-core';
import { lowerCambridgeProgram } from '../cambridge/lower.js';
import { printCambridge } from '../cambridge/print.js';
import { parsePythonToIr } from '../python/parse.js';
import { printPython } from '../python/print.js';
import {
  mergeOptions,
  sourceTooLargeDiagnostic,
  type TranslateOptions,
  type TranslateResult,
} from '../types.js';

function finalize(
  code: string,
  diagnostics: TranslateResult['diagnostics'],
): TranslateResult {
  const ok = !diagnostics.some((d) => d.severity === 'error');
  return { ok, code, diagnostics };
}

function rejectIfTooLarge(
  source: string,
  maxSourceChars: number,
): TranslateResult | null {
  if (source.length <= maxSourceChars) return null;
  return finalize('', [sourceTooLargeDiagnostic(source.length, maxSourceChars)]);
}

/**
 * Cambridge pseudocode → Python.
 *
 * Pipeline: parse → semantic check → lower IR → print Python.
 * On errors, still lowers recovered statements so callers get partial `code`
 * plus diagnostics (`ok: false`).
 *
 * @experimental Stable enough for IDE use in 0.x; API may change before 1.0.
 */
export function translatePseudocodeToPython(
  source: string,
  options?: TranslateOptions,
): TranslateResult {
  const opts = mergeOptions(options);
  const oversized = rejectIfTooLarge(source, opts.maxSourceChars);
  if (oversized) return oversized;

  const parsed = parseCambridge(source, {
    maxSourceChars: opts.maxSourceChars,
  });
  const diagnostics: TranslateResult['diagnostics'] = parsed.diagnostics.map(
    (d) => ({
      severity: d.severity,
      message: d.message,
      code: d.code,
      span: d.span,
    }),
  );

  if (opts.semanticCheck) {
    const checked = checkCambridge(parsed.ast);
    for (const d of checked.diagnostics) {
      if (d.help !== undefined) {
        diagnostics.push({
          severity: d.severity,
          message: d.message,
          code: d.code,
          span: d.span,
          help: d.help,
        });
      } else {
        diagnostics.push({
          severity: d.severity,
          message: d.message,
          code: d.code,
          span: d.span,
        });
      }
    }
  }

  const lowered = lowerCambridgeProgram(parsed.ast, source, opts.preserveTrivia);
  diagnostics.push(...lowered.diagnostics);

  const code = printPython(lowered.ir);
  return finalize(code, diagnostics);
}

/**
 * Python subset → Cambridge pseudocode.
 *
 * @experimental Stable enough for tooling in 0.x; API may change before 1.0.
 */
export function translatePythonToPseudocode(
  source: string,
  options?: TranslateOptions,
): TranslateResult {
  const opts = mergeOptions(options);
  const oversized = rejectIfTooLarge(source, opts.maxSourceChars);
  if (oversized) return oversized;

  const { ir, diagnostics } = parsePythonToIr(source, opts.preserveTrivia);
  const code = printCambridge(ir, opts.assignmentArrow);
  return finalize(code, diagnostics);
}
