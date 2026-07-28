import { describe, expect, it, beforeEach } from 'vitest';
import { RuntimeController, canTransition } from './index';

describe('debugger state machine', () => {
  it('allows running → paused → running', () => {
    expect(canTransition('running', 'paused')).toBe(true);
    expect(canTransition('paused', 'running')).toBe(true);
  });

  it('allows paused → cancelled', () => {
    expect(canTransition('paused', 'cancelled')).toBe(true);
  });
});

describe('RuntimeController debugger', () => {
  let controller: RuntimeController;

  beforeEach(() => {
    controller = new RuntimeController();
  });

  it('hits a line breakpoint and continues', async () => {
    controller.toggleBreakpoint(3);
    const runPromise = controller.run(`
OUTPUT 1
OUTPUT 2
OUTPUT 3
`);
    await waitFor(() => controller.getSnapshot().state === 'paused');
    expect(controller.getSnapshot().pauseLocation?.line).toBe(3);
    // Paused *before* OUTPUT 2 executes.
    expect(
      controller.getSnapshot().consoleLines.some((l) => l.kind === 'out' && l.text === '1'),
    ).toBe(true);
    expect(
      controller.getSnapshot().consoleLines.some((l) => l.kind === 'out' && l.text === '2'),
    ).toBe(false);

    controller.continue();
    await runPromise;
    expect(controller.getSnapshot().state).toBe('completed');
    expect(
      controller.getSnapshot().consoleLines.some((l) => l.kind === 'out' && l.text === '3'),
    ).toBe(true);
  });

  it('supports multiple breakpoints', async () => {
    controller.toggleBreakpoint(2);
    controller.toggleBreakpoint(4);
    const runPromise = controller.run(`
OUTPUT 1
OUTPUT 2
OUTPUT 3
OUTPUT 4
`);
    await waitFor(() => controller.getSnapshot().paused);
    expect(controller.getSnapshot().pauseLocation?.line).toBe(2);
    controller.continue();
    await waitFor(() => controller.getSnapshot().pauseLocation?.line === 4);
    controller.continue();
    await runPromise;
    expect(controller.getSnapshot().state).toBe('completed');
  });

  it('step into from idle stops on first statement', async () => {
    const runPromise = controller.stepIntoFromIdle(`
OUTPUT 10
OUTPUT 20
`);
    await waitFor(() => controller.getSnapshot().paused);
    expect(controller.getSnapshot().pauseLocation?.line).toBe(2);
    expect(
      controller.getSnapshot().consoleLines.some((l) => l.kind === 'out'),
    ).toBe(false);
    controller.continue();
    await runPromise;
    expect(controller.getSnapshot().state).toBe('completed');
  });

  it('step over does not enter a procedure body', async () => {
    const src = `
PROCEDURE P
  OUTPUT "in"
ENDPROCEDURE
CALL P
OUTPUT "after"
`;
    const runPromise = controller.stepIntoFromIdle(src);
    await waitFor(() => controller.getSnapshot().paused);
    // First executable is CALL P (PROCEDURE decl is skipped at runtime).
    // Step until we land on CALL, then step over.
    let guard = 0;
    while (
      controller.getSnapshot().pauseLocation &&
      !isCallLine(controller.getSnapshot().pauseLocation!.line, src) &&
      guard < 20
    ) {
      controller.stepInto();
      await waitFor(() => controller.getSnapshot().paused);
      guard += 1;
    }
    expect(isCallLine(controller.getSnapshot().pauseLocation!.line, src)).toBe(
      true,
    );
    controller.stepOver();
    await waitFor(() => controller.getSnapshot().paused);
    const outs = controller
      .getSnapshot()
      .consoleLines.filter((l) => l.kind === 'out')
      .map((l) => l.text);
    expect(outs).toContain('in');
    expect(outs).not.toContain('after');
    // Should be paused on OUTPUT "after", not inside P.
    expect(controller.getSnapshot().frameName).toBeNull();
    controller.continue();
    await runPromise;
  });

  it('step out leaves a nested procedure', async () => {
    const src = `
PROCEDURE Inner
  OUTPUT "i1"
  OUTPUT "i2"
ENDPROCEDURE
PROCEDURE Outer
  CALL Inner
  OUTPUT "o"
ENDPROCEDURE
CALL Outer
`;
    const runPromise = controller.stepIntoFromIdle(src);
    await waitFor(() => controller.getSnapshot().paused);

    // Drive into Inner's first OUTPUT.
    let guard = 0;
    while (
      controller.getSnapshot().frameName !== 'Inner' &&
      guard < 40
    ) {
      controller.stepInto();
      await waitFor(() => controller.getSnapshot().paused);
      guard += 1;
    }
    expect(controller.getSnapshot().frameName).toBe('Inner');
    controller.stepOut();
    await waitFor(() => controller.getSnapshot().paused);
    expect(controller.getSnapshot().frameName).toBe('Outer');
    controller.continue();
    await runPromise;
    expect(controller.getSnapshot().state).toBe('completed');
  });

  it('stop while paused cleans up', async () => {
    controller.toggleBreakpoint(2);
    const runPromise = controller.run(`
OUTPUT 1
OUTPUT 2
`);
    await waitFor(() => controller.getSnapshot().paused);
    controller.stop();
    await runPromise;
    expect(controller.getSnapshot().state).toBe('cancelled');
    expect(controller.getSnapshot().paused).toBe(false);
  });

  it('restart while paused starts a fresh run', async () => {
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

  it('shows variables and call stack while paused in a function', async () => {
    const src = `
FUNCTION Double(N : INTEGER) RETURNS INTEGER
  RETURN N * 2
ENDFUNCTION
OUTPUT Double(21)
`;
    // Breakpoint on RETURN line — find it dynamically after parse via stepping.
    const runPromise = controller.stepIntoFromIdle(src);
    await waitFor(() => controller.getSnapshot().paused);
    let guard = 0;
    while (controller.getSnapshot().frameName !== 'Double' && guard < 40) {
      controller.stepInto();
      await waitFor(() => controller.getSnapshot().paused);
      guard += 1;
    }
    const snap = controller.getSnapshot();
    expect(snap.frameName).toBe('Double');
    expect(snap.callStack.some((f) => f.name === 'Double')).toBe(true);
    expect(
      snap.variables.some((v) => v.name === 'N' && v.scope === 'parameter'),
    ).toBe(true);
    controller.continue();
    await runPromise;
  });

  it('recursive function call stack grows', async () => {
    const src = `
FUNCTION Fact(N : INTEGER) RETURNS INTEGER
  IF N = 0 THEN
    RETURN 1
  ENDIF
  RETURN N * Fact(N - 1)
ENDFUNCTION
OUTPUT Fact(3)
`;
    const runPromise = controller.stepIntoFromIdle(src);
    await waitFor(() => controller.getSnapshot().paused);
    let maxDepth = 0;
    let guard = 0;
    while (guard < 80 && controller.getSnapshot().state === 'paused') {
      const facts = controller
        .getSnapshot()
        .callStack.filter((f) => f.name === 'Fact').length;
      maxDepth = Math.max(maxDepth, facts);
      if (facts >= 3) break;
      controller.stepInto();
      await waitFor(
        () =>
          controller.getSnapshot().paused ||
          controller.getSnapshot().state === 'completed',
      );
      guard += 1;
    }
    expect(maxDepth).toBeGreaterThanOrEqual(3);
    if (controller.getSnapshot().paused) {
      controller.continue();
    }
    await runPromise;
  });

  it('pause button stops at next statement', async () => {
    const runPromise = controller.run(`
DECLARE I : INTEGER
FOR I ← 1 TO 10000
OUTPUT I
NEXT I
`);
    await waitFor(() => controller.getSnapshot().state === 'running');
    controller.pause();
    await waitFor(() => controller.getSnapshot().paused);
    expect(controller.getSnapshot().pauseLocation).not.toBeNull();
    controller.stop();
    await runPromise;
  });

  it('INPUT after continue from pause works', async () => {
    controller.toggleBreakpoint(2);
    const runPromise = controller.run(`
OUTPUT "go"
DECLARE N : INTEGER
INPUT N
OUTPUT N
`);
    await waitFor(() => controller.getSnapshot().paused);
    controller.continue();
    await waitFor(() => controller.getSnapshot().awaitingInput);
    controller.submitInput('5');
    await runPromise;
    expect(
      controller.getSnapshot().consoleLines.some((l) => l.kind === 'out' && l.text === '5'),
    ).toBe(true);
  });

  it('disabled breakpoint is skipped', async () => {
    controller.toggleBreakpoint(2); // enabled
    controller.toggleBreakpoint(2); // disabled
    await controller.run(`
OUTPUT 1
OUTPUT 2
`);
    expect(controller.getSnapshot().state).toBe('completed');
    expect(controller.getSnapshot().paused).toBe(false);
  });

  it('removed breakpoint is skipped', async () => {
    controller.toggleBreakpoint(2);
    controller.removeBreakpoint(2);
    await controller.run(`
OUTPUT 1
OUTPUT 2
`);
    expect(controller.getSnapshot().state).toBe('completed');
  });

  it('breakpoints persist across runs', async () => {
    controller.toggleBreakpoint(2);
    const first = controller.run(`OUTPUT 1\nOUTPUT 2`);
    await waitFor(() => controller.getSnapshot().paused);
    controller.continue();
    await first;
    expect(controller.getBreakpoints().some((b) => b.line === 2 && b.enabled)).toBe(
      true,
    );
    const second = controller.run(`OUTPUT 1\nOUTPUT 2`);
    await waitFor(() => controller.getSnapshot().paused);
    expect(controller.getSnapshot().pauseLocation?.line).toBe(2);
    controller.continue();
    await second;
  });

  it('loop header breakpoint hits each iteration', async () => {
    const src = `DECLARE I : INTEGER
I ← 0
WHILE I < 3
  I ← I + 1
ENDWHILE
OUTPUT I
`;
    const whileLine = src.split('\n').findIndex((l) => l.startsWith('WHILE')) + 1;
    controller.toggleBreakpoint(whileLine);
    const runPromise = controller.run(src);
    let hits = 0;
    while (hits < 20) {
      await waitFor(
        () =>
          controller.getSnapshot().paused ||
          controller.getSnapshot().state === 'completed',
      );
      if (controller.getSnapshot().state === 'completed') break;
      hits += 1;
      controller.continue();
    }
    await runPromise;
    // Entry tick + one re-tick per successful iteration (I: 0→1,1→2,2→3).
    expect(hits).toBeGreaterThanOrEqual(3);
    expect(controller.getSnapshot().state).toBe('completed');
  });
});

function isCallLine(line: number, src: string): boolean {
  const text = src.split('\n')[line - 1] ?? '';
  return text.trim().startsWith('CALL');
}

async function waitFor(pred: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor timeout');
    }
    await new Promise((r) => setTimeout(r, 5));
  }
}
