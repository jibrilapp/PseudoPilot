/**
 * Cambridge Regression Suite — stage-by-stage verification against fixtures.
 *
 * Every corpus entry must satisfy its declared expectations for:
 *   lexer · parser · semantic checker · interpreter · translator · reverse · diagnostics
 *
 * A mismatch at any asserted stage fails the test.
 */

import { describe, expect, it } from 'vitest';
import { lex, parse } from '@pseudopilot/language-core';
import { check } from '@pseudopilot/checker';
import {
  translatePseudocodeToPython,
  translatePythonToPseudocode,
} from '@pseudopilot/translator';
import {
  CORPUS,
  CORPUS_CATEGORIES,
  cleanCorpus,
  corpusStats,
  diagnosticCorpus,
} from './corpus/index.js';
import { normalizePseudo, runOk } from './helpers.js';

function codesOf(
  diagnostics: readonly { code: string; severity: string }[],
): string[] {
  return diagnostics.map((d) => d.code);
}

describe('Cambridge Regression Suite', () => {
  it('loads a non-empty corpus across all declared categories', () => {
    const stats = corpusStats(CORPUS);
    expect(stats.total).toBeGreaterThan(40);
    for (const cat of CORPUS_CATEGORIES) {
      expect(stats.byCategory[cat], `category ${cat} should have entries`).toBeGreaterThan(
        0,
      );
    }
  });

  it('has unique ids', () => {
    const ids = CORPUS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe('clean programs (full pipeline)', () => {
    for (const entry of cleanCorpus()) {
      it(`${entry.category}/${entry.id}: lex → parse → check → run → translate → reverse`, async () => {
        // Lexer
        const { tokens, diagnostics: lexDiags } = lex(entry.source);
        expect(
          lexDiags.filter((d) => d.severity === 'error'),
          `${entry.id} lexer errors`,
        ).toEqual([]);
        expect(tokens.length, entry.id).toBeGreaterThan(0);

        // Parser
        const parsed = parse(entry.source);
        expect(parsed.ok, `${entry.id} parse: ${codesOf(parsed.diagnostics).join(',')}`).toBe(
          true,
        );
        expect(parsed.ast.kind).toBe('Program');

        // Semantic checker
        const checked = check(parsed.ast);
        expect(
          checked.ok,
          `${entry.id} check: ${checked.diagnostics.map((d) => `${d.code}: ${d.message}`).join('; ')}`,
        ).toBe(true);
        if (entry.expectDiagnostics && entry.expectDiagnostics.length > 0) {
          for (const exp of entry.expectDiagnostics) {
            expect(
              checked.diagnostics.some((d) => d.code === exp.code),
              `${entry.id} missing diagnostic ${exp.code}`,
            ).toBe(true);
          }
        }

        // Interpreter
        if (!entry.skipRun && entry.expectOutput) {
          const result = await runOk(entry.source, entry.inputs ?? []);
          expect(result.host.outputs, entry.id).toEqual([...entry.expectOutput]);
        }

        // Translator (Python)
        const py = translatePseudocodeToPython(entry.source);
        expect(
          py.ok,
          `${entry.id} translate: ${py.diagnostics.map((d) => d.message).join('; ')}`,
        ).toBe(true);
        expect(py.code.length, entry.id).toBeGreaterThan(0);
        if (entry.expectPython !== undefined) {
          expect(py.code.replace(/\r\n/g, '\n'), `${entry.id} expect.python`).toBe(
            entry.expectPython.replace(/\r\n/g, '\n'),
          );
        }

        // Reverse translator
        const reverseMode = entry.reverse ?? (entry.skipRoundTrip ? 'skip' : 'check');
        if (reverseMode === 'skip') {
          expect(
            entry.reverseSkipReason,
            `${entry.id} reverse:skip requires reverseSkipReason`,
          ).toBeTruthy();
        } else {
          const back = translatePythonToPseudocode(py.code);
          expect(
            back.ok,
            `${entry.id} reverse: ${back.diagnostics.map((d) => d.message).join('; ')}`,
          ).toBe(true);
          if (entry.expectReverse !== undefined) {
            expect(normalizePseudo(back.code), `${entry.id} expect.reverse.pp`).toBe(
              normalizePseudo(entry.expectReverse),
            );
          }
          if (!entry.skipRun && entry.expectOutput) {
            const round = await runOk(back.code, entry.inputs ?? []);
            expect(round.host.outputs, `${entry.id} reverse-run`).toEqual([
              ...entry.expectOutput,
            ]);
          }
        }
      });
    }
  });

  describe('diagnostic fixtures (expected failures)', () => {
    for (const entry of diagnosticCorpus()) {
      it(`${entry.category}/${entry.id}: expected diagnostics`, () => {
        const { diagnostics: lexDiags } = lex(entry.source);
        // Must not throw; may or may not have lexer errors.
        expect(Array.isArray(lexDiags)).toBe(true);

        const parsed = parse(entry.source);
        const checked = check(parsed.ast);
        const all = [
          ...lexDiags,
          ...parsed.diagnostics,
          ...checked.diagnostics,
        ];

        expect(
          entry.expectDiagnostics && entry.expectDiagnostics.length > 0,
          `${entry.id} diagnostic fixtures need expectDiagnostics`,
        ).toBe(true);

        for (const exp of entry.expectDiagnostics!) {
          const hit = all.find((d) => d.code === exp.code);
          expect(hit, `${entry.id} expected code ${exp.code} in ${codesOf(all)}`).toBeTruthy();
          if (exp.severity && hit) {
            expect(hit.severity, entry.id).toBe(exp.severity);
          }
        }

        // Clean programs are false → must not claim overall success for check when
        // we expect checker errors (parse-only failures may leave check empty).
        const expectsCheckerError = entry.expectDiagnostics!.some((d) =>
          d.code.startsWith('C_'),
        );
        if (expectsCheckerError) {
          expect(checked.ok, entry.id).toBe(false);
        }
        const expectsParseError = entry.expectDiagnostics!.some((d) =>
          d.code.startsWith('E_'),
        );
        if (expectsParseError) {
          expect(parsed.ok, entry.id).toBe(false);
        }
      });
    }
  });
});
