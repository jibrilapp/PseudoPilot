import { describe, expect, it, beforeEach } from 'vitest';
import {
  RuntimeController,
  canTransition,
  MAX_CONSOLE_LINES,
  IdeRuntimeHost,
} from './index';

describe('execution state machine', () => {
  it('allows idle → running', () => {
    expect(canTransition('idle', 'running')).toBe(true);
  });

  it('blocks running → idle directly', () => {
    expect(canTransition('running', 'idle')).toBe(false);
  });
});

describe('RuntimeController', () => {
  let controller: RuntimeController;

  beforeEach(() => {
    controller = new RuntimeController();
  });

  it('runs OUTPUT programs and updates console', async () => {
    await controller.run(`
OUTPUT 1 + 2
`);
    const snap = controller.getSnapshot();
    expect(snap.state).toBe('completed');
    expect(snap.consoleLines.some((l) => l.kind === 'out' && l.text === '3')).toBe(
      true,
    );
  });

  it('surfaces semantic errors without executing', async () => {
    await controller.run(`
OUTPUT UndeclaredVar
`);
    const snap = controller.getSnapshot();
    expect(snap.state).toBe('semanticError');
    expect(snap.diagnostics.some((d) => d.code.startsWith('C_'))).toBe(true);
  });

  it('surfaces runtime errors', async () => {
    await controller.run(`OUTPUT 1 / 0`);
    const snap = controller.getSnapshot();
    expect(snap.state).toBe('runtimeError');
    expect(snap.diagnostics.some((d) => d.code === 'R_DIV_ZERO')).toBe(true);
  });

  it('updates variables after run', async () => {
    await controller.run(`
DECLARE N : INTEGER
N ← 42
`);
    const snap = controller.getSnapshot();
    expect(snap.variables.some((v) => v.name === 'N' && v.value === '42')).toBe(
      true,
    );
  });

  it('supports INPUT pause and resume', async () => {
    const runPromise = controller.run(`
DECLARE N : INTEGER
INPUT N
OUTPUT N * 2
`);

    await waitFor(() => controller.getSnapshot().state === 'waitingForInput');
    expect(controller.getSnapshot().awaitingInput).toBe(true);
    controller.submitInput('21');
    await runPromise;

    const snap = controller.getSnapshot();
    expect(snap.state).toBe('completed');
    expect(snap.consoleLines.some((l) => l.kind === 'out' && l.text === '42')).toBe(
      true,
    );
    expect(snap.consoleLines.some((l) => l.kind === 'in' && l.text === '21')).toBe(
      true,
    );
  });

  it('stops a running loop and cleans up', async () => {
    const runPromise = controller.run(`
WHILE TRUE
ENDWHILE
`);
    await waitFor(() => controller.getSnapshot().state === 'running');
    controller.stop();
    await runPromise;
    const snap = controller.getSnapshot();
    expect(snap.state).toBe('cancelled');
    expect(controller.getSnapshot().awaitingInput).toBe(false);
  });

  it('ignores a second run while busy', async () => {
    const first = controller.run(`
DECLARE N : INTEGER
INPUT N
OUTPUT N
`);
    await waitFor(() => controller.getSnapshot().awaitingInput);
    await controller.run(`OUTPUT 999`);
    // Still waiting on first session
    expect(controller.getSnapshot().awaitingInput).toBe(true);
    controller.submitInput('1');
    await first;
    expect(
      controller.getSnapshot().consoleLines.some((l) => l.text === '999'),
    ).toBe(false);
  });

  it('restart clears console and runs again', async () => {
    await controller.run(`OUTPUT 1`);
    await controller.restart(`OUTPUT 2`);
    const outs = controller
      .getSnapshot()
      .consoleLines.filter((l) => l.kind === 'out')
      .map((l) => l.text);
    expect(outs).toContain('2');
  });

  it('clearConsole empties lines', async () => {
    await controller.run(`OUTPUT 1`);
    controller.clearConsole();
    expect(controller.getSnapshot().consoleLines).toEqual([]);
  });

  it('keeps snapshot identity stable between emits (useSyncExternalStore)', () => {
    const a = controller.getSnapshot();
    const b = controller.getSnapshot();
    expect(a).toBe(b);
  });

  it('Stop does not apply late R_CANCELLED diagnostics from the aborted run', async () => {
    const runPromise = controller.run(`
WHILE TRUE
ENDWHILE
`);
    await waitFor(() => controller.getSnapshot().state === 'running');
    controller.stop();
    await runPromise;

    const snap = controller.getSnapshot();
    expect(snap.state).toBe('cancelled');
    expect(snap.diagnostics.some((d) => d.code === 'R_CANCELLED')).toBe(false);
    expect(
      snap.consoleLines.filter((l) => l.kind === 'error' && l.text.includes('R_CANCELLED'))
        .length,
    ).toBe(0);
    expect(snap.consoleLines.some((l) => l.kind === 'info' && l.text.includes('stopped'))).toBe(
      true,
    );
  });

  it('Stop while waiting for INPUT rejects the waiter without deadlock', async () => {
    const runPromise = controller.run(`
DECLARE N : INTEGER
INPUT N
OUTPUT N
`);
    await waitFor(() => controller.getSnapshot().awaitingInput);
    controller.stop();
    await runPromise;
    const snap = controller.getSnapshot();
    expect(snap.state).toBe('cancelled');
    expect(snap.awaitingInput).toBe(false);
    // A subsequent run must be able to wait for INPUT again.
    const second = controller.run(`
DECLARE X : INTEGER
INPUT X
OUTPUT X
`);
    await waitFor(() => controller.getSnapshot().awaitingInput);
    controller.submitInput('7');
    await second;
    expect(controller.getSnapshot().state).toBe('completed');
    expect(
      controller.getSnapshot().consoleLines.some((l) => l.kind === 'out' && l.text === '7'),
    ).toBe(true);
  });

  it('Restart during INPUT drops stale session output', async () => {
    const first = controller.run(`
DECLARE N : INTEGER
INPUT N
OUTPUT "stale"
`);
    await waitFor(() => controller.getSnapshot().awaitingInput);
    const restartPromise = controller.restart(`OUTPUT "fresh"`);
    await first;
    await restartPromise;
    const outs = controller
      .getSnapshot()
      .consoleLines.filter((l) => l.kind === 'out')
      .map((l) => l.text);
    expect(outs).toEqual(['fresh']);
    expect(outs).not.toContain('stale');
  });

  it('Restart during a tight loop does not leave state busy', async () => {
    const first = controller.run(`
WHILE TRUE
ENDWHILE
`);
    await waitFor(() => controller.getSnapshot().state === 'running');
    await controller.restart(`OUTPUT 1`);
    await first;
    const snap = controller.getSnapshot();
    expect(snap.state).toBe('completed');
    expect(snap.awaitingInput).toBe(false);
    expect(snap.consoleLines.some((l) => l.kind === 'out' && l.text === '1')).toBe(
      true,
    );
  });

  it('does not duplicate diagnostics as console error lines', async () => {
    await controller.run(`OUTPUT UndeclaredName\n`);
    const snap = controller.getSnapshot();
    expect(snap.diagnostics.length).toBeGreaterThan(0);
    expect(snap.consoleLines.filter((l) => l.kind === 'error')).toHaveLength(0);
  });

  it('Restart drains the prior interpreter before finishing the next run', async () => {
    const first = controller.run(`
WHILE TRUE
ENDWHILE
`);
    await waitFor(() => controller.getSnapshot().state === 'running');
    await controller.restart(`OUTPUT "after"`);
    await first;
    const snap = controller.getSnapshot();
    expect(snap.state).toBe('completed');
    expect(
      snap.consoleLines.filter((l) => l.kind === 'info' && l.text === 'Program finished.'),
    ).toHaveLength(1);
    expect(snap.consoleLines.filter((l) => l.kind === 'out').map((l) => l.text)).toEqual([
      'after',
    ]);
  });

  it('caps console growth under burst OUTPUT', async () => {
    // Many small OUTPUT statements — enough to exceed the soft cap if uncapped.
    const lines = Array.from({ length: MAX_CONSOLE_LINES + 50 }, (_, i) => `OUTPUT ${i}`).join(
      '\n',
    );
    await controller.run(lines);
    expect(controller.getSnapshot().consoleLines.length).toBeLessThanOrEqual(
      MAX_CONSOLE_LINES,
    );
  });
});

describe('IdeRuntimeHost', () => {
  it('rejects a stale pending INPUT when a second read starts', async () => {
    const outputs: string[] = [];
    let waiting = 0;
    const host = new IdeRuntimeHost(
      (line) => {
        outputs.push(line);
      },
      {
        onWaiting: () => {
          waiting += 1;
        },
        onResolved: () => {},
      },
    );
    const first = host.readInput();
    const second = host.readInput();
    await expect(first).rejects.toThrow(/Overlapping INPUT/);
    expect(waiting).toBe(2);
    host.submitInput('ok');
    await expect(second).resolves.toBe('ok');
  });

  it('cancelInput rejects with AbortError', async () => {
    const host = new IdeRuntimeHost(
      () => {},
      { onWaiting: () => {}, onResolved: () => {} },
    );
    const pending = host.readInput();
    host.cancelInput();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(host.isAwaitingInput).toBe(false);
  });
});

async function waitFor(pred: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor timeout');
    }
    await new Promise((r) => setTimeout(r, 5));
  }
}
