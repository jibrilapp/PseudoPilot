import { describe, expect, it } from 'vitest';
import { parse } from '@pseudopilot/language-core';
import { check } from '@pseudopilot/checker';
import { translatePseudocodeToPython } from '@pseudopilot/translator';
import { createCompilerSession } from '@pseudopilot/language-service';
import { CORPUS } from './corpus/index.js';
import { runOk, translateBothWays } from './helpers.js';

/**
 * End-to-end: parse → check → (translate) → interpret → language service.
 */

describe('conformance / end-to-end', () => {
  it('pipeline: check → run → translate for flagship programs', async () => {
    const ids = [
      'assign-basic',
      'for-loop',
      'function',
      'recursion-fact',
      'file-io',
      'case-of',
    ];
    for (const id of ids) {
      const entry = CORPUS.find((e) => e.id === id)!;
      const parsed = parse(entry.source);
      expect(parsed.ok, id).toBe(true);
      const checked = check(parsed.ast);
      expect(checked.ok, id).toBe(true);
      const run = await runOk(entry.source, entry.inputs ?? []);
      expect(run.host.outputs, id).toEqual([...entry.expectOutput!]);
      const py = translatePseudocodeToPython(entry.source);
      expect(py.ok, id).toBe(true);
    }
  });

  it('round-trip then run matches original outputs', async () => {
    const entry = CORPUS.find((e) => e.id === 'for-loop')!;
    const { roundTrip } = translateBothWays(entry.source);
    const run = await runOk(roundTrip);
    expect(run.host.outputs).toEqual([...entry.expectOutput!]);
  });

  it('compiler session + run share consistent symbols', async () => {
    const entry = CORPUS.find((e) => e.id === 'procedure')!;
    const { languageService, compilerService } = createCompilerSession();
    const uri = 'file:///e2e.pseudo';
    compilerService.openDocument(uri, entry.source, 1);
    expect(
      compilerService.getSymbols(uri).some((s) => s.name === 'Greet'),
    ).toBe(true);
    const tip = languageService.hover(uri, { line: 1, character: 10 });
    expect(tip?.contents.toUpperCase()).toContain('PROCEDURE');
    const run = await runOk(entry.source);
    expect(run.host.outputs).toEqual(['hi']);
  });
});
