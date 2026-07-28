import {
  formatValue,
  type DebuggerHooks,
  type StackFrame,
  type StatementHookInfo,
} from '@pseudopilot/interpreter';
import type { BreakpointStore } from './BreakpointStore';
import type {
  CallStackFrameView,
  PauseLocation,
  StepMode,
} from './types';

export type DebuggerSessionCallbacks = {
  readonly onPause: (info: {
    location: PauseLocation;
    callStack: readonly CallStackFrameView[];
    frame: StackFrame;
  }) => void;
  readonly onResume: () => void;
};

/**
 * Owns stepping policy and the async pause gate for one interpreter run.
 * Breakpoints live in {@link BreakpointStore} (shared across runs).
 */
export class DebuggerSession {
  private mode: StepMode = 'continue';
  private pauseDepth = 1;
  private pauseRequested = false;
  private gate: {
    resolve: () => void;
    reject: (reason?: unknown) => void;
  } | null = null;
  private cancelled = false;
  private readonly frameStack: StackFrame[] = [];
  private pausedLocation: PauseLocation | null = null;

  constructor(
    private readonly breakpoints: BreakpointStore,
    private readonly callbacks: DebuggerSessionCallbacks,
  ) {}

  getPauseLocation(): PauseLocation | null {
    return this.pausedLocation;
  }

  isParked(): boolean {
    return this.gate !== null;
  }

  /** Request pause at the next statement boundary (Pause button). */
  requestPause(): void {
    this.pauseRequested = true;
  }

  continue(): void {
    this.mode = 'continue';
    this.pauseRequested = false;
    this.releaseGate();
  }

  stepInto(): void {
    this.mode = 'stepInto';
    this.pauseRequested = false;
    this.releaseGate();
  }

  stepOver(): void {
    this.mode = 'stepOver';
    this.pauseDepth =
      this.pausedLocation?.depth ?? (this.frameStack.length || 1);
    this.pauseRequested = false;
    this.releaseGate();
  }

  stepOut(): void {
    this.mode = 'stepOut';
    this.pauseDepth =
      this.pausedLocation?.depth ?? (this.frameStack.length || 1);
    this.pauseRequested = false;
    this.releaseGate();
  }

  /** Used when starting a run that should stop on the first statement. */
  setInitialMode(mode: StepMode): void {
    this.mode = mode;
  }

  /** Reject a parked wait (Stop / session invalidate). */
  cancel(reason: unknown = new DOMException('Aborted', 'AbortError')): void {
    this.cancelled = true;
    this.pauseRequested = false;
    this.pausedLocation = null;
    const g = this.gate;
    this.gate = null;
    if (g) g.reject(reason);
  }

  createHooks(): DebuggerHooks {
    return {
      onEnterFrame: (frame) => {
        this.frameStack.push(frame);
      },
      onExitFrame: (frame) => {
        for (let i = this.frameStack.length - 1; i >= 0; i -= 1) {
          if (this.frameStack[i]!.id === frame.id) {
            this.frameStack.splice(i, 1);
            break;
          }
        }
      },
      onBeforeStatement: async (info): Promise<'continue'> => {
        if (this.cancelled) return 'continue';
        if (!this.shouldPause(info)) return 'continue';
        await this.park(info);
        return 'continue';
      },
    };
  }

  private shouldPause(info: StatementHookInfo): boolean {
    if (this.pauseRequested) return true;
    const onBreakpoint = this.breakpoints.hasEnabled(info.span.start.line);
    switch (this.mode) {
      case 'stepInto':
        return true;
      case 'stepOver':
        // Match common IDE behaviour: still stop on breakpoints inside the
        // skipped callee (or elsewhere) while stepping over/out.
        return info.depth <= this.pauseDepth || onBreakpoint;
      case 'stepOut':
        return info.depth < this.pauseDepth || onBreakpoint;
      case 'continue':
      default:
        return onBreakpoint;
    }
  }

  private async park(info: StatementHookInfo): Promise<void> {
    if (this.cancelled) return;

    const location: PauseLocation = {
      line: info.span.start.line,
      column: info.span.start.column,
      step: info.step,
      depth: info.depth,
      frameName: info.frame.name,
      frameKind: info.frame.kind,
    };
    this.pausedLocation = location;
    this.pauseRequested = false;

    // After a step lands, further Continue only hits breakpoints unless
    // the user chooses another step command.
    this.mode = 'continue';

    this.callbacks.onPause({
      location,
      callStack: this.snapshotCallStack(info),
      frame: info.frame,
    });

    try {
      await new Promise<void>((resolve, reject) => {
        this.gate = { resolve, reject };
      });
    } finally {
      this.gate = null;
      this.pausedLocation = null;
      if (!this.cancelled) {
        this.callbacks.onResume();
      }
    }
  }

  private releaseGate(): void {
    const g = this.gate;
    if (!g) return;
    this.gate = null;
    g.resolve();
  }

  private snapshotCallStack(info: StatementHookInfo): CallStackFrameView[] {
    const frames =
      this.frameStack.length > 0 ? [...this.frameStack] : [info.frame];
    // Top-first for UI.
    return frames
      .slice()
      .reverse()
      .map((f, index) => {
        const args: { name: string; value: string }[] = [];
        for (const b of f.env.snapshot().values()) {
          if (b.kind === 'parameter') {
            args.push({ name: b.name, value: formatValue(b.value) });
          }
        }
        const line =
          index === 0
            ? info.span.start.line
            : (f.callSpan?.start.line ?? null);
        return {
          id: f.id,
          name: f.name,
          kind: f.kind,
          line,
          args,
        };
      });
  }
}
