import { describe, expect, it } from 'vitest';
import { parse } from '@pseudopilot/language-core';
import { check } from '@pseudopilot/checker';
import { IncrementalCompiler, hashSource } from '@pseudopilot/compiler-service';
import { createCompilerSession } from '@pseudopilot/language-service';
import { runPseudocode, MemoryHost } from '@pseudopilot/interpreter';

/**
 * Permanent regression tests for bugs fixed in prior milestones.
 */

describe('conformance / regression', () => {
  it('CONSTANT uses = not ← (parser)', () => {
    expect(parse('CONSTANT Max ← 10\n').ok).toBe(false);
    expect(parse('CONSTANT Max = 10\n').ok).toBe(true);
  });

  it('assign to CONSTANT is a checker error', () => {
    const r = check(
      parse(`
CONSTANT Max = 1
Max ← 2
`).ast,
    );
    expect(r.diagnostics.some((d) => d.code === 'C_ASSIGN_TO_CONSTANT')).toBe(
      true,
    );
  });

  it('compiler: source equality prevents wrong reuse (hash is fingerprint only)', () => {
    const c = new IncrementalCompiler();
    const a = 'OUTPUT 1\n';
    const b = 'OUTPUT 2\n';
    expect(hashSource(a)).not.toBe(hashSource(b));
    c.openDocument('file:///r.pseudo', a, 1);
    c.updateDocument('file:///r.pseudo', b, 2);
    expect(c.getDocument('file:///r.pseudo')!.source).toBe(b);
  });

  it('compiler: stale version ignored', () => {
    const c = new IncrementalCompiler();
    c.openDocument('file:///r.pseudo', 'OUTPUT 1\n', 5);
    const r = c.updateDocument('file:///r.pseudo', 'OUTPUT 9\n', 2);
    expect(r.ignored).toBe(true);
    expect(c.getDocument('file:///r.pseudo')!.source).toBe('OUTPUT 1\n');
  });

  it('compiler: parse-only does not leave stale diagnostics', () => {
    const c = new IncrementalCompiler();
    c.openDocument('file:///r.pseudo', 'OUTPUT Undeclared\n', 1);
    c.invalidate('file:///r.pseudo', 'parse', { dependents: false });
    c.compile('file:///r.pseudo', { upTo: 'parse' });
    expect(c.getDocument('file:///r.pseudo')!.diagnostics).toEqual([]);
    c.compile('file:///r.pseudo');
    expect(
      c.getDiagnostics('file:///r.pseudo').some((d) => d.code.startsWith('C_')),
    ).toBe(true);
  });

  it('language service: CS close drops analysis shells', () => {
    const { compilerService, languageService } = createCompilerSession();
    const uri = 'file:///r.pseudo';
    compilerService.openDocument(uri, 'DECLARE N : INTEGER\nOUTPUT N\n', 1);
    expect(languageService.hasAnalysis(uri)).toBe(true);
    compilerService.closeDocument(uri);
    expect(languageService.hasAnalysis(uri)).toBe(false);
  });

  it('interpreter: R_STEP_LIMIT and R_CANCELLED codes remain stable', async () => {
    const host = new MemoryHost();
    const limited = await runPseudocode(
      'DECLARE I : INTEGER\nI ← 0\nWHILE TRUE\n  I ← I + 1\nENDWHILE\n',
      { host, maxSteps: 50 },
    );
    expect(limited.diagnostics.some((d) => d.code === 'R_STEP_LIMIT')).toBe(
      true,
    );

    const ac = new AbortController();
    ac.abort();
    const cancelled = await runPseudocode('OUTPUT 1\n', {
      host: new MemoryHost(),
      signal: ac.signal,
    });
    expect(cancelled.diagnostics.some((d) => d.code === 'R_CANCELLED')).toBe(
      true,
    );
  });

  it('identifier classification ignores N inside INTEGER', () => {
    const { languageService } = createCompilerSession();
    const uri = 'file:///r.pseudo';
    const source = 'DECLARE N : INTEGER\nOUTPUT N\n';
    languageService.openDocument(uri, source, 1);
    // Character of second whole-word N (OUTPUT N)
    const tip = languageService.classifyAt(uri, { line: 1, character: 7 });
    expect(tip?.kind).toBe('variable');
  });
});
