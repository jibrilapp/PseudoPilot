/**
 * IDE-layer conformance: worker runtime + debugger controls.
 * Complements `@pseudopilot/conformance` (package tests cannot depend on apps/).
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { RuntimeController } from '../runtime';

async function waitFor(
  pred: () => boolean,
  timeoutMs = 3000,
): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor timeout');
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('conformance / IDE worker + debugger', () => {
  let controller: RuntimeController;

  beforeEach(() => {
    controller = new RuntimeController({ worker: { inProcess: true } });
  });

  it('in-process worker runs a Cambridge program to completion', async () => {
    await controller.run(`
DECLARE N : INTEGER
N ← 7
OUTPUT N
`);
    const snap = controller.getSnapshot();
    expect(snap.state).toBe('completed');
    expect(snap.consoleLines.some((l) => l.kind === 'out' && l.text === '7')).toBe(
      true,
    );
  });

  it('Pause via breakpoint → Continue', async () => {
    controller.toggleBreakpoint(3);
    const p = controller.run(`
OUTPUT 1
OUTPUT 2
OUTPUT 3
`);
    await waitFor(() => controller.getSnapshot().state === 'paused');
    controller.continue();
    await p;
    expect(controller.getSnapshot().state).toBe('completed');
  });

  it('Stop while paused', async () => {
    controller.toggleBreakpoint(2);
    const p = controller.run(`
OUTPUT 1
OUTPUT 2
OUTPUT 3
`);
    await waitFor(() => controller.getSnapshot().paused);
    controller.stop();
    await p;
    expect(controller.getSnapshot().state).toBe('cancelled');
    expect(controller.getSnapshot().paused).toBe(false);
  });

  it('Restart while paused', async () => {
    controller.toggleBreakpoint(2);
    const first = controller.run(`
OUTPUT 1
OUTPUT 2
`);
    await waitFor(() => controller.getSnapshot().paused);
    await controller.restart(`OUTPUT 9`);
    await first;
    expect(controller.getSnapshot().state).toBe('completed');
    expect(
      controller.getSnapshot().consoleLines.some((l) => l.kind === 'out' && l.text === '9'),
    ).toBe(true);
  });
});
