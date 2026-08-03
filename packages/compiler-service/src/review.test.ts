/**
 * Regression tests from the incremental-compilation engineering review.
 */

import { describe, expect, it } from 'vitest';
import {
  DependencyGraph,
  IncrementalCompiler,
  hashSource,
} from './index.js';

const URI = 'file:///review.pseudo';
const URI_B = 'file:///review-b.pseudo';

describe('P0: source equality beats hash fingerprint', () => {
  it('reparses when source text changes', () => {
    const c = new IncrementalCompiler();
    const a = 'OUTPUT 1\n';
    const b = 'OUTPUT 2\n';
    expect(hashSource(a)).not.toBe(hashSource(b));
    c.openDocument(URI, a, 1);
    const r = c.updateDocument(URI, b, 2);
    expect(r.cacheHit).toBe(false);
    expect(c.getDocument(URI)!.source).toBe(b);
  });

  it('never reuses AST across different source strings', () => {
    const c = new IncrementalCompiler();
    c.openDocument(URI, 'DECLARE A : INTEGER\nOUTPUT A\n', 1);
    const ast1 = c.getAst(URI);
    c.updateDocument(URI, 'DECLARE B : INTEGER\nOUTPUT B\n', 2);
    const ast2 = c.getAst(URI);
    expect(ast1).not.toBe(ast2);
    expect(c.getSymbols(URI).some((s) => s.name === 'B')).toBe(true);
    expect(c.getSymbols(URI).some((s) => s.name === 'A' && !s.builtin)).toBe(
      false,
    );
  });

  it('hash fingerprint includes length prefix', () => {
    expect(hashSource('x')).toMatch(/^\d+:[0-9a-f]{8}$/);
  });
});

describe('P0: parse-only must not leave stale diagnostics', () => {
  it('clears semantic outputs when parse is dirtied before check', () => {
    const c = new IncrementalCompiler();
    c.openDocument(URI, 'OUTPUT Undeclared\n', 1);
    expect(c.getDiagnostics(URI).some((d) => d.code.startsWith('C_'))).toBe(
      true,
    );

    c.invalidate(URI, 'parse', { dependents: false });
    const partial = c.compile(URI, { upTo: 'parse' });
    expect(partial.ranParse).toBe(true);
    const doc = c.getDocument(URI)!;
    expect(doc.stages.check).toBe(false);
    expect(doc.diagnostics).toEqual([]);
    expect(doc.symbols).toEqual([]);

    const full = c.compile(URI);
    expect(full.ranCheck).toBe(true);
    expect(c.getDiagnostics(URI).some((d) => d.code.startsWith('C_'))).toBe(
      true,
    );
  });
});

describe('P0: diagnostics match current version/source', () => {
  it('diagnostics update with content and report current version', () => {
    const c = new IncrementalCompiler();
    c.openDocument(URI, 'DECLARE X : INTEGER\nOUTPUT X\n', 1);
    expect(c.getDiagnostics(URI).every((d) => !d.code.startsWith('C_'))).toBe(
      true,
    );
    c.updateDocument(URI, 'OUTPUT Missing\n', 2);
    expect(c.getDiagnostics(URI).some((d) => d.code.startsWith('C_'))).toBe(
      true,
    );
    expect(c.getDocument(URI)!.version).toBe(2);
    expect(c.getDocument(URI)!.source).toBe('OUTPUT Missing\n');
  });
});

describe('P1: stale editor versions are ignored', () => {
  it('does not apply source from an older version', () => {
    const c = new IncrementalCompiler();
    c.openDocument(URI, 'OUTPUT 1\n', 5);
    const result = c.updateDocument(URI, 'OUTPUT 999\n', 3);
    expect(result.ignored).toBe(true);
    expect(c.getDocument(URI)!.version).toBe(5);
    expect(c.getDocument(URI)!.source).toBe('OUTPUT 1\n');
    expect(c.totalStats().parseRuns).toBe(1);
  });
});

describe('P1: closeDocument releases memory', () => {
  it('drops document and dependency edges', () => {
    const c = new IncrementalCompiler();
    c.openDocument(URI, 'OUTPUT 1\n', 1);
    c.openDocument(URI_B, 'OUTPUT 2\n', 1);
    c.dependencies.setDependencies(URI_B, [URI]);
    c.closeDocument(URI);
    expect(c.getDocument(URI)).toBeUndefined();
    expect(c.dependencies.getDependencies(URI_B)).toEqual([]);
    c.closeDocument(URI_B);
    expect(c.dependencies.isEmpty()).toBe(true);
    expect(c.totalStats().documents).toBe(0);
  });
});

describe('P1: caller cannot mutate cached diagnostic arrays', () => {
  it('getDiagnostics returns a copy', () => {
    const c = new IncrementalCompiler();
    c.openDocument(URI, 'OUTPUT Undeclared\n', 1);
    const a = c.getDiagnostics(URI);
    const before = a.length;
    (a as { code: string }[]).push({
      severity: 'error',
      code: 'FAKE',
      message: 'nope',
      span: a[0]!.span,
    } as never);
    expect(c.getDiagnostics(URI).length).toBe(before);
    expect(c.getDiagnostics(URI).some((d) => d.code === 'FAKE')).toBe(false);
  });
});

describe('P1: DependencyGraph does not leak removed nodes', () => {
  it('isEmpty after remove of linked pair', () => {
    const g = new DependencyGraph();
    g.setDependencies(URI_B, [URI]);
    g.remove(URI);
    g.remove(URI_B);
    expect(g.isEmpty()).toBe(true);
  });
});
