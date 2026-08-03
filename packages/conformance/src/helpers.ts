/**
 * Shared helpers for conformance tests.
 */

import { parse } from '@pseudopilot/language-core';
import { check } from '@pseudopilot/checker';
import {
  runPseudocode,
  MemoryHost,
  SeededRandom,
  type RunOptions,
  type RunResult,
} from '@pseudopilot/interpreter';
import {
  translatePseudocodeToPython,
  translatePythonToPseudocode,
} from '@pseudopilot/translator';

export function parseOk(source: string) {
  const r = parse(source);
  expectOk(r.ok, r.diagnostics.map((d) => d.message).join('; '));
  return r;
}

export function checkOk(source: string) {
  const parsed = parseOk(source);
  const c = check(parsed.ast);
  expectOk(c.ok, c.diagnostics.map((d) => `${d.code}: ${d.message}`).join('; '));
  return { parsed, check: c };
}

export async function runOk(
  source: string,
  inputs: readonly string[] = [],
  options: Omit<RunOptions, 'host'> = {},
): Promise<RunResult & { host: MemoryHost }> {
  const host = new MemoryHost(inputs);
  const result = await runPseudocode(source, {
    host,
    random: new SeededRandom(42),
    ...options,
  });
  expectOk(
    result.ok,
    result.diagnostics.map((d) => `${d.code}: ${d.message}`).join('; '),
  );
  return { ...result, host };
}

export function translateBothWays(source: string): {
  python: string;
  roundTrip: string;
} {
  const toPy = translatePseudocodeToPython(source);
  expectOk(
    toPy.ok,
    toPy.diagnostics.map((d) => d.message).join('; '),
  );
  const back = translatePythonToPseudocode(toPy.code);
  expectOk(
    back.ok,
    back.diagnostics.map((d) => d.message).join('; '),
  );
  return { python: toPy.code, roundTrip: back.code };
}

/** Normalize Cambridge text for soft equivalence checks. */
export function normalizePseudo(source: string): string {
  return source
    .replace(/\r\n/g, '\n')
    .replace(/<-/g, '←')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function expectOk(ok: boolean, detail: string): void {
  if (!ok) {
    throw new Error(`Expected success, got failure: ${detail}`);
  }
}
