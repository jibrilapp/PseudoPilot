/**
 * Bidirectional sync stress — rapid edit spam / large source (headless).
 * Cannot fully exercise Monaco undo/redo or selection; notes those limits.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBidirectionalSync } from './bidirectionalSync';
import {
  runPseudocodeToPython,
  runPythonToPseudocode,
} from './runTranslate';
import type { SafeTranslateResult } from './runTranslate';

function largePseudo(n: number): string {
  const lines = ['DECLARE T : INTEGER', 'T ← 0'];
  for (let i = 0; i < n; i += 1) lines.push(`T ← T + ${i % 7}`);
  lines.push('OUTPUT T');
  return lines.join('\n');
}

describe('bidirectionalSync stress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    'rapid typing spam 200 edits — only last translate wins',
    () => {
      let forwardCalls = 0;
      const sync = createBidirectionalSync({
        initialPseudocode: 'OUTPUT 0',
        translateForward: (s) => {
          forwardCalls += 1;
          return runPseudocodeToPython(s);
        },
        translateReverse: (s) => runPythonToPseudocode(s),
        debounceMs: () => 50,
      });
      sync.bootstrap();
      vi.advanceTimersByTime(50);

      const t0 = performance.now();
      for (let i = 1; i <= 200; i += 1) {
        sync.editPseudocode(`OUTPUT ${i}`);
      }
      vi.advanceTimersByTime(50);
      const ms = performance.now() - t0;

      const state = sync.getState();
      expect(state.status).toBe('ok');
      expect(state.pseudocode).toBe('OUTPUT 200');
      // Debounce should collapse intermediate translates
      expect(forwardCalls).toBeLessThan(10);
      console.log(
        JSON.stringify({
          kind: 'stress-row',
          area: 'editor',
          scenario: '200 rapid edits debounce',
          pass: forwardCalls < 10 && state.status === 'ok',
          ms: +ms.toFixed(3),
          detail: `forwardCalls=${forwardCalls}`,
        }),
      );
      sync.dispose();
    },
    30_000,
  );

  it(
    'large source live sync (3000 lines)',
    () => {
      const source = largePseudo(3000);
      const t0 = performance.now();
      const sync = createBidirectionalSync({
        initialPseudocode: source,
        translateForward: (s) => runPseudocodeToPython(s),
        translateReverse: (s) => runPythonToPseudocode(s),
        debounceMs: () => 10,
      });
      sync.bootstrap();
      vi.advanceTimersByTime(10);
      const ms = performance.now() - t0;
      const state = sync.getState();
      expect(state.status).toBe('ok');
      expect(state.python.length).toBeGreaterThan(1000);
      console.log(
        JSON.stringify({
          kind: 'stress-row',
          area: 'translator',
          scenario: 'live sync bootstrap 3000 lines',
          pass: state.status === 'ok',
          ms: +ms.toFixed(3),
          size: `${source.length} chars`,
        }),
      );
      sync.dispose();
    },
    120_000,
  );

  it(
    'alternating pane edits do not infinite-loop',
    () => {
      const forward = vi.fn(
        (s: string): SafeTranslateResult => runPseudocodeToPython(s),
      );
      const reverse = vi.fn(
        (s: string): SafeTranslateResult => runPythonToPseudocode(s),
      );
      const sync = createBidirectionalSync({
        initialPseudocode: 'OUTPUT 1',
        translateForward: forward,
        translateReverse: reverse,
        debounceMs: () => 20,
      });
      sync.bootstrap();
      vi.advanceTimersByTime(20);

      for (let i = 0; i < 50; i += 1) {
        sync.editPseudocode(`OUTPUT ${i}`);
        vi.advanceTimersByTime(20);
        const py = sync.getState().python;
        sync.editPython(py + `\n# ${i}`);
        vi.advanceTimersByTime(20);
      }

      expect(forward.mock.calls.length).toBeLessThan(120);
      expect(reverse.mock.calls.length).toBeLessThan(120);
      console.log(
        JSON.stringify({
          kind: 'stress-row',
          area: 'editor',
          scenario: '50 alternating pane edits',
          pass: true,
          ms: 0,
          detail: `fwd=${forward.mock.calls.length} rev=${reverse.mock.calls.length}`,
        }),
      );
      sync.dispose();
    },
    60_000,
  );

  it(
    'restoreBuffers large paste does not translate',
    () => {
      const big = largePseudo(4000);
      const sync = createBidirectionalSync({
        initialPseudocode: 'OUTPUT 0',
        translateForward: () => ({
          ok: true,
          code: 'print(0)',
          diagnostics: [],
        }),
        translateReverse: () => ({
          ok: true,
          code: 'OUTPUT 0',
          diagnostics: [],
        }),
        debounceMs: () => 50,
      });
      sync.bootstrap();
      vi.advanceTimersByTime(50);
      const t0 = performance.now();
      sync.restoreBuffers(big, '# restored');
      const ms = performance.now() - t0;
      expect(sync.getState().pseudocode).toBe(big);
      expect(sync.getState().python).toBe('# restored');
      expect(sync.pendingOrigin()).toBeNull();
      console.log(
        JSON.stringify({
          kind: 'stress-row',
          area: 'editor',
          scenario: 'restoreBuffers 4000-line paste',
          pass: true,
          ms: +ms.toFixed(3),
          size: `${big.length} chars`,
        }),
      );
      sync.dispose();
    },
    30_000,
  );
});
