import { describe, expect, it } from 'vitest';
import { IncrementalCompiler, CompilerService } from '@pseudopilot/compiler-service';
import { createCompilerSession } from '@pseudopilot/language-service';
import { CORPUS } from './corpus/index.js';

const URI = 'file:///conformance.pseudo';
const URI_B = 'file:///conformance-b.pseudo';

describe('conformance / compiler-service', () => {
  it('warm cache across corpus programs (sequential open/close)', () => {
    const c = new IncrementalCompiler();
    for (const entry of CORPUS.filter((e) => e.expectClean !== false)) {
      c.openDocument(URI, entry.source, 1);
      expect(c.compile(URI).cacheHit).toBe(true);
      c.closeDocument(URI);
    }
    expect(c.totalStats().documents).toBe(0);
  });

  it('rapid consecutive edits keep last content', () => {
    const c = new IncrementalCompiler();
    c.openDocument(URI, 'OUTPUT 0\n', 1);
    for (let v = 2; v <= 100; v += 1) {
      c.updateDocument(URI, `OUTPUT ${v}\n`, v);
    }
    expect(c.getDocument(URI)!.source).toBe('OUTPUT 100\n');
    expect(c.getDocument(URI)!.version).toBe(100);
    expect(c.compile(URI).cacheHit).toBe(true);
  });

  it('isolates multiple documents', () => {
    const c = new IncrementalCompiler();
    c.openDocument(URI, CORPUS[0]!.source, 1);
    c.openDocument(URI_B, CORPUS[1]!.source, 1);
    const aRuns = c.getDocument(URI)!.stats.parseRuns;
    c.updateDocument(URI_B, CORPUS[2]!.source, 2);
    expect(c.getDocument(URI)!.stats.parseRuns).toBe(aRuns);
  });

  it('invalidation forces recheck without dropping the document', () => {
    const c = new IncrementalCompiler();
    c.openDocument(URI, 'DECLARE X : INTEGER\nOUTPUT X\n', 1);
    c.invalidate(URI, 'check', { dependents: false });
    const r = c.compile(URI);
    expect(r.ranCheck).toBe(true);
    expect(c.hasDocument(URI)).toBe(true);
  });

  it('language-service reuses shared compiler cache', () => {
    const { compiler, languageService, compilerService } =
      createCompilerSession();
    const src = CORPUS.find((e) => e.id === 'function')!.source;
    languageService.openDocument(URI, src, 1);
    expect(compilerService.compile(URI).cacheHit).toBe(true);
    expect(compiler.totalStats().parseRuns).toBe(1);
    const tip = languageService.hover(URI, { line: 0, character: 9 });
    expect(tip?.contents.toUpperCase()).toMatch(/FUNCTION|PROCEDURE|VARIABLE|PARAMETER/);
  });

  it('CompilerService façade exposes diagnostics for bad programs', () => {
    const cs = new CompilerService();
    cs.openDocument(URI, 'OUTPUT Undeclared\n', 1);
    expect(cs.getDiagnostics(URI).some((d) => d.code.startsWith('C_'))).toBe(
      true,
    );
  });
});
