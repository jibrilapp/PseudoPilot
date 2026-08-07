/**
 * Comprehensive stability & stress suite.
 *
 * Asserts termination / correctness where feasible; logs timings + heap for
 * docs/PERFORMANCE_AND_STABILITY.md. Run via:
 *   pnpm --filter @pseudopilot/conformance exec vitest run src/stress.bench.ts
 */

import { afterAll, describe, expect, it } from 'vitest';
import { parse } from '@pseudopilot/language-core';
import { check } from '@pseudopilot/checker';
import {
  translatePseudocodeToPython,
  translatePythonToPseudocode,
} from '@pseudopilot/translator';
import {
  runPseudocode,
  MemoryHost,
  SeededRandom,
  type DebuggerHooks,
} from '@pseudopilot/interpreter';
import { IncrementalCompiler } from '@pseudopilot/compiler-service';
import {
  cycleSample,
  deepIfNesting,
  largeArrayProgram,
  longIdentifiers,
  manyAssignments,
  manyDeclarations,
  manyFileOps,
  manyProcedures,
  massiveClass,
  massiveType,
  nestedLoops,
  recursiveSum,
  triangular,
} from './stressGenerators.js';

type Row = {
  readonly area: string;
  readonly scenario: string;
  readonly pass: boolean;
  readonly ms: number;
  readonly size?: string;
  readonly detail?: string;
  readonly heapDeltaMb?: number;
};

const RESULTS: Row[] = [];

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

function heapMb(): number {
  return process.memoryUsage().heapUsed / (1024 * 1024);
}

function record(row: Row): void {
  RESULTS.push(row);
  console.log(JSON.stringify({ kind: 'stress-row', ...row }));
}

function linesOf(source: string): number {
  return source.split('\n').length;
}

describe('stress / compiler', () => {
  it(
    'parse+check 5000+ assignment lines',
    () => {
      const source = manyAssignments(5000);
      const p = timed(() => parse(source));
      const c = timed(() => check(p.result.ast));
      const pass = p.result.ok && c.result.ok;
      expect(pass).toBe(true);
      record({
        area: 'compiler',
        scenario: 'parse+check 5000 assignments',
        pass,
        ms: +(p.ms + c.ms).toFixed(3),
        size: `${linesOf(source)} lines / ${source.length} chars`,
        detail: `parse=${p.ms.toFixed(1)}ms check=${c.ms.toFixed(1)}ms`,
      });
    },
    120_000,
  );

  it(
    'deep IF nesting (depth 200)',
    () => {
      const source = deepIfNesting(200);
      const p = timed(() => parse(source));
      const c = timed(() => check(p.result.ast));
      const pass = p.result.ok && c.result.ok;
      expect(pass).toBe(true);
      record({
        area: 'compiler',
        scenario: 'deep IF nesting depth=200',
        pass,
        ms: +(p.ms + c.ms).toFixed(3),
        size: `${linesOf(source)} lines`,
        detail: `parse=${p.ms.toFixed(1)}ms check=${c.ms.toFixed(1)}ms`,
      });
    },
    60_000,
  );

  it(
    '2000 declarations',
    () => {
      const source = manyDeclarations(2000);
      const p = timed(() => parse(source));
      const c = timed(() => check(p.result.ast));
      const pass = p.result.ok && c.result.ok;
      expect(pass).toBe(true);
      record({
        area: 'compiler',
        scenario: '2000 DECLARE statements',
        pass,
        ms: +(p.ms + c.ms).toFixed(3),
        size: `${linesOf(source)} lines / ${source.length} chars`,
        detail: `parse=${p.ms.toFixed(1)}ms check=${c.ms.toFixed(1)}ms`,
      });
    },
    60_000,
  );

  it(
    'very long identifiers (len=2000)',
    () => {
      const source = longIdentifiers(2000, 5);
      const p = timed(() => parse(source));
      const c = timed(() => check(p.result.ast));
      const pass = p.result.ok && c.result.ok;
      expect(pass).toBe(true);
      record({
        area: 'compiler',
        scenario: 'identifiers length=2000 ×5',
        pass,
        ms: +(p.ms + c.ms).toFixed(3),
        size: `${source.length} chars`,
      });
    },
    30_000,
  );

  it(
    'large array declare ARRAY[1:5000]',
    () => {
      const source = largeArrayProgram(5000);
      const p = timed(() => parse(source));
      const c = timed(() => check(p.result.ast));
      const pass = p.result.ok && c.result.ok;
      expect(pass).toBe(true);
      record({
        area: 'compiler',
        scenario: 'ARRAY[1:5000] parse+check',
        pass,
        ms: +(p.ms + c.ms).toFixed(3),
        size: `${source.length} chars`,
      });
    },
    30_000,
  );

  it(
    'massive TYPE (200 fields)',
    () => {
      const source = massiveType(200);
      const p = timed(() => parse(source));
      const c = timed(() => check(p.result.ast));
      const pass = p.result.ok && c.result.ok;
      expect(pass).toBe(true);
      record({
        area: 'compiler',
        scenario: 'TYPE with 200 fields',
        pass,
        ms: +(p.ms + c.ms).toFixed(3),
        size: `${linesOf(source)} lines`,
      });
    },
    30_000,
  );

  it(
    'massive CLASS (100 methods)',
    () => {
      const source = massiveClass(100);
      const p = timed(() => parse(source));
      const c = timed(() => check(p.result.ast));
      const pass = p.result.ok && c.result.ok;
      expect(pass).toBe(true);
      record({
        area: 'compiler',
        scenario: 'CLASS with 100 methods',
        pass,
        ms: +(p.ms + c.ms).toFixed(3),
        size: `${linesOf(source)} lines`,
      });
    },
    60_000,
  );

  it(
    '500 procedures symbol table',
    () => {
      const source = manyProcedures(500);
      const p = timed(() => parse(source));
      const c = timed(() => check(p.result.ast));
      const pass = p.result.ok && c.result.ok;
      expect(pass).toBe(true);
      record({
        area: 'compiler',
        scenario: '500 PROCEDURE declarations',
        pass,
        ms: +(p.ms + c.ms).toFixed(3),
        size: `${linesOf(source)} lines`,
      });
    },
    60_000,
  );

  it(
    'file-ops program parse+check (200 writes)',
    () => {
      const source = manyFileOps(200);
      const p = timed(() => parse(source));
      const c = timed(() => check(p.result.ast));
      const pass = p.result.ok && c.result.ok;
      expect(pass).toBe(true);
      record({
        area: 'compiler',
        scenario: 'file ops 200 WRITEFILE lines',
        pass,
        ms: +(p.ms + c.ms).toFixed(3),
        size: `${linesOf(source)} lines`,
      });
    },
    30_000,
  );

  it(
    'pathological IF nesting beyond limit returns diagnostic (no throw)',
    () => {
      // Compact (no indent) so we hit nesting limit before char budget.
      const depth = 600;
      const lines = ['DECLARE N : INTEGER', 'N ← 1'];
      for (let i = 0; i < depth; i += 1) lines.push('IF N > 0 THEN');
      lines.push('N ← N + 1');
      for (let i = 0; i < depth; i += 1) lines.push('ENDIF');
      lines.push('OUTPUT N');
      const source = lines.join('\n');
      let threw = false;
      let parseOk = false;
      let code = '';
      const run = timed(() => {
        try {
          const p = parse(source);
          parseOk = p.ok;
          const t = translatePseudocodeToPython(source, {
            maxSourceChars: 2_000_000,
          });
          code = t.diagnostics.map((d) => d.code).join(',');
          if (!p.ok) {
            expect(p.diagnostics.some((d) => d.code === 'P_NESTING_TOO_DEEP')).toBe(
              true,
            );
          }
          expect(t.ok).toBe(false);
        } catch {
          threw = true;
        }
      });
      const pass = !threw && !parseOk && code.includes('P_NESTING_TOO_DEEP');
      expect(threw).toBe(false);
      record({
        area: 'compiler',
        scenario: 'IF nesting depth=600 → diagnostic',
        pass,
        ms: +run.ms.toFixed(3),
        detail: `parseOk=${parseOk} codes=${code}`,
      });
    },
    60_000,
  );
});

describe('stress / translator', () => {
  it(
    'forward translate 5000-line program',
    () => {
      const source = manyAssignments(5000);
      const t = timed(() =>
        translatePseudocodeToPython(source, { maxSourceChars: 2_000_000 }),
      );
      expect(t.result.ok).toBe(true);
      record({
        area: 'translator',
        scenario: 'pseudo→python 5000 assignments',
        pass: t.result.ok,
        ms: +t.ms.toFixed(3),
        size: `${source.length}→${t.result.code.length} chars`,
      });
    },
    120_000,
  );

  it(
    'reverse translate large python',
    () => {
      const source = manyAssignments(2000);
      const fwd = translatePseudocodeToPython(source, {
        maxSourceChars: 2_000_000,
      });
      expect(fwd.ok).toBe(true);
      const rev = timed(() =>
        translatePythonToPseudocode(fwd.code, { maxSourceChars: 2_000_000 }),
      );
      expect(rev.result.ok).toBe(true);
      record({
        area: 'translator',
        scenario: 'python→pseudo 2000 assignments',
        pass: rev.result.ok,
        ms: +rev.ms.toFixed(3),
        size: `${fwd.code.length}→${rev.result.code.length} chars`,
      });
    },
    120_000,
  );

  it(
    '1000 repeated round-trips (small program)',
    () => {
      const source = cycleSample();
      let last = source;
      const run = timed(() => {
        for (let i = 0; i < 1000; i += 1) {
          const fwd = translatePseudocodeToPython(last);
          if (!fwd.ok) throw new Error(`fwd fail @${i}`);
          const back = translatePythonToPseudocode(fwd.code);
          if (!back.ok) throw new Error(`rev fail @${i}`);
          last = back.code;
        }
      });
      const again = translatePseudocodeToPython(last);
      expect(again.ok).toBe(true);
      // Identifier / structure preserved through churn
      expect(last).toMatch(/FOR/i);
      expect(last).toMatch(/OUTPUT/i);
      record({
        area: 'translator',
        scenario: '1000 round-trips cycleSample',
        pass: again.ok,
        ms: +run.ms.toFixed(3),
        detail: `finalChars=${last.length}`,
      });
    },
    180_000,
  );

  it(
    'formatting stability: 50 round-trips identical after settle',
    () => {
      let cur = `
DECLARE Count : INTEGER
Count ← 0
WHILE Count < 3
  OUTPUT Count
  Count ← Count + 1
ENDWHILE
`.trim();
      const forms: string[] = [];
      const run = timed(() => {
        for (let i = 0; i < 50; i += 1) {
          const fwd = translatePseudocodeToPython(cur);
          expect(fwd.ok).toBe(true);
          const back = translatePythonToPseudocode(fwd.code);
          expect(back.ok).toBe(true);
          cur = back.code;
          forms.push(cur);
        }
      });
      // After first round-trip, form should stabilize (or stay bounded)
      const last10 = forms.slice(-10);
      const unique = new Set(last10).size;
      const pass = unique <= 2;
      expect(pass).toBe(true);
      record({
        area: 'translator',
        scenario: 'formatting stability 50 RT',
        pass,
        ms: +run.ms.toFixed(3),
        detail: `uniqueLast10=${unique}`,
      });
    },
    60_000,
  );

  it(
    'identifier preservation across round-trip (long names)',
    () => {
      const source = longIdentifiers(80, 3);
      const fwd = timed(() => translatePseudocodeToPython(source));
      expect(fwd.result.ok).toBe(true);
      const rev = timed(() => translatePythonToPseudocode(fwd.result.code));
      expect(rev.result.ok).toBe(true);
      const stem = 'A' + 'x'.repeat(80);
      const pass = rev.result.code.includes(stem);
      expect(pass).toBe(true);
      record({
        area: 'translator',
        scenario: 'long identifier preservation',
        pass,
        ms: +(fwd.ms + rev.ms).toFixed(3),
        size: `idLen=80`,
      });
    },
    30_000,
  );

  it(
    'massive CLASS translate both ways',
    () => {
      const source = massiveClass(40);
      const fwd = timed(() => translatePseudocodeToPython(source));
      expect(fwd.result.ok).toBe(true);
      const rev = timed(() => translatePythonToPseudocode(fwd.result.code));
      expect(rev.result.ok).toBe(true);
      const pass = rev.result.code.includes('CLASS BigObj');
      expect(pass).toBe(true);
      record({
        area: 'translator',
        scenario: 'CLASS 40 methods round-trip',
        pass,
        ms: +(fwd.ms + rev.ms).toFixed(3),
        size: `${linesOf(source)} lines`,
      });
    },
    60_000,
  );
});

describe('stress / interpreter + debugger', () => {
  it(
    'large array runtime ARRAY[1:2000]',
    async () => {
      const source = largeArrayProgram(2000);
      const host = new MemoryHost();
      const run = await timedAsync(() =>
        runPseudocode(source, {
          host,
          random: new SeededRandom(1),
          maxSteps: 20_000_000,
        }),
      );
      expect(run.result.ok).toBe(true);
      expect(host.outputs).toEqual([String(triangular(2000))]);
      record({
        area: 'interpreter',
        scenario: 'run ARRAY[1:2000] fill+sum',
        pass: run.result.ok,
        ms: +run.ms.toFixed(3),
        detail: `steps=${run.result.steps}`,
      });
    },
    120_000,
  );

  it(
    'nested loops 100×100',
    async () => {
      const source = nestedLoops(100, 100);
      const host = new MemoryHost();
      const run = await timedAsync(() =>
        runPseudocode(source, {
          host,
          maxSteps: 5_000_000,
        }),
      );
      expect(run.result.ok).toBe(true);
      expect(host.outputs).toEqual(['10000']);
      record({
        area: 'interpreter',
        scenario: 'nested loops 100×100',
        pass: run.result.ok,
        ms: +run.ms.toFixed(3),
        detail: `steps=${run.result.steps}`,
      });
    },
    60_000,
  );

  it(
    'file ops runtime 500 lines',
    async () => {
      const source = manyFileOps(500);
      const host = new MemoryHost();
      const run = await timedAsync(() =>
        runPseudocode(source, {
          host,
          maxSteps: 5_000_000,
        }),
      );
      expect(run.result.ok).toBe(true);
      expect(host.outputs).toEqual(['500']);
      record({
        area: 'interpreter',
        scenario: 'file WRITE/READ 500 lines',
        pass: run.result.ok,
        ms: +run.ms.toFixed(3),
      });
    },
    60_000,
  );

  it(
    'recursive call depth 200',
    async () => {
      const source = recursiveSum(200);
      const host = new MemoryHost();
      const enters: string[] = [];
      const hooks: DebuggerHooks = {
        onEnterFrame: (f) => {
          if (f.name === 'SumTo') enters.push(f.name);
        },
      };
      const run = await timedAsync(() =>
        runPseudocode(source, {
          host,
          maxCallDepth: 512,
          maxSteps: 5_000_000,
          debugger: hooks,
        }),
      );
      expect(run.result.ok).toBe(true);
      expect(host.outputs).toEqual([String((200 * 201) / 2)]);
      expect(enters.length).toBeGreaterThanOrEqual(200);
      record({
        area: 'debugger',
        scenario: 'recursion depth 200 + frame hooks',
        pass: run.result.ok,
        ms: +run.ms.toFixed(3),
        detail: `enters=${enters.length} steps=${run.result.steps}`,
      });
    },
    60_000,
  );

  it(
    'hundreds of breakpoint hits via hook',
    async () => {
      // 300 OUTPUT lines; pause on every 1st visit then continue — simulates dense BPs
      const outs = Array.from({ length: 300 }, (_, i) => `OUTPUT ${i}`).join('\n');
      const host = new MemoryHost();
      let hits = 0;
      const hooks: DebuggerHooks = {
        onBeforeStatement: async () => {
          hits += 1;
          // yield so async path is exercised
          await Promise.resolve();
        },
      };
      const run = await timedAsync(() =>
        runPseudocode(outs, {
          host,
          debugger: hooks,
          maxSteps: 100_000,
        }),
      );
      expect(run.result.ok).toBe(true);
      expect(hits).toBeGreaterThanOrEqual(300);
      expect(host.outputs.length).toBe(300);
      record({
        area: 'debugger',
        scenario: '300 statement-hook pauses (BP sim)',
        pass: run.result.ok && hits >= 300,
        ms: +run.ms.toFixed(3),
        detail: `hits=${hits}`,
      });
    },
    60_000,
  );

  it(
    'large variable table (500 decls) snapshot at end',
    async () => {
      const source = manyDeclarations(500);
      const host = new MemoryHost();
      const run = await timedAsync(() =>
        runPseudocode(source, {
          host,
          maxSteps: 100_000,
        }),
      );
      expect(run.result.ok).toBe(true);
      expect(run.result.globals.length).toBeGreaterThanOrEqual(50);
      record({
        area: 'debugger',
        scenario: '500 decls → globals snapshot',
        pass: run.result.ok,
        ms: +run.ms.toFixed(3),
        detail: `globals=${run.result.globals.length}`,
      });
    },
    60_000,
  );

  it(
    'repeated start/stop/abort 100 cycles',
    async () => {
      const source = `
DECLARE I : INTEGER
FOR I ← 1 TO 5
  OUTPUT I
NEXT I
`.trim();

      async function waitUntil(
        pred: () => boolean,
        label: string,
        maxMs = 2000,
      ): Promise<void> {
        const t0 = performance.now();
        while (!pred()) {
          if (performance.now() - t0 > maxMs) {
            throw new Error(`timeout waiting for ${label}`);
          }
          await new Promise((r) => setTimeout(r, 1));
        }
      }

      const run = await timedAsync(async () => {
        for (let i = 0; i < 100; i += 1) {
          const host = new MemoryHost();
          if (i % 2 === 0) {
            // Clean full run
            const r = await runPseudocode(source, {
              host,
              maxSteps: 10_000,
            });
            if (!r.ok) throw new Error(`full run failed @${i}`);
            continue;
          }
          // Abort while paused — mirrors IDE Stop
          const ac = new AbortController();
          let release: (() => void) | null = null;
          const p = runPseudocode(source, {
            host,
            signal: ac.signal,
            maxSteps: 10_000,
            debugger: {
              onBeforeStatement: async () => {
                if (!release) {
                  await new Promise<void>((r) => {
                    release = r;
                  });
                }
              },
            },
          });
          await waitUntil(() => release !== null, `pause@${i}`);
          ac.abort();
          release!();
          const r = await p;
          if (r.ok || !r.diagnostics.some((d) => d.code === 'R_CANCELLED')) {
            throw new Error(`expected R_CANCELLED @${i}`);
          }
        }
      });
      record({
        area: 'debugger',
        scenario: '100 start/stop/abort cycles',
        pass: true,
        ms: +run.ms.toFixed(3),
      });
    },
    180_000,
  );
});

describe('stress / memory + incremental compiler', () => {
  it(
    '200 compile/translate cycles — heap delta',
    () => {
      const source = cycleSample();
      // Encourage GC if exposed (Node --expose-gc); otherwise best-effort.
      const gc = (globalThis as { gc?: () => void }).gc;
      gc?.();
      const before = heapMb();
      const run = timed(() => {
        const compiler = new IncrementalCompiler();
        for (let i = 0; i < 200; i += 1) {
          const uri = `file:///cycle-${i % 5}.pseudo`;
          const edited = source.replace('TO 10', `TO ${10 + (i % 7)}`);
          compiler.openDocument(uri, edited, i + 1);
          const t = translatePseudocodeToPython(edited);
          if (!t.ok) throw new Error(`translate fail @${i}`);
        }
      });
      gc?.();
      const after = heapMb();
      const delta = +(after - before).toFixed(2);
      // Soft bound: 200 cycles should not retain unbounded growth in Node.
      // Fail only on extreme growth (>150MB) which indicates a clear leak path.
      const pass = delta < 150;
      expect(pass).toBe(true);
      record({
        area: 'memory',
        scenario: '200 compile+translate cycles',
        pass,
        ms: +run.ms.toFixed(3),
        heapDeltaMb: delta,
        detail: `before=${before.toFixed(1)}MB after=${after.toFixed(1)}MB`,
      });
    },
    120_000,
  );

  it(
    'incremental cold vs warm large program',
    () => {
      const source = manyAssignments(3000);
      const c = new IncrementalCompiler();
      const cold = timed(() => c.openDocument('file:///s.pseudo', source, 1));
      const warm = timed(() => c.compile('file:///s.pseudo'));
      expect(cold.result.cacheHit).toBe(false);
      expect(warm.result.cacheHit).toBe(true);
      record({
        area: 'compiler',
        scenario: 'incremental cold vs warm 3000 assigns',
        pass: warm.result.cacheHit === true,
        ms: +cold.ms.toFixed(3),
        detail: `cold=${cold.ms.toFixed(1)}ms warm=${warm.ms.toFixed(1)}ms`,
        size: `${source.length} chars`,
      });
    },
    120_000,
  );

  it(
    'rapid edit spam (500 single-line edits)',
    () => {
      const base = manyAssignments(200);
      const c = new IncrementalCompiler();
      c.openDocument('file:///edit.pseudo', base, 1);
      const run = timed(() => {
        let src = base;
        for (let v = 2; v <= 501; v += 1) {
          src = src.replace(/OUTPUT Total/, `OUTPUT Total + ${v % 9}`);
          // restore marker for next replace
          if (!src.includes('OUTPUT Total')) {
            src = `${src}\nOUTPUT Total`;
          }
          c.updateDocument('file:///edit.pseudo', src, v);
        }
      });
      expect(c.totalStats().parseRuns).toBeGreaterThan(1);
      record({
        area: 'compiler',
        scenario: '500 incremental edits',
        pass: true,
        ms: +run.ms.toFixed(3),
        detail: `parseRuns=${c.totalStats().parseRuns}`,
      });
    },
    180_000,
  );
});

describe('stress / startup (cold load)', () => {
  it(
    'dynamic import cold load of core packages',
    async () => {
      const run = await timedAsync(async () => {
        // Fresh isolate via child would be ideal; here we measure re-import cost
        // of already-cached modules as a lower bound, plus a synthetic parse.
        const { parse: p } = await import('@pseudopilot/language-core');
        const { check: ch } = await import('@pseudopilot/checker');
        const { translatePseudocodeToPython: tr } = await import(
          '@pseudopilot/translator'
        );
        const src = 'OUTPUT 1';
        const parsed = p(src);
        ch(parsed.ast);
        tr(src);
      });
      record({
        area: 'startup',
        scenario: 're-import core packages + hello',
        pass: true,
        ms: +run.ms.toFixed(3),
        detail: 'Note: modules may already be in require cache (lower bound)',
      });
    },
    30_000,
  );
});

afterAll(() => {
  const summary = {
    kind: 'stress-summary',
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    scenarios: RESULTS.length,
    passed: RESULTS.filter((r) => r.pass).length,
    failed: RESULTS.filter((r) => !r.pass).length,
    rows: RESULTS,
  };
  console.log(JSON.stringify(summary, null, 2));
});
