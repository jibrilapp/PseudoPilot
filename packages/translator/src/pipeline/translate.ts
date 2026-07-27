import { parse as parseCambridge } from '@pseudopilot/language-core';
import { lowerCambridgeProgram } from '../cambridge/lower.js';
import { printCambridge } from '../cambridge/print.js';
import { parsePythonToIr } from '../python/parse.js';
import { printPython } from '../python/print.js';
import {
  mergeOptions,
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

/**
 * Cambridge pseudocode → Python (assign / I/O / expr / IF / WHILE / REPEAT subset).
 *
 * On parse errors, still lowers any recovered statements so callers get
 * partial `code` plus diagnostics (`ok: false`).
 */
export function translatePseudocodeToPython(
  source: string,
  options?: TranslateOptions,
): TranslateResult {
  const opts = mergeOptions(options);
  const parsed = parseCambridge(source);
  const diagnostics: TranslateResult['diagnostics'] = parsed.diagnostics.map(
    (d) => ({
      severity: d.severity,
      message: d.message,
      code: d.code,
      span: d.span,
    }),
  );

  const lowered = lowerCambridgeProgram(parsed.ast, source, opts.preserveTrivia);
  diagnostics.push(...lowered.diagnostics);

  const code = printPython(lowered.ir);
  return finalize(code, diagnostics);
}

/**
 * Python (assign / I/O / expr / IF / WHILE / REPEAT subset) → Cambridge pseudocode.
 */
export function translatePythonToPseudocode(
  source: string,
  options?: TranslateOptions,
): TranslateResult {
  const opts = mergeOptions(options);
  const { ir, diagnostics } = parsePythonToIr(source, opts.preserveTrivia);
  const code = printCambridge(ir, opts.assignmentArrow);
  return finalize(code, diagnostics);
}
