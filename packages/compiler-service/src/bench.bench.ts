/**
 * Simple performance measurements — cold vs warm vs edit.
 * Correctness is asserted via cacheHit / parseRuns (not wall-clock alone).
 * Timings are logged for local inspection.
 */

import { describe, expect, it } from 'vitest';
import { IncrementalCompiler, hashSource } from './index.js';

const URI = 'file:///bench.pseudo';

function largeProgram(n: number): string {
  const lines: string[] = [
    'DECLARE Total : INTEGER',
    'DECLARE I : INTEGER',
    'Total ← 0',
  ];
  for (let i = 0; i < n; i += 1) {
    lines.push(`FOR I ← 1 TO 10`);
    lines.push(`  Total ← Total + ${i}`);
    lines.push(`NEXT I`);
  }
  lines.push('OUTPUT Total');
  return lines.join('\n');
}

function timed<T>(fn: () => T): { result: T; ms: number } {
  const t0 = performance.now();
  const result = fn();
  return { result, ms: performance.now() - t0 };
}

describe('benchmarks: incremental compilation', () => {
  it('warm compile is a cache hit and does not re-parse (large program)', () => {
    const source = largeProgram(80);
    const c = new IncrementalCompiler();

    const cold = timed(() => c.openDocument(URI, source, 1));
    const warm = timed(() => c.compile(URI));
    const unchanged = timed(() => c.updateDocument(URI, source, 2));

    expect(cold.result.cacheHit).toBe(false);
    expect(warm.result.cacheHit).toBe(true);
    expect(unchanged.result.cacheHit).toBe(true);
    expect(c.totalStats().parseRuns).toBe(1);
    expect(c.totalStats().checkRuns).toBe(1);
    expect(c.totalStats().cacheHits).toBeGreaterThanOrEqual(2);

    console.log(
      JSON.stringify({
        scenario: 'large-warm',
        chars: source.length,
        hash: hashSource(source),
        coldMs: +cold.ms.toFixed(3),
        warmMs: +warm.ms.toFixed(3),
        unchangedMs: +unchanged.ms.toFixed(3),
        parseRuns: c.totalStats().parseRuns,
        checkRuns: c.totalStats().checkRuns,
        speedupWarm: +(cold.ms / Math.max(warm.ms, 0.001)).toFixed(1),
      }),
    );
  });

  it('single-line edit recompiles once; repeat compile hits cache', () => {
    const source = largeProgram(40);
    const c = new IncrementalCompiler();
    const cold = timed(() => c.openDocument(URI, source, 1));
    const edited = source.replace('OUTPUT Total', 'OUTPUT Total + 1');
    const edit = timed(() => c.updateDocument(URI, edited, 2));
    const after = timed(() => c.compile(URI));

    expect(edit.result.ranParse).toBe(true);
    expect(edit.result.ranCheck).toBe(true);
    expect(after.result.cacheHit).toBe(true);
    expect(c.totalStats().parseRuns).toBe(2);
    expect(c.totalStats().checkRuns).toBe(2);

    console.log(
      JSON.stringify({
        scenario: 'single-line-edit',
        coldMs: +cold.ms.toFixed(3),
        editMs: +edit.ms.toFixed(3),
        afterEditWarmMs: +after.ms.toFixed(3),
        parseRuns: c.totalStats().parseRuns,
      }),
    );
  });

  it('identical content across version bumps does not re-parse', () => {
    const source = largeProgram(30);
    const c = new IncrementalCompiler();
    c.openDocument(URI, source, 1);
    for (let v = 2; v <= 20; v += 1) {
      const r = c.updateDocument(URI, source, v);
      expect(r.cacheHit).toBe(true);
      expect(r.ignored).toBeUndefined();
    }
    expect(c.totalStats().parseRuns).toBe(1);
    expect(c.totalStats().cacheHits).toBeGreaterThanOrEqual(19);
  });
});
