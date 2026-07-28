import {
  formatValue,
  runPseudocode,
  type StackFrame,
} from '@pseudopilot/interpreter';
import {
  BreakpointStore,
  DebuggerSession,
  type Breakpoint,
  type CallStackFrameView,
  type PauseLocation,
  type StepMode,
} from '@/lib/debugger';
import { IdeRuntimeHost } from './IdeRuntimeHost';
import {
  canTransition,
  type ExecutionState,
  type RuntimeConsoleLine,
  type RuntimeDiagnosticView,
  type RuntimeSnapshot,
  type RuntimeVariableRow,
} from './types';

let lineSeq = 0;
let diagSeq = 0;

/** Soft cap so infinite OUTPUT loops cannot unbounded-grow the UI store. */
export const MAX_CONSOLE_LINES = 2000;

function nextLineId(): string {
  lineSeq += 1;
  return `rl-${lineSeq}`;
}

function nextDiagId(): string {
  diagSeq += 1;
  return `rd-${diagSeq}`;
}

function emptySnapshot(): RuntimeSnapshot {
  return {
    state: 'idle',
    consoleLines: [],
    diagnostics: [],
    variables: [],
    frameName: null,
    steps: 0,
    awaitingInput: false,
    paused: false,
    pauseLocation: null,
    callStack: [],
    breakpoints: [],
  };
}

export type RunOptions = {
  /** Initial step mode (e.g. `stepInto` to stop on the first statement). */
  readonly initialStepMode?: StepMode;
};

/**
 * Owns interpreter + debugger sessions for the web IDE.
 * React components subscribe to snapshots; they never call the interpreter directly.
 */
export class RuntimeController {
  private state: ExecutionState = 'idle';
  private consoleLines: RuntimeConsoleLine[] = [];
  private diagnostics: RuntimeDiagnosticView[] = [];
  private variables: RuntimeVariableRow[] = [];
  private frameName: string | null = null;
  private steps = 0;
  private generation = 0;
  private abort: AbortController | null = null;
  private host: IdeRuntimeHost | null = null;
  private lastSource = '';
  private varTick = 0;
  private readonly listeners = new Set<() => void>();
  private snapshot: RuntimeSnapshot = emptySnapshot();

  private readonly breakpoints = new BreakpointStore();
  private debugSession: DebuggerSession | null = null;
  private pauseLocation: PauseLocation | null = null;
  private callStack: CallStackFrameView[] = [];
  /** In-flight `run()` promise — Restart awaits this so interpreters never overlap. */
  private runPromise: Promise<void> | null = null;

  constructor() {
    this.breakpoints.subscribe(() => {
      this.emit();
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): RuntimeSnapshot {
    return this.snapshot;
  }

  isBusy(): boolean {
    return (
      this.state === 'running' ||
      this.state === 'waitingForInput' ||
      this.state === 'paused'
    );
  }

  clearConsole(): void {
    this.consoleLines = [];
    if (!this.isBusy()) {
      this.diagnostics = [];
    }
    this.emit();
  }

  toggleBreakpoint(line: number): void {
    this.breakpoints.toggle(line);
  }

  setBreakpointEnabled(line: number, enabled: boolean): void {
    this.breakpoints.setEnabled(line, enabled);
  }

  removeBreakpoint(line: number): void {
    this.breakpoints.remove(line);
  }

  clearBreakpoints(): void {
    this.breakpoints.clear();
  }

  getBreakpoints(): readonly Breakpoint[] {
    return this.breakpoints.list();
  }

  stop(): void {
    if (!this.isBusy()) return;
    this.debugSession?.cancel();
    this.invalidateSession();
    this.pauseLocation = null;
    this.callStack = [];
    this.setState('cancelled');
    this.pushConsole('info', 'Execution stopped.');
    this.emit();
  }

  pause(): void {
    if (this.state !== 'running') return;
    this.debugSession?.requestPause();
  }

  continue(): void {
    if (this.state !== 'paused' || !this.debugSession) return;
    this.setState('running');
    this.emit();
    this.debugSession.continue();
  }

  stepInto(): void {
    if (this.state === 'paused' && this.debugSession) {
      this.setState('running');
      this.emit();
      this.debugSession.stepInto();
      return;
    }
  }

  stepOver(): void {
    if (this.state !== 'paused' || !this.debugSession) return;
    this.setState('running');
    this.emit();
    this.debugSession.stepOver();
  }

  stepOut(): void {
    if (this.state !== 'paused' || !this.debugSession) return;
    this.setState('running');
    this.emit();
    this.debugSession.stepOut();
  }

  /**
   * Start (or resume-by-rerun) stepping from the first statement when idle.
   * When already paused, delegates to {@link stepInto}.
   */
  async stepIntoFromIdle(source: string): Promise<void> {
    if (this.state === 'paused') {
      this.stepInto();
      return;
    }
    if (this.isBusy()) return;
    await this.run(source, { initialStepMode: 'stepInto' });
  }

  submitInput(line: string): void {
    if (this.state !== 'waitingForInput' || !this.host) return;
    this.pushConsole('in', line);
    this.setState('running');
    this.host.submitInput(line);
    this.emit();
  }

  async restart(source?: string): Promise<void> {
    const src = source ?? this.lastSource;
    if (this.isBusy()) {
      this.debugSession?.cancel();
      this.invalidateSession();
      this.setState('cancelled');
    }
    // Drain the previous interpreter so we never run two sessions at once.
    const previous = this.runPromise;
    if (previous) {
      await previous.catch(() => undefined);
    }
    this.consoleLines = [];
    this.diagnostics = [];
    this.variables = [];
    this.frameName = null;
    this.steps = 0;
    this.pauseLocation = null;
    this.callStack = [];
    this.emit();
    await this.run(src);
  }

  async run(source: string, options: RunOptions = {}): Promise<void> {
    if (this.isBusy()) {
      return;
    }

    const task = this.executeRun(source, options);
    this.runPromise = task;
    try {
      await task;
    } finally {
      if (this.runPromise === task) {
        this.runPromise = null;
      }
    }
  }

  private async executeRun(
    source: string,
    options: RunOptions = {},
  ): Promise<void> {
    this.lastSource = source;
    this.generation += 1;
    const gen = this.generation;

    this.diagnostics = [];
    this.variables = [];
    this.frameName = null;
    this.steps = 0;
    this.varTick = 0;
    this.pauseLocation = null;
    this.callStack = [];
    this.pushConsole('info', 'Running…');

    const abort = new AbortController();
    this.abort = abort;

    const session = new DebuggerSession(this.breakpoints, {
      onPause: ({ location, callStack, frame }) => {
        if (gen !== this.generation) return;
        this.pauseLocation = location;
        this.callStack = [...callStack];
        this.steps = location.step;
        this.refreshVariablesFromFrame(frame);
        this.setState('paused');
        this.pushConsole(
          'info',
          `Paused at line ${location.line} (${location.frameName}).`,
        );
        this.emit();
      },
      onResume: () => {
        if (gen !== this.generation) return;
        this.pauseLocation = null;
        // State may already be `running` from continue/step; keep call stack until next pause.
        if (this.state === 'paused') {
          this.setState('running');
        }
        this.emit();
      },
    });
    if (options.initialStepMode) {
      session.setInitialMode(options.initialStepMode);
    }
    this.debugSession = session;
    const debugHooks = session.createHooks();

    const host = new IdeRuntimeHost(
      (line) => {
        if (gen !== this.generation) return;
        this.pushConsole('out', line);
        this.emit();
      },
      {
        onWaiting: () => {
          if (gen !== this.generation) return;
          this.setState('waitingForInput');
          this.pushConsole('info', 'Waiting for INPUT…');
          this.emit();
        },
        onResolved: () => {
          /* submitInput / cancelInput owns transitions */
        },
      },
    );
    this.host = host;
    this.setState('running');
    this.emit();

    try {
      const result = await runPseudocode(source, {
        host,
        signal: abort.signal,
        debugger: {
          onEnterFrame: debugHooks.onEnterFrame,
          onExitFrame: debugHooks.onExitFrame,
          onBeforeStatement: async (info) => {
            if (gen !== this.generation) return 'continue';
            this.steps = info.step;

            const action = await debugHooks.onBeforeStatement?.(info);

            if (gen !== this.generation) return 'continue';

            // Throttled live vars while running (full refresh on pause).
            if (this.state === 'running') {
              this.varTick += 1;
              const refresh =
                info.frame.kind === 'global'
                  ? this.varTick % 8 === 0
                  : this.varTick % 4 === 0;
              if (refresh) {
                this.refreshVariablesFromFrame(info.frame);
                this.emit();
              }
            }

            return action;
          },
        },
      });

      if (gen !== this.generation) return;

      this.steps = result.steps;
      this.applyFinalSnapshots(result.globals, result.callStack);
      this.pauseLocation = null;
      this.callStack = [];

      if (!result.ok) {
        // Structured diagnostics are rendered by ConsolePanel; avoid duplicating
        // the same messages as plain console error lines.
        const views = result.diagnostics.map(mapDiagnostic);
        this.diagnostics = views;
        const code = result.diagnostics[0]?.code ?? '';
        if (code.startsWith('C_') || code.startsWith('E_')) {
          this.setState('semanticError');
        } else if (code === 'R_CANCELLED') {
          this.setState('cancelled');
        } else {
          this.setState('runtimeError');
        }
      } else if (abort.signal.aborted) {
        this.setState('cancelled');
      } else {
        this.setState('completed');
        this.pushConsole('info', 'Program finished.');
      }
    } catch (e) {
      if (gen !== this.generation) return;
      if (abort.signal.aborted || isAbortLike(e)) {
        this.setState('cancelled');
      } else {
        const message =
          e instanceof Error ? e.message : 'Unexpected runtime failure.';
        this.diagnostics = [
          {
            id: nextDiagId(),
            severity: 'error',
            code: 'R_INTERNAL',
            message,
          },
        ];
        this.setState('runtimeError');
      }
    } finally {
      if (gen === this.generation) {
        this.debugSession = null;
        this.teardownSession();
        this.emit();
      }
    }
  }

  private invalidateSession(): void {
    this.generation += 1;
    this.host?.cancelInput();
    this.abort?.abort();
    this.debugSession = null;
    this.teardownSession();
  }

  private refreshVariablesFromFrame(frame: StackFrame): void {
    const rows: RuntimeVariableRow[] = [];
    if (frame.kind === 'global') {
      for (const b of frame.env.snapshot().values()) {
        rows.push({
          name: b.name,
          type: b.typeName,
          value: formatValue(b.value),
          kind: b.kind,
          scope: scopeOf(b.kind, 'global'),
        });
      }
      this.frameName = null;
    } else {
      const parent = frame.env.parent;
      if (parent) {
        for (const b of parent.snapshot().values()) {
          rows.push({
            name: b.name,
            type: b.typeName,
            value: formatValue(b.value),
            kind: b.kind,
            scope: scopeOf(b.kind, 'global'),
          });
        }
      }
      for (const b of frame.env.snapshot().values()) {
        rows.push({
          name: b.name,
          type: b.typeName,
          value: formatValue(b.value),
          kind: b.kind,
          scope: scopeOf(b.kind, 'local'),
        });
      }
      this.frameName = frame.name;
    }
    this.variables = rows;
  }

  private applyFinalSnapshots(
    globals: readonly {
      name: string;
      kind: string;
      typeName: string;
      value: string;
    }[],
    callStack: readonly {
      kind: string;
      name: string;
      variables: readonly {
        name: string;
        kind: string;
        typeName: string;
        value: string;
      }[];
    }[],
  ): void {
    const rows: RuntimeVariableRow[] = [];
    for (const g of globals) {
      rows.push({
        name: g.name,
        type: g.typeName,
        value: g.value,
        kind: g.kind,
        scope: scopeOf(g.kind, 'global'),
      });
    }
    const top = callStack[0];
    if (top && top.kind !== 'global') {
      this.frameName = top.name;
      for (const v of top.variables) {
        rows.push({
          name: v.name,
          type: v.typeName,
          value: v.value,
          kind: v.kind,
          scope: scopeOf(v.kind, 'local'),
        });
      }
    } else {
      this.frameName = null;
    }
    this.variables = rows;
  }

  private teardownSession(): void {
    this.host = null;
    this.abort = null;
  }

  private setState(next: ExecutionState): void {
    if (canTransition(this.state, next) || next === this.state) {
      this.state = next;
      return;
    }
    if (
      next === 'cancelled' ||
      next === 'runtimeError' ||
      next === 'completed' ||
      next === 'semanticError' ||
      next === 'idle' ||
      next === 'paused' ||
      next === 'running' ||
      next === 'waitingForInput'
    ) {
      this.state = next;
    }
  }

  private pushConsole(kind: RuntimeConsoleLine['kind'], text: string): void {
    const next = [
      ...this.consoleLines,
      { id: nextLineId(), kind, text },
    ];
    this.consoleLines =
      next.length > MAX_CONSOLE_LINES
        ? next.slice(next.length - MAX_CONSOLE_LINES)
        : next;
  }

  private rebuildSnapshot(): void {
    this.snapshot = {
      state: this.state,
      consoleLines: this.consoleLines,
      diagnostics: this.diagnostics,
      variables: this.variables,
      frameName: this.frameName,
      steps: this.steps,
      awaitingInput: this.state === 'waitingForInput',
      paused: this.state === 'paused',
      pauseLocation: this.pauseLocation,
      callStack: this.callStack,
      breakpoints: this.breakpoints.list(),
    };
  }

  private emit(): void {
    this.rebuildSnapshot();
    for (const l of this.listeners) l();
  }
}

function scopeOf(
  kind: string,
  fallback: 'global' | 'local',
): RuntimeVariableRow['scope'] {
  if (kind === 'constant') return 'constant';
  if (kind === 'parameter') return 'parameter';
  return fallback;
}

function mapDiagnostic(d: {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  span?: { start: { line: number; column: number } };
  help?: string;
}): RuntimeDiagnosticView {
  const base: RuntimeDiagnosticView = {
    id: nextDiagId(),
    severity: d.severity,
    code: d.code,
    message: d.message,
  };
  const withSpan =
    d.span !== undefined
      ? { ...base, line: d.span.start.line, column: d.span.start.column }
      : base;
  return d.help !== undefined ? { ...withSpan, help: d.help } : withSpan;
}

function isAbortLike(e: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' &&
      e instanceof DOMException &&
      e.name === 'AbortError') ||
    (e instanceof Error && e.name === 'AbortError')
  );
}

let shared: RuntimeController | null = null;

export function getRuntimeController(): RuntimeController {
  if (!shared) shared = new RuntimeController();
  return shared;
}

/** Test helper — reset singleton between tests. */
export function resetRuntimeControllerForTests(): RuntimeController {
  if (shared) {
    shared.stop();
  }
  shared = new RuntimeController();
  return shared;
}
