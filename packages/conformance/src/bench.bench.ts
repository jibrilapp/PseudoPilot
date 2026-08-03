/**
 * Conformance performance samples — assert termination + cache correctness;
 * log timings for local inspection.
 */

import { describe, expect, it } from 'vitest';
import { parse } from '@pseudopilot/language-core';
import { check } from '@pseudopilot/checker';
import { translatePseudocodeToPython } from '@pseudopilot/translator';
import { runPseudocode, MemoryHost, SeededRandom } from '@pseudopilot/interpreter';
import { IncrementalCompiler } from '@pseudopilot/compiler-service';

function largeProgram(loops: number): string {
  const lines = [
    'DECLARE Total : INTEGER',
    'DECLARE I : INTEGER',
    'Total ← 0',
  ];
  for (let i = 0; i < loops; i += 1) {
    lines.push(`FOR I ← 1 TO 10`);
    lines.push(`  Total ← Total + 1`);
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

async function timedAsync<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t0 = performance.now();
  const result = await fn();
  return { result, ms: performance.now() - t0 };
}

describe('conformance / benchmarks', () => {
  it('large file parse + check + translate', () => {
    const source = largeProgram(60);
    const p = timed(() => parse(source));
    const c = timed(() => check(p.result.ast));
    const t = timed(() => translatePseudocodeToPython(source));
    expect(p.result.ok).toBe(true);
    expect(c.result.ok).toBe(true);
    expect(t.result.ok).toBe(true);
    console.log(
      JSON.stringify({
        scenario: 'large-parse-check-translate',
        chars: source.length,
        parseMs: +p.ms.toFixed(3),
        checkMs: +c.ms.toFixed(3),
        translateMs: +t.ms.toFixed(3),
      }),
    );
  });

  it('interpreter executes large nested work under step budget', async () => {
    const source = largeProgram(40);
    const run = await timedAsync(() =>
      runPseudocode(source, {
        host: new MemoryHost(),
        random: new SeededRandom(1),
        maxSteps: 5_000_000,
      }),
    );
    expect(run.result.ok).toBe(true);
    console.log(
      JSON.stringify({
        scenario: 'large-interpret',
        ms: +run.ms.toFixed(3),
        steps: run.result.steps,
      }),
    );
  });

  it('cold vs warm compiler cache', () => {
    const source = largeProgram(50);
    const c = new IncrementalCompiler();
    const cold = timed(() => c.openDocument('file:///b.pseudo', source, 1));
    const warm = timed(() => c.compile('file:///b.pseudo'));
    expect(cold.result.cacheHit).toBe(false);
    expect(warm.result.cacheHit).toBe(true);
    expect(c.totalStats().parseRuns).toBe(1);
    console.log(
      JSON.stringify({
        scenario: 'compiler-cold-warm',
        coldMs: +cold.ms.toFixed(3),
        warmMs: +warm.ms.toFixed(3),
        speedup: +(cold.ms / Math.max(warm.ms, 0.001)).toFixed(1),
      }),
    );
  });
});
