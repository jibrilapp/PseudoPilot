import { describe, expect, it, beforeEach } from 'vitest';
import { BreakpointStore } from './BreakpointStore';
import { DebuggerSession } from './DebuggerSession';
import type { StackFrame } from '@pseudopilot/interpreter';
import { Environment } from '@pseudopilot/interpreter';

describe('BreakpointStore', () => {
  let store: BreakpointStore;

  beforeEach(() => {
    store = new BreakpointStore();
  });

  it('toggles add → disable → remove', () => {
    expect(store.toggle(3)?.enabled).toBe(true);
    expect(store.hasEnabled(3)).toBe(true);
    expect(store.toggle(3)?.enabled).toBe(false);
    expect(store.hasEnabled(3)).toBe(false);
    expect(store.toggle(3)).toBeNull();
    expect(store.get(3)).toBeUndefined();
  });

  it('supports multiple breakpoints', () => {
    store.add(1);
    store.add(5);
    store.add(9, false);
    expect(store.list().map((b) => b.line)).toEqual([1, 5, 9]);
    expect(store.enabledCount()).toBe(2);
  });

  it('setEnabled and remove', () => {
    store.add(2);
    store.setEnabled(2, false);
    expect(store.hasEnabled(2)).toBe(false);
    store.remove(2);
    expect(store.list()).toEqual([]);
  });
});

describe('DebuggerSession stepping', () => {
  function frame(name: string, depthHint: number): StackFrame {
    void depthHint;
    return {
      id: depthHint,
      kind: depthHint === 1 ? 'global' : 'function',
      name,
      env: new Environment(null),
    };
  }

  it('parks on enabled breakpoint then continues', async () => {
    const store = new BreakpointStore();
    store.add(2);
    let paused = 0;
    const session = new DebuggerSession(store, {
      onPause: () => {
        paused += 1;
      },
      onResume: () => {},
    });
    const hooks = session.createHooks();

    const p = hooks.onBeforeStatement!({
      span: {
        start: { offset: 0, line: 2, column: 1 },
        end: { offset: 1, line: 2, column: 2 },
      },
      frame: frame('<global>', 1),
      step: 1,
      depth: 1,
    });

    await new Promise((r) => setTimeout(r, 5));
    expect(paused).toBe(1);
    expect(session.isParked()).toBe(true);
    session.continue();
    await p;
    expect(session.isParked()).toBe(false);
  });

  it('stepOver pauses only at same or shallower depth', async () => {
    const store = new BreakpointStore();
    const session = new DebuggerSession(store, {
      onPause: () => {},
      onResume: () => {},
    });
    session.setInitialMode('stepInto');
    const hooks = session.createHooks();

    // First statement parks (stepInto).
    const first = hooks.onBeforeStatement!({
      span: {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 1, line: 1, column: 2 },
      },
      frame: frame('<global>', 1),
      step: 1,
      depth: 1,
    });
    await waitParked(session);
    session.stepOver();
    await first;

    // Deeper frame should not pause for stepOver.
    const deeper = Promise.resolve(
      hooks.onBeforeStatement!({
        span: {
          start: { offset: 0, line: 5, column: 1 },
          end: { offset: 1, line: 5, column: 2 },
        },
        frame: frame('Foo', 2),
        step: 2,
        depth: 2,
      }),
    );
    const raced = await Promise.race([
      deeper.then(() => 'done'),
      new Promise<'wait'>((r) => setTimeout(() => r('wait'), 30)),
    ]);
    expect(raced).toBe('done');

    // Same depth should pause.
    const same = hooks.onBeforeStatement!({
      span: {
        start: { offset: 0, line: 6, column: 1 },
        end: { offset: 1, line: 6, column: 2 },
      },
      frame: frame('<global>', 1),
      step: 3,
      depth: 1,
    });
    await waitParked(session);
    session.continue();
    await same;
  });

  it('stepOver still pauses on an enabled breakpoint inside a deeper frame', async () => {
    const store = new BreakpointStore();
    store.add(9);
    const session = new DebuggerSession(store, {
      onPause: () => {},
      onResume: () => {},
    });
    session.setInitialMode('stepInto');
    const hooks = session.createHooks();

    const first = hooks.onBeforeStatement!({
      span: {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 1, line: 1, column: 2 },
      },
      frame: frame('<global>', 1),
      step: 1,
      depth: 1,
    });
    await waitParked(session);
    session.stepOver();
    await first;

    const deeper = hooks.onBeforeStatement!({
      span: {
        start: { offset: 0, line: 9, column: 1 },
        end: { offset: 1, line: 9, column: 2 },
      },
      frame: frame('Foo', 2),
      step: 2,
      depth: 2,
    });
    await waitParked(session);
    expect(session.isParked()).toBe(true);
    session.continue();
    await deeper;
  });
});

async function waitParked(session: DebuggerSession, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (!session.isParked()) {
    if (Date.now() - start > timeoutMs) throw new Error('not parked');
    await new Promise((r) => setTimeout(r, 5));
  }
}
