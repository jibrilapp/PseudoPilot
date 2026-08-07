import { describe, expect, it } from 'vitest';
import {
  CompilerService,
  DependencyGraph,
  IncrementalCompiler,
  PACKAGE_VERSION,
  hashSource,
  stagesFrom,
} from './index.js';

const URI = 'file:///a.pseudo';
const URI_B = 'file:///b.pseudo';

const SMALL = `
DECLARE Count : INTEGER
Count ← 1
OUTPUT Count
`;

function largeProgram(n: number): string {
  const lines: string[] = ['DECLARE I : INTEGER', 'I ← 0'];
  for (let i = 0; i < n; i += 1) {
    lines.push(`IF I < ${i} THEN`);
    lines.push(`  I ← I + 1`);
    lines.push(`ENDIF`);
  }
  lines.push('OUTPUT I');
  return lines.join('\n');
}

describe('compiler-service package', () => {
  it('exports a version', () => {
    expect(PACKAGE_VERSION).toBe('1.0.0-beta.0');
  });

  it('hashes sources stably', () => {
    expect(hashSource('ABC')).toBe(hashSource('ABC'));
    expect(hashSource('ABC')).not.toBe(hashSource('ABD'));
  });

  it('invalidates downstream stages', () => {
    expect(stagesFrom('check')).toEqual([
      'check',
      'language',
      'translate',
      'interpret',
    ]);
  });
});

describe('unchanged / warm compile', () => {
  it('cache-hits when recompiling unchanged document', () => {
    const c = new IncrementalCompiler();
    const cold = c.openDocument(URI, SMALL, 1);
    expect(cold.cacheHit).toBe(false);
    expect(cold.ranParse).toBe(true);
    expect(cold.ranCheck).toBe(true);

    const warm = c.compile(URI);
    expect(warm.cacheHit).toBe(true);
    expect(warm.ranParse).toBe(false);
    expect(warm.ranCheck).toBe(false);

    const again = c.updateDocument(URI, SMALL, 2);
    expect(again.cacheHit).toBe(true);
    expect(c.getDocument(URI)!.stats.parseRuns).toBe(1);
    expect(c.getDocument(URI)!.stats.checkRuns).toBe(1);
  });

  it('force recompile runs parse+check again', () => {
    const c = new IncrementalCompiler();
    c.openDocument(URI, SMALL, 1);
    const forced = c.compile(URI, { force: true });
    expect(forced.ranParse).toBe(true);
    expect(forced.ranCheck).toBe(true);
    expect(c.getDocument(URI)!.stats.parseRuns).toBe(2);
  });
});

describe('edits and invalidation', () => {
  it('recompiles after a single-line edit', () => {
    const c = new IncrementalCompiler();
    c.openDocument(URI, SMALL, 1);
    const edited = SMALL.replace('OUTPUT Count', 'OUTPUT Count + 1');
    const result = c.updateDocument(URI, edited, 2);
    expect(result.cacheHit).toBe(false);
    expect(result.ranParse).toBe(true);
    expect(c.getDocument(URI)!.stats.parseRuns).toBe(2);
  });

  it('handles rapid consecutive edits (only last content kept)', () => {
    const c = new IncrementalCompiler();
    c.openDocument(URI, 'OUTPUT 1\n', 1);
    for (let v = 2; v <= 50; v += 1) {
      c.updateDocument(URI, `OUTPUT ${v}\n`, v);
    }
    const doc = c.getDocument(URI)!;
    expect(doc.source).toBe('OUTPUT 50\n');
    expect(doc.version).toBe(50);
    expect(doc.stats.parseRuns).toBe(50);
  });

  it('invalidate clears stages without removing the document', () => {
    const c = new IncrementalCompiler();
    c.openDocument(URI, SMALL, 1);
    c.invalidate(URI, 'check', { dependents: false });
    const result = c.compile(URI);
    expect(result.ranParse).toBe(false);
    expect(result.ranCheck).toBe(true);
  });
});

describe('multiple documents', () => {
  it('isolates caches per URI', () => {
    const c = new IncrementalCompiler();
    c.openDocument(URI, SMALL, 1);
    c.openDocument(URI_B, 'OUTPUT 1\n', 1);
    const aRuns = c.getDocument(URI)!.stats.parseRuns;
    c.updateDocument(URI_B, 'OUTPUT 2\n', 2);
    expect(c.getDocument(URI)!.stats.parseRuns).toBe(aRuns);
    expect(c.getDocument(URI_B)!.stats.parseRuns).toBe(2);
  });

  it('closing a document does not clear others', () => {
    const c = new IncrementalCompiler();
    c.openDocument(URI, SMALL, 1);
    c.openDocument(URI_B, 'OUTPUT 1\n', 1);
    c.closeDocument(URI);
    expect(c.getDocument(URI)).toBeUndefined();
    expect(c.getDocument(URI_B)).toBeDefined();
    expect(c.compile(URI_B).cacheHit).toBe(true);
  });
});

describe('diagnostics and symbols cache', () => {
  it('updates diagnostics after edit introducing an error', () => {
    const c = new IncrementalCompiler();
    c.openDocument(URI, SMALL, 1);
    expect(c.getDiagnostics(URI).every((d) => !d.code.startsWith('C_'))).toBe(
      true,
    );
    c.updateDocument(URI, 'OUTPUT Undeclared\n', 2);
    expect(c.getDiagnostics(URI).some((d) => d.code.startsWith('C_'))).toBe(
      true,
    );
  });

  it('updates symbols after adding a DECLARE', () => {
    const c = new IncrementalCompiler();
    c.openDocument(URI, 'OUTPUT 1\n', 1);
    const before = c.getSymbols(URI).filter((s) => !s.builtin).length;
    c.updateDocument(URI, 'DECLARE X : INTEGER\nOUTPUT X\n', 2);
    const after = c.getSymbols(URI).filter((s) => !s.builtin);
    expect(after.length).toBeGreaterThan(before);
    expect(after.some((s) => s.name === 'X')).toBe(true);
  });
});

describe('dependency graph', () => {
  it('tracks dependents for future multi-file invalidation', () => {
    const g = new DependencyGraph();
    g.setDependencies(URI_B, [URI]);
    expect(g.getDependents(URI)).toContain(URI_B);
    expect(g.transitiveDependents(URI)).toEqual([URI_B]);

    const c = new IncrementalCompiler();
    c.openDocument(URI, SMALL, 1);
    c.openDocument(URI_B, 'OUTPUT 1\n', 1);
    c.dependencies.setDependencies(URI_B, [URI]);
    const bParse = c.getDocument(URI_B)!.stats.parseRuns;
    c.updateDocument(URI, SMALL + '\n// touch\n', 2);
    // Dependent marked dirty — next compile of B re-runs.
    const bResult = c.compile(URI_B);
    expect(bResult.cacheHit).toBe(false);
    expect(bResult.ranParse).toBe(true);
    expect(c.getDocument(URI_B)!.stats.parseRuns).toBeGreaterThan(bParse);
  });
});

describe('large documents', () => {
  it('compiles a large Cambridge-style program and warms cache', () => {
    const source = largeProgram(200);
    const c = new IncrementalCompiler();
    const cold = c.openDocument(URI, source, 1);
    expect(cold.cacheHit).toBe(false);
    expect(c.getDocument(URI)!.ast).not.toBeNull();
    const warm = c.compile(URI);
    expect(warm.cacheHit).toBe(true);
    expect(c.totalStats().parseRuns).toBe(1);
  });
});

describe('CompilerService façade', () => {
  it('exposes diagnostics / symbols / compile', () => {
    const cs = new CompilerService();
    cs.openDocument(URI, SMALL, 1);
    expect(cs.getSymbols(URI).some((s) => s.name === 'Count')).toBe(true);
    expect(cs.compile(URI).cacheHit).toBe(true);
    expect(cs.getAst(URI)).not.toBeNull();
  });

  it('returns null hover without feature provider', () => {
    const cs = new CompilerService();
    cs.openDocument(URI, SMALL, 1);
    expect(cs.getHover(URI, { line: 0, character: 8 })).toBeNull();
  });

  it('parses and checks DATE declarations', () => {
    const cs = new CompilerService();
    const source = `
DECLARE D : DATE
D ← 04/10/2003
OUTPUT YEAR(D)
`;
    cs.openDocument(URI, source, 1);
    expect(cs.getDiagnostics(URI).filter((d) => d.severity === 'error')).toEqual([]);
    expect(cs.getSymbols(URI).some((s) => s.name === 'D')).toBe(true);
    expect(cs.getAst(URI)).not.toBeNull();
  });
});
