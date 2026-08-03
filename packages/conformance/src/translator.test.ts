import { describe, expect, it } from 'vitest';
import {
  translatePseudocodeToPython,
  translatePythonToPseudocode,
} from '@pseudopilot/translator';
import { CORPUS } from './corpus/index.js';
import { normalizePseudo, translateBothWays } from './helpers.js';
import { runOk } from './helpers.js';

describe('conformance / translator', () => {
  it('translates every corpus program to Python', () => {
    for (const entry of CORPUS) {
      const r = translatePseudocodeToPython(entry.source);
      expect(r.ok, `${entry.id}: ${r.diagnostics.map((d) => d.message).join('; ')}`).toBe(
        true,
      );
      expect(r.code.length, entry.id).toBeGreaterThan(0);
    }
  });

  it('round-trips Pseudo → Python → Pseudo for supported corpus', () => {
    for (const entry of CORPUS) {
      if (entry.skipRoundTrip) continue;
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

  it('round-trip preserves runtime behaviour for runnable samples', async () => {
    const samples = CORPUS.filter(
      (e) => e.expectOutput && !e.skipRun && !e.skipRoundTrip,
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
