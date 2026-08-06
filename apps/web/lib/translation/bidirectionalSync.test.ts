import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createBidirectionalSync } from './bidirectionalSync';
import type { SafeTranslateResult } from './runTranslate';
import {
  runPseudocodeToPython,
  runPythonToPseudocode,
} from './runTranslate';

function ok(code: string): SafeTranslateResult {
  return { ok: true, code, diagnostics: [] };
}

function fail(message: string, code = 'T_FAIL'): SafeTranslateResult {
  return {
    ok: false,
    code: '',
    diagnostics: [
      {
        id: '1',
        severity: 'error',
        message,
        code,
        line: 1,
        column: 1,
      },
    ],
  };
}

describe('createBidirectionalSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('pseudocode → python (forward)', () => {
    const forward = vi.fn((s: string) => ok(`# from ${s.trim()}`));
    const reverse = vi.fn(() => ok(''));
    const sync = createBidirectionalSync({
      initialPseudocode: 'OUTPUT 1',
      translateForward: forward,
      translateReverse: reverse,
      debounceMs: () => 50,
    });
    sync.bootstrap();
    vi.advanceTimersByTime(50);
    expect(forward).toHaveBeenCalledTimes(1);
    expect(sync.getState().python).toBe('# from OUTPUT 1');
    expect(sync.getState().status).toBe('ok');
    expect(reverse).not.toHaveBeenCalled();
  });

  it('python → pseudocode (reverse) does not re-trigger forward', () => {
    const forward = vi.fn((s: string) => ok(`py(${s})`));
    const reverse = vi.fn((s: string) => ok(`OUTPUT ${s}`));
    const sync = createBidirectionalSync({
      initialPseudocode: 'OUTPUT 1',
      translateForward: forward,
      translateReverse: reverse,
      debounceMs: () => 50,
    });
    sync.bootstrap();
    vi.advanceTimersByTime(50);
    forward.mockClear();

    sync.editPython('print(2)');
    vi.advanceTimersByTime(50);

    expect(reverse).toHaveBeenCalledTimes(1);
    expect(sync.getState().pseudocode).toBe('OUTPUT print(2)');
    expect(forward).not.toHaveBeenCalled();
  });

  it('applying forward python does not schedule reverse', () => {
    const forward = vi.fn(() => ok('print(1)'));
    const reverse = vi.fn(() => ok('OUTPUT 1'));
    const sync = createBidirectionalSync({
      initialPseudocode: 'OUTPUT 1',
      translateForward: forward,
      translateReverse: reverse,
      debounceMs: () => 50,
    });
    sync.bootstrap();
    vi.advanceTimersByTime(50);
    expect(reverse).not.toHaveBeenCalled();
    expect(sync.getState().python).toBe('print(1)');
  });

  it('prevents infinite loops on rapid alternating edits', () => {
    let forwardCount = 0;
    let reverseCount = 0;
    const sync = createBidirectionalSync({
      initialPseudocode: 'OUTPUT 1',
      translateForward: (s) => {
        forwardCount += 1;
        return ok(`F${forwardCount}:${s}`);
      },
      translateReverse: (s) => {
        reverseCount += 1;
        return ok(`R${reverseCount}:${s}`);
      },
      debounceMs: () => 100,
    });
    sync.bootstrap();
    sync.editPseudocode('A');
    sync.editPython('B');
    sync.editPseudocode('C');
    sync.editPython('D');
    vi.advanceTimersByTime(100);
    // Only the last pending direction (python) should flush.
    expect(reverseCount).toBe(1);
    expect(forwardCount).toBe(0);
    expect(sync.getState().pseudocode).toBe('R1:D');
    expect(sync.getState().python).toBe('D');
  });

  it('invalid Python keeps last good Pseudocode and surfaces diagnostics', () => {
    const sync = createBidirectionalSync({
      initialPseudocode: 'OUTPUT 1',
      translateForward: () => ok('print(1)'),
      translateReverse: () => fail('bad python', 'T_PY'),
      debounceMs: () => 10,
    });
    sync.bootstrap();
    vi.advanceTimersByTime(10);
    expect(sync.getState().pseudocode).toBe('OUTPUT 1');

    sync.editPython('lambda: 1');
    vi.advanceTimersByTime(10);

    expect(sync.getState().pseudocode).toBe('OUTPUT 1');
    expect(sync.getState().python).toBe('lambda: 1');
    expect(sync.getState().status).toBe('error');
    expect(sync.getState().errorSide).toBe('python');
    expect(sync.getState().diagnostics[0]?.code).toBe('T_PY');
  });

  it('invalid Pseudocode keeps last good Python', () => {
    const sync = createBidirectionalSync({
      initialPseudocode: 'OUTPUT 1',
      translateForward: (s) =>
        s.includes('@@@') ? fail('bad ps') : ok(`print(${s})`),
      translateReverse: () => ok('OUTPUT 1'),
      debounceMs: () => 10,
    });
    sync.bootstrap();
    vi.advanceTimersByTime(10);
    expect(sync.getState().python).toBe('print(OUTPUT 1)');

    sync.editPseudocode('@@@');
    vi.advanceTimersByTime(10);

    expect(sync.getState().python).toBe('print(OUTPUT 1)');
    expect(sync.getState().pseudocode).toBe('@@@');
    expect(sync.getState().errorSide).toBe('pseudocode');
  });

  it('stale forward result is dropped after reverse edit', () => {
    const sync = createBidirectionalSync({
      initialPseudocode: 'OUTPUT 1',
      translateForward: () => ok('FROM_FORWARD'),
      translateReverse: () => ok('FROM_REVERSE'),
      debounceMs: () => 100,
    });
    sync.editPseudocode('X');
    vi.advanceTimersByTime(50);
    sync.editPython('Y');
    vi.advanceTimersByTime(100);
    expect(sync.getState().pseudocode).toBe('FROM_REVERSE');
    expect(sync.getState().python).toBe('Y');
  });

  it('peer apply echo of forward Python must not reverse-mutate Pseudocode', () => {
    // Regression: after Pseudocode→Python, Monaco executeEdits on the Python
    // pane can re-fire onChange with the same text. That must NOT schedule
    // reverse (lossy round-trip would rewrite unrelated Pseudocode lines).
    const reverse = vi.fn((s: string) => ok(`REVERSED:${s}`));
    const sync = createBidirectionalSync({
      initialPseudocode: 'OUTPUT 1',
      translateForward: (s) => ok(`print(${s.trim()})`),
      translateReverse: reverse,
      debounceMs: () => 50,
    });

    const pasted = Array.from({ length: 30 }, (_, i) =>
      [
        `DECLARE v${i} : INTEGER`,
        `v${i} ← ${i}`,
        `IF v${i} > 0 THEN`,
        `  OUTPUT v${i}`,
        'ENDIF',
      ].join('\n'),
    ).join('\n');

    sync.editPseudocode(pasted);
    // Normal edit after a large paste
    const edited = pasted.replace('v0 ← 0', 'v0 ← 99');
    sync.editPseudocode(edited);
    vi.advanceTimersByTime(50);

    expect(sync.getState().status).toBe('ok');
    const python = sync.getState().python;
    const before = sync.getState().pseudocode;
    expect(before).toBe(edited);
    expect(before).toContain('v0 ← 99');

    // Echo from Python pane peer sync (suppressChange missed / dual mount).
    sync.editPython(python);
    vi.advanceTimersByTime(50);

    expect(reverse).not.toHaveBeenCalled();
    expect(sync.getState().pseudocode).toBe(before);
    expect(sync.getState().pseudocode).toBe(edited);
    // Unrelated lines must be untouched (no indent / identifier rewrite).
    expect(sync.getState().pseudocode.split('\n')).toEqual(edited.split('\n'));
  });

  it('real translator: paste large Pseudocode, edit, peer Python echo leaves buffer intact', () => {
    const sync = createBidirectionalSync({
      initialPseudocode: 'OUTPUT 0\n',
      translateForward: runPseudocodeToPython,
      translateReverse: runPythonToPseudocode,
      debounceMs: () => 50,
    });
    sync.bootstrap();
    vi.advanceTimersByTime(50);

    const pasted = Array.from({ length: 40 }, (_, i) =>
      [
        `DECLARE v${i} : INTEGER`,
        `v${i} ← ${i}`,
        `IF v${i} > 0 THEN`,
        `  OUTPUT v${i}`,
        'ENDIF',
      ].join('\n'),
    ).join('\n');

    sync.editPseudocode(pasted);
    const edited = pasted.replace('v0 ← 0', 'v0 ← 99');
    sync.editPseudocode(edited);
    vi.advanceTimersByTime(50);

    expect(sync.getState().status).toBe('ok');
    const snapshot = sync.getState().pseudocode;
    const python = sync.getState().python;
    expect(python.length).toBeGreaterThan(100);

    // Without the fix, reverse round-trip rewrites 2-space indents to 4-space.
    sync.editPython(python);
    vi.advanceTimersByTime(50);

    expect(sync.getState().pseudocode).toBe(snapshot);
    expect(sync.getState().pseudocode).toContain('v0 ← 99');
    expect(sync.getState().pseudocode).toContain('  OUTPUT v0');
    expect(sync.getState().pseudocode).not.toContain('    OUTPUT v0');
  });
});

describe('runTranslate adapters (real translator)', () => {
  it('forward translates simple OUTPUT', () => {
    const result = runPseudocodeToPython('OUTPUT 1\n');
    expect(result.ok).toBe(true);
    expect(result.code).toMatch(/print/);
  });

  it('reverse recovers OUTPUT from print', () => {
    const result = runPythonToPseudocode('print(1)\n');
    expect(result.ok).toBe(true);
    expect(result.code.toUpperCase()).toContain('OUTPUT');
  });

  it('invalid Python returns diagnostics without throwing', () => {
    const result = runPythonToPseudocode('lambda: 1\n');
    expect(result.ok).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
});

describe('worker / runtime compatibility (sync isolation)', () => {
  it('successful reverse only mutates buffers — no debugger/runtime fields', () => {
    vi.useFakeTimers();
    const sync = createBidirectionalSync({
      initialPseudocode: 'OUTPUT 1',
      translateForward: () => ok('print(1)'),
      translateReverse: () => ok('OUTPUT 2'),
      debounceMs: () => 0,
    });
    const keys = Object.keys(sync.getState()).sort();
    expect(keys).toEqual([
      'diagnostics',
      'errorSide',
      'pseudocode',
      'python',
      'status',
    ]);
    sync.editPython('print(2)');
    vi.advanceTimersByTime(0);
    expect(sync.getState().pseudocode).toBe('OUTPUT 2');
    // Still only buffer fields — IncrementalCompiler / breakpoints live elsewhere.
    expect(Object.keys(sync.getState()).sort()).toEqual(keys);
    vi.useRealTimers();
  });
});
