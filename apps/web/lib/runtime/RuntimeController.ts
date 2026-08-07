import {
  BreakpointStore,
  type Breakpoint,
  type CallStackFrameView,
  type PauseLocation,
  type StepMode,
} from '@/lib/debugger';
import {
  WorkerController,
  toWireBreakpoints,
  type WorkerControllerOptions,
  type WorkerEvent,
  type WireVariable,
} from '@/lib/worker';
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

export type RuntimeControllerOptions = {
  /** Worker transport options (tests force in-process). */
  readonly worker?: WorkerControllerOptions;
};

/**
 * Owns IDE runtime UI state. Execution runs in a dedicated Web Worker via
 * {@link WorkerController} — the UI thread never calls `runPseudocode`.
 */
export class RuntimeController {
  private state: ExecutionState = 'idle';
  private consoleLines: RuntimeConsoleLine[] = [];
  private diagnostics: RuntimeDiagnosticView[] = [];
  private variables: RuntimeVariableRow[] = [];
  private frameName: string | null = null;
  private steps = 0;
  /** Bumped to ignore stale worker events after Stop/Restart. */
  private generation = 0;
  /** sessionId posted to the worker for the in-flight run. */
  private runSessionId = 0;
  private lastSource = '';
  private readonly listeners = new Set<() => void>();
  private snapshot: RuntimeSnapshot = emptySnapshot();

  private readonly breakpoints = new BreakpointStore();
  private pauseLocation: PauseLocation | null = null;
  private callStack: CallStackFrameView[] = [];
  private runPromise: Promise<void> | null = null;
  private settleRun: (() => void) | null = null;

  private readonly worker: WorkerController;

  constructor(options: RuntimeControllerOptions = {}) {
    this.worker = new WorkerController(
      options.worker ?? { inProcess: typeof Worker === 'undefined' },
    );
    this.worker.ensureStarted({
      onEvent: (event) => this.onWorkerEvent(event),
    });
    this.breakpoints.subscribe(() => {
      this.emit();
      if (this.isBusy() && this.runSessionId !== 0) {
        this.worker.setBreakpoints(
          this.runSessionId,
          toWireBreakpoints(this.breakpoints.list()),
        );
      }
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

  /** Test / diagnostics: how many times the worker was recreated after crash. */
  getWorkerCrashCount(): number {
    return this.worker.getCrashCount();
  }

  /** Force a fresh worker instance (crash recovery / recreate). */
  recreateWorker(): void {
    this.worker.recreate();
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
    const sid = this.runSessionId;
    this.generation += 1;
    this.worker.stop(sid);
    this.pauseLocation = null;
    this.callStack = [];
    this.setState('cancelled');
    this.pushConsole('info', 'Execution stopped.');
    this.finishRunPromise();
    this.emit();
  }

  pause(): void {
    if (this.state !== 'running') return;
    this.worker.pause(this.runSessionId);
  }

  continue(): void {
    if (this.state !== 'paused') return;
    this.setState('running');
    this.emit();
    this.worker.continue(this.runSessionId);
  }

  stepInto(): void {
    if (this.state !== 'paused') return;
    this.setState('running');
    this.emit();
    this.worker.stepInto(this.runSessionId);
  }

  stepOver(): void {
    if (this.state !== 'paused') return;
    this.setState('running');
    this.emit();
    this.worker.stepOver(this.runSessionId);
  }

  stepOut(): void {
    if (this.state !== 'paused') return;
    this.setState('running');
    this.emit();
    this.worker.stepOut(this.runSessionId);
  }

  async stepIntoFromIdle(source: string): Promise<void> {
    if (this.state === 'paused') {
      this.stepInto();
      return;
    }
    if (this.isBusy()) return;
    await this.run(source, { initialStepMode: 'stepInto' });
  }

  submitInput(line: string): void {
    if (this.state !== 'waitingForInput') return;
    this.pushConsole('in', line);
    this.setState('running');
    this.worker.input(this.runSessionId, line);
    this.emit();
  }

  async restart(source?: string): Promise<void> {
    const src = source ?? this.lastSource;
    if (this.isBusy()) {
      const sid = this.runSessionId;
      this.generation += 1;
      this.worker.stop(sid);
      this.setState('cancelled');
      this.finishRunPromise();
    }
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

  private executeRun(
    source: string,
    options: RunOptions = {},
  ): Promise<void> {
    this.lastSource = source;
    this.generation += 1;
    const gen = this.generation;
    this.runSessionId = gen;

    this.diagnostics = [];
    this.variables = [];
    this.frameName = null;
    this.steps = 0;
    this.pauseLocation = null;
    this.callStack = [];
    this.pushConsole('info', 'Running…');
    this.setState('running');
    this.emit();

    return new Promise<void>((resolve) => {
      this.settleRun = resolve;
      this.worker.run({
        sessionId: gen,
        source,
        breakpoints: toWireBreakpoints(this.breakpoints.list()),
        initialStepMode: options.initialStepMode,
      });
    });
  }

  private onWorkerEvent(event: WorkerEvent): void {
    if (event.type === 'ready' || event.type === 'pong') return;

    if (event.type === 'workerError') {
      if (event.sessionId === null) {
        // Transport crash — recreate is handled by WorkerController.
        return;
      }
      if (event.sessionId !== this.generation) return;
      this.diagnostics = [
        {
          id: nextDiagId(),
          severity: 'error',
          code: 'R_WORKER',
          message: event.message,
        },
      ];
      this.setState('runtimeError');
      this.finishRunPromise();
      this.emit();
      return;
    }

    if (!('sessionId' in event) || event.sessionId !== this.generation) {
      return;
    }

    switch (event.type) {
      case 'output':
        this.pushConsole('out', event.line);
        this.emit();
        return;
      case 'inputRequest':
        this.setState('waitingForInput');
        this.pushConsole('info', 'Waiting for INPUT…');
        this.emit();
        return;
      case 'paused':
        this.pauseLocation = event.location;
        this.callStack = [...event.callStack];
        this.steps = event.location.step;
        this.variables = wireToRows(event.variables);
        this.frameName =
          event.location.frameKind === 'global' ? null : event.location.frameName;
        this.setState('paused');
        this.pushConsole(
          'info',
          `Paused at line ${event.location.line} (${event.location.frameName}).`,
        );
        this.emit();
        return;
      case 'resumed':
        this.pauseLocation = null;
        if (this.state === 'paused') {
          this.setState('running');
        }
        this.emit();
        return;
      case 'progress':
        this.steps = event.steps;
        // Do not emit every progress tick — avoids UI thrash. Snapshot updates
        // on pause / terminal / OUTPUT are enough for responsiveness.
        return;
      case 'completed':
        this.steps = event.steps;
        this.variables = wireToRows(event.variables);
        this.frameName = event.frameName;
        this.pauseLocation = null;
        this.callStack = [];
        this.setState('completed');
        this.pushConsole('info', 'Program finished.');
        this.finishRunPromise();
        this.emit();
        return;
      case 'semanticError':
        this.diagnostics = event.diagnostics.map(mapWireDiag);
        this.pauseLocation = null;
        this.callStack = [];
        this.setState('semanticError');
        this.finishRunPromise();
        this.emit();
        return;
      case 'runtimeError':
        this.steps = event.steps;
        this.diagnostics = event.diagnostics.map(mapWireDiag);
        this.variables = wireToRows(event.variables);
        this.frameName = event.frameName;
        this.pauseLocation = null;
        this.callStack = [];
        this.setState('runtimeError');
        this.finishRunPromise();
        this.emit();
        return;
      case 'cancelled':
        this.steps = event.steps;
        this.pauseLocation = null;
        this.callStack = [];
        // Stop() may have already set cancelled + settled.
        if (this.state !== 'cancelled') {
          this.setState('cancelled');
        }
        this.finishRunPromise();
        this.emit();
        return;
      default: {
        const _exhaustive: never = event;
        return _exhaustive;
      }
    }
  }

  private finishRunPromise(): void {
    const settle = this.settleRun;
    this.settleRun = null;
    settle?.();
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
      { id: nextLineId(), kind, text, at: Date.now() },
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

  /** Dispose worker when resetting the singleton. */
  dispose(): void {
    if (this.isBusy()) {
      this.stop();
    }
    this.worker.terminate();
  }
}

function wireToRows(vars: readonly WireVariable[]): RuntimeVariableRow[] {
  return vars.map((v) => ({
    name: v.name,
    type: v.type,
    value: v.value,
    kind: v.kind,
    scope: v.scope,
  }));
}

function mapWireDiag(d: {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  line?: number;
  column?: number;
  help?: string;
}): RuntimeDiagnosticView {
  const base: RuntimeDiagnosticView = {
    id: nextDiagId(),
    severity: d.severity,
    code: d.code,
    message: d.message,
  };
  const withLoc =
    d.line !== undefined
      ? { ...base, line: d.line, column: d.column }
      : base;
  return d.help !== undefined ? { ...withLoc, help: d.help } : withLoc;
}

let shared: RuntimeController | null = null;

export function getRuntimeController(): RuntimeController {
  if (!shared) shared = new RuntimeController();
  return shared;
}

/** Test helper — reset singleton between tests. */
export function resetRuntimeControllerForTests(): RuntimeController {
  if (shared) {
    shared.dispose();
  }
  shared = new RuntimeController({ worker: { inProcess: true } });
  return shared;
}
