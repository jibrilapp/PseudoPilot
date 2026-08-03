import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  WorkerController,
  WorkerSessionRunner,
  createInProcessWorkerPort,
  handleWorkerCommand,
  toWireBreakpoints,
  type WorkerEvent,
} from './index';
import { RuntimeController } from '@/lib/runtime/RuntimeController';

describe('WorkerProtocol / in-process port', () => {
  it('responds to ping with pong after ready', async () => {
    const port = createInProcessWorkerPort();
    const events: WorkerEvent[] = [];
    port.onMessage((e) => events.push(e));
    await waitFor(() => events.some((e) => e.type === 'ready'));
    port.postMessage({ type: 'ping' });
    await waitFor(() => events.some((e) => e.type === 'pong'));
    port.terminate();
  });

  it('runs OUTPUT and completes', async () => {
    const events: WorkerEvent[] = [];
    const port = createInProcessWorkerPort();
    port.onMessage((e) => events.push(e));
    await waitFor(() => events.some((e) => e.type === 'ready'));
    port.postMessage({
      type: 'run',
      sessionId: 1,
      source: 'OUTPUT 7\n',
      breakpoints: [],
    });
    await waitFor(() => events.some((e) => e.type === 'completed'));
    expect(events.some((e) => e.type === 'output' && e.line === '7')).toBe(true);
    port.terminate();
  });

  it('surfaces semantic errors', async () => {
    const events: WorkerEvent[] = [];
    const port = createInProcessWorkerPort();
    port.onMessage((e) => events.push(e));
    await waitFor(() => events.some((e) => e.type === 'ready'));
    port.postMessage({
      type: 'run',
      sessionId: 1,
      source: 'OUTPUT Missing\n',
      breakpoints: [],
    });
    await waitFor(() => events.some((e) => e.type === 'semanticError'));
    port.terminate();
  });

  it('supports INPUT round-trip', async () => {
    const events: WorkerEvent[] = [];
    const port = createInProcessWorkerPort();
    port.onMessage((e) => events.push(e));
    await waitFor(() => events.some((e) => e.type === 'ready'));
    port.postMessage({
      type: 'run',
      sessionId: 1,
      source: `
DECLARE N : INTEGER
INPUT N
OUTPUT N
`,
      breakpoints: [],
    });
    await waitFor(() => events.some((e) => e.type === 'inputRequest'));
    port.postMessage({ type: 'input', sessionId: 1, line: '9' });
    await waitFor(() => events.some((e) => e.type === 'completed'));
    expect(events.some((e) => e.type === 'output' && e.line === '9')).toBe(true);
    port.terminate();
  });

  it('stops an infinite loop', async () => {
    const events: WorkerEvent[] = [];
    const port = createInProcessWorkerPort();
    port.onMessage((e) => events.push(e));
    await waitFor(() => events.some((e) => e.type === 'ready'));
    port.postMessage({
      type: 'run',
      sessionId: 1,
      source: 'WHILE TRUE\nENDWHILE\n',
      breakpoints: [],
    });
    await new Promise((r) => setTimeout(r, 30));
    port.postMessage({ type: 'stop', sessionId: 1 });
    await waitFor(() => events.some((e) => e.type === 'cancelled'), 5000);
    port.terminate();
  });

  it('hits a breakpoint and continues', async () => {
    const events: WorkerEvent[] = [];
    const port = createInProcessWorkerPort();
    port.onMessage((e) => events.push(e));
    await waitFor(() => events.some((e) => e.type === 'ready'));
    port.postMessage({
      type: 'run',
      sessionId: 1,
      source: `
DECLARE N : INTEGER
N ← 1
N ← 2
OUTPUT N
`,
      breakpoints: [{ line: 3, enabled: true }],
    });
    await waitFor(() => events.some((e) => e.type === 'paused'));
    const paused = events.find((e) => e.type === 'paused');
    expect(paused && paused.type === 'paused' && paused.location.line).toBe(3);
    port.postMessage({ type: 'continue', sessionId: 1 });
    await waitFor(() => events.some((e) => e.type === 'completed'));
    port.terminate();
  });

  it('steps into from initial mode', async () => {
    const events: WorkerEvent[] = [];
    const port = createInProcessWorkerPort();
    port.onMessage((e) => events.push(e));
    await waitFor(() => events.some((e) => e.type === 'ready'));
    port.postMessage({
      type: 'run',
      sessionId: 1,
      source: `
OUTPUT 1
OUTPUT 2
`,
      breakpoints: [],
      initialStepMode: 'stepInto',
    });
    await waitFor(() => events.some((e) => e.type === 'paused'));
    port.postMessage({ type: 'stepInto', sessionId: 1 });
    await waitFor(
      () => events.filter((e) => e.type === 'paused').length >= 2,
    );
    port.postMessage({ type: 'continue', sessionId: 1 });
    await waitFor(() => events.some((e) => e.type === 'completed'));
    port.terminate();
  });

  it('runs file I/O through the worker VFS', async () => {
    const events: WorkerEvent[] = [];
    const port = createInProcessWorkerPort();
    port.onMessage((e) => events.push(e));
    await waitFor(() => events.some((e) => e.type === 'ready'));
    port.postMessage({
      type: 'run',
      sessionId: 1,
      source: `
OPENFILE "w.txt" FOR WRITE
WRITEFILE "w.txt", "hello"
CLOSEFILE "w.txt"
OPENFILE "w.txt" FOR READ
DECLARE Line : STRING
READFILE "w.txt", Line
OUTPUT Line
CLOSEFILE "w.txt"
`,
      breakpoints: [],
    });
    await waitFor(() => events.some((e) => e.type === 'completed'));
    expect(events.some((e) => e.type === 'output' && e.line === 'hello')).toBe(
      true,
    );
    port.terminate();
  });
});

describe('WorkerController', () => {
  it('queues commands until ready then runs', async () => {
    const events: WorkerEvent[] = [];
    const wc = new WorkerController({ inProcess: true });
    wc.ensureStarted({ onEvent: (e) => events.push(e) });
    wc.run({
      sessionId: 1,
      source: 'OUTPUT 1\n',
      breakpoints: [],
    });
    await waitFor(() => events.some((e) => e.type === 'completed'));
    wc.terminate();
  });

  it('recreate spawns a fresh port', async () => {
    const events: WorkerEvent[] = [];
    const wc = new WorkerController({ inProcess: true });
    wc.ensureStarted({ onEvent: (e) => events.push(e) });
    await waitFor(() => events.some((e) => e.type === 'ready'));
    wc.recreate();
    await waitFor(() => events.filter((e) => e.type === 'ready').length >= 2);
    wc.run({
      sessionId: 1,
      source: 'OUTPUT 2\n',
      breakpoints: [],
    });
    await waitFor(() => events.some((e) => e.type === 'completed'));
    wc.terminate();
  });
});

describe('RuntimeController via worker', () => {
  let controller: RuntimeController;

  beforeEach(() => {
    controller = new RuntimeController({ worker: { inProcess: true } });
  });

  afterEach(() => {
    controller.dispose();
  });

  it('repeated executions stay stable', async () => {
    for (let i = 0; i < 5; i += 1) {
      await controller.run(`OUTPUT ${i}\n`);
      expect(controller.getSnapshot().state).toBe('completed');
    }
  });

  it('recreateWorker allows a subsequent run', async () => {
    await controller.run(`OUTPUT 1\n`);
    controller.recreateWorker();
    await controller.run(`OUTPUT 2\n`);
    expect(
      controller.getSnapshot().consoleLines.some(
        (l) => l.kind === 'out' && l.text === '2',
      ),
    ).toBe(true);
  });

  it('runs a larger program without hanging', async () => {
    const lines = Array.from({ length: 200 }, (_, i) => `OUTPUT ${i}`).join(
      '\n',
    );
    await controller.run(lines);
    expect(controller.getSnapshot().state).toBe('completed');
    expect(
      controller.getSnapshot().consoleLines.some(
        (l) => l.kind === 'out' && l.text === '199',
      ),
    ).toBe(true);
  });

  it('Stop latency on a tight loop stays under 2s (macrotask yield)', async () => {
    const c = new RuntimeController({ worker: { inProcess: true } });
    const runPromise = c.run(`WHILE TRUE\nENDWHILE\n`);
    await waitFor(() => c.getSnapshot().state === 'running');
    const t0 = Date.now();
    c.stop();
    await runPromise;
    const ms = Date.now() - t0;
    expect(c.getSnapshot().state).toBe('cancelled');
    expect(ms).toBeLessThan(2000);
    c.dispose();
  });

  it('step over works through the worker bridge', async () => {
    const runPromise = controller.stepIntoFromIdle(`
PROCEDURE P
  OUTPUT 1
ENDPROCEDURE
CALL P
OUTPUT 2
`);
    await waitFor(() => controller.getSnapshot().state === 'paused');
    controller.stepOver();
    await waitFor(() => controller.getSnapshot().state === 'paused');
    controller.continue();
    await runPromise;
    expect(controller.getSnapshot().state).toBe('completed');
  });
});

describe('handleWorkerCommand exhaustiveness', () => {
  it('dispatches setBreakpoints during a paused run', async () => {
    const events: WorkerEvent[] = [];
    const post = (e: WorkerEvent) => events.push(e);
    const runner = new WorkerSessionRunner(post);
    handleWorkerCommand(
      runner,
      {
        type: 'run',
        sessionId: 1,
        source: `
DECLARE X : INTEGER
X ← 1
X ← 2
`,
        breakpoints: [],
        initialStepMode: 'stepInto',
      },
      post,
    );
    await waitFor(() => events.some((e) => e.type === 'paused'));
    handleWorkerCommand(
      runner,
      {
        type: 'setBreakpoints',
        sessionId: 1,
        breakpoints: toWireBreakpoints([{ id: 'bp-1', line: 3, enabled: true }]),
      },
      post,
    );
    handleWorkerCommand(runner, { type: 'continue', sessionId: 1 }, post);
    await waitFor(() => events.some((e) => e.type === 'paused' && e.location.line === 3));
    handleWorkerCommand(runner, { type: 'continue', sessionId: 1 }, post);
    await waitFor(() => events.some((e) => e.type === 'completed'));
  });
});

async function waitFor(pred: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor timeout');
    }
    await new Promise((r) => setTimeout(r, 5));
  }
}
