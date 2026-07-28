import {
  formatValue,
  runPseudocode,
  type StackFrame,
} from '@pseudopilot/interpreter';
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
  };
}

/**
 * Owns interpreter sessions for the web IDE.
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
  /** Stable reference for useSyncExternalStore (Object.is). */
  private snapshot: RuntimeSnapshot = emptySnapshot();

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
    return this.state === 'running' || this.state === 'waitingForInput';
  }

  clearConsole(): void {
    this.consoleLines = [];
    if (!this.isBusy()) {
      this.diagnostics = [];
    }
    this.emit();
  }

  stop(): void {
    if (!this.isBusy()) return;
    // Bump generation first so in-flight runPseudocode cannot overwrite UI state.
    this.invalidateSession();
    this.setState('cancelled');
    this.pushConsole('info', 'Execution stopped.');
    this.emit();
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
      this.invalidateSession();
      this.setState('cancelled');
    }
    this.consoleLines = [];
    this.diagnostics = [];
    this.variables = [];
    this.frameName = null;
    this.steps = 0;
    this.emit();
    await this.run(src);
  }

  async run(source: string): Promise<void> {
    if (this.isBusy()) {
      return;
    }

    this.lastSource = source;
    this.generation += 1;
    const gen = this.generation;

    this.diagnostics = [];
    this.variables = [];
    this.frameName = null;
    this.steps = 0;
    this.varTick = 0;
    this.pushConsole('info', 'Running…');

    const abort = new AbortController();
    this.abort = abort;

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
          onBeforeStatement: ({ frame, step }) => {
            if (gen !== this.generation) return;
            this.steps = step;
            this.varTick += 1;
            // Throttle variable panel updates to limit React churn.
            if (this.varTick % 8 !== 0 && frame.kind === 'global') return;
            if (this.varTick % 8 !== 0 && frame.kind !== 'global') {
              if (this.varTick % 4 !== 0) return;
            }
            this.refreshVariablesFromFrame(frame);
            this.emit();
          },
        },
      });

      if (gen !== this.generation) return;

      this.steps = result.steps;
      this.applyFinalSnapshots(result.globals, result.callStack);

      if (!result.ok) {
        const views = result.diagnostics.map(mapDiagnostic);
        this.diagnostics = views;
        for (const d of views) {
          this.pushConsole('error', formatDiag(d));
        }
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
        this.pushConsole('error', `[R_INTERNAL] ${message}`);
        this.setState('runtimeError');
      }
    } finally {
      if (gen === this.generation) {
        this.teardownSession();
        this.emit();
      }
    }
  }

  /**
   * Invalidate the active session so late async callbacks / results are ignored.
   * Always bumps {@link generation} before aborting so Stop/Restart cannot race
   * with in-flight `runPseudocode` applying diagnostics or console lines.
   */
  private invalidateSession(): void {
    this.generation += 1;
    this.host?.cancelInput();
    this.abort?.abort();
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
    // Allow forced terminal transitions from any active state.
    if (
      next === 'cancelled' ||
      next === 'runtimeError' ||
      next === 'completed' ||
      next === 'semanticError' ||
      next === 'idle'
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

function formatDiag(d: RuntimeDiagnosticView): string {
  const loc = d.line != null ? `Line ${d.line}: ` : '';
  const help = d.help ? ` — ${d.help}` : '';
  return `[${d.code}] ${loc}${d.message}${help}`;
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
