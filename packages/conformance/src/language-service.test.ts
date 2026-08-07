import { describe, expect, it } from 'vitest';
import { LanguageService, createCompilerSession } from '@pseudopilot/language-service';
import { CORPUS } from './corpus/index.js';

const URI = 'file:///ls.pseudo';

describe('conformance / language-service', () => {
  it('opens corpus programs and lists symbols', () => {
    const ls = new LanguageService();
    for (const entry of CORPUS.filter((e) => e.expectClean !== false).slice(0, 10)) {
      ls.openDocument(URI, entry.source, 1);
      const syms = ls.documentSymbols(URI);
      expect(syms.length, entry.id).toBeGreaterThan(0);
      ls.closeDocument(URI);
    }
  });

  it('definition + references on a variable', () => {
    const source = `
DECLARE Count : INTEGER
Count ← 1
OUTPUT Count
`;
    const ls = new LanguageService();
    ls.openDocument(URI, source, 1);
    // Second "Count" occurrence (assignment target) — use line 2
    const def = ls.definition(URI, { line: 2, character: 0 });
    expect(def).not.toBeNull();
    const refs = ls.references(URI, { line: 1, character: 8 });
    expect(refs.length).toBeGreaterThanOrEqual(3);
  });

  it('completion includes builtins after expression context', () => {
    const source = `
DECLARE Value : INTEGER
Value ← 
`;
    const ls = new LanguageService();
    ls.openDocument(URI, source, 1);
    const items = ls.completion(URI, {
      line: 2,
      character: source.split('\n')[2]!.length,
    });
    expect(items.some((i) => i.label === 'LENGTH')).toBe(true);
    expect(items.some((i) => i.label === 'Value')).toBe(true);
  });

  it('rename validation rejects builtins', () => {
    const ls = new LanguageService();
    ls.openDocument(URI, 'OUTPUT LENGTH("a")\n', 1);
    expect(ls.prepareRename(URI, { line: 0, character: 7 }).ok).toBe(false);
  });

  it('session hover stays consistent with compiler diagnostics', () => {
    const { languageService, compilerService } = createCompilerSession();
    const src = 'DECLARE N : INTEGER\nOUTPUT N\n';
    compilerService.openDocument(URI, src, 1);
    expect(compilerService.getDiagnostics(URI).every((d) => !d.code.startsWith('C_'))).toBe(
      true,
    );
    const tip = languageService.hover(URI, { line: 1, character: 7 });
    expect(tip?.contents).toContain('VARIABLE');
  });
});
