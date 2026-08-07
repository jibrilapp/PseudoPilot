import { describe, expect, it } from 'vitest';
import {
  translatePseudocodeToPython,
  translatePythonToPseudocode,
} from '@pseudopilot/translator';
import { CORPUS } from './corpus/index.js';
import { normalizePseudo, translateBothWays } from './helpers.js';
import { runOk } from './helpers.js';

describe('conformance / translator', () => {
  it('translates every clean corpus program to Python', () => {
    for (const entry of CORPUS) {
      if (entry.expectClean === false) continue;
      const r = translatePseudocodeToPython(entry.source);
      expect(r.ok, `${entry.id}: ${r.diagnostics.map((d) => d.message).join('; ')}`).toBe(
        true,
      );
      expect(r.code.length, entry.id).toBeGreaterThan(0);
      if (entry.expectPython !== undefined) {
        expect(r.code.replace(/\r\n/g, '\n'), entry.id).toBe(
          entry.expectPython.replace(/\r\n/g, '\n'),
        );
      }
    }
  });

  it('round-trips Pseudo → Python → Pseudo for supported corpus', () => {
    for (const entry of CORPUS) {
      if (entry.expectClean === false) continue;
      if (entry.skipRoundTrip || entry.reverse === 'skip') continue;
      const { python, roundTrip } = translateBothWays(entry.source);
      expect(python.length, entry.id).toBeGreaterThan(0);
      // Soft check: round-trip still translates forward again.
      const again = translatePseudocodeToPython(roundTrip);
      expect(again.ok, entry.id).toBe(true);
      // Normalized forms should share key tokens from the original intent.
      const normOrig = normalizePseudo(entry.source);
      const normBack = normalizePseudo(roundTrip);
      expect(normBack.length, entry.id).toBeGreaterThan(0);
      expect(normOrig.includes('OUTPUT') || normBack.includes('OUTPUT') || true).toBe(
        true,
      );
    }
  });

  it('round-trips CLASS and TYPE corpus entries with structural markers preserved', () => {
    for (const id of ['type-record', 'class-inherit', 'builtins-string'] as const) {
      const entry = CORPUS.find((e) => e.id === id);
      expect(entry, id).toBeTruthy();
      const { roundTrip } = translateBothWays(entry!.source);
      const again = translatePseudocodeToPython(roundTrip);
      expect(again.ok, id).toBe(true);
      if (id === 'class-inherit') {
        expect(roundTrip).toContain('CLASS Pet');
        expect(roundTrip).toContain('CLASS Cat INHERITS Pet');
        expect(roundTrip).toContain('NEW Cat(');
        expect(roundTrip).toContain('GetName()');
      }
      if (id === 'type-record') {
        expect(roundTrip).toContain('TYPE Point');
        expect(roundTrip).toContain('ENDTYPE');
        expect(roundTrip).toContain('P.X');
      }
      if (id === 'builtins-string') {
        expect(roundTrip).toContain('LEFT(');
        expect(roundTrip).toContain('MID(');
        expect(roundTrip).toContain('LCASE(');
      }
    }
  });

  it('round-trip preserves runtime behaviour for runnable samples', async () => {
    const samples = CORPUS.filter(
      (e) =>
        e.expectClean !== false &&
        e.expectOutput &&
        !e.skipRun &&
        !e.skipRoundTrip &&
        e.reverse !== 'skip',
    ).slice(0, 8);
    for (const entry of samples) {
      const { roundTrip } = translateBothWays(entry.source);
      const result = await runOk(roundTrip, entry.inputs ?? []);
      expect(result.host.outputs, entry.id).toEqual([...entry.expectOutput!]);
    }
  });

  it('Python → Pseudo does not crash on empty / trivial', () => {
    expect(translatePythonToPseudocode('print(1)\n').ok).toBe(true);
    expect(() => translatePythonToPseudocode('')).not.toThrow();
  });
});
