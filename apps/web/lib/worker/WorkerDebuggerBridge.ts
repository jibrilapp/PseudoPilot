/**
 * Bridges DebuggerSession to worker events.
 * Pause gate stays in-worker (with the interpreter); UI only receives snapshots.
 */

import type { StackFrame } from '@pseudopilot/interpreter';
import {
  BreakpointStore,
  DebuggerSession,
  type CallStackFrameView,
  type PauseLocation,
  type StepMode,
} from '@/lib/debugger';
import type { PauseReason, WireBreakpoint, WireVariable } from './protocol';
import { snapshotVariablesFromFrame } from './snapshot';

export type WorkerDebuggerPauseInfo = {
  readonly location: PauseLocation;
  readonly callStack: readonly CallStackFrameView[];
  readonly variables: readonly WireVariable[];
  readonly reason: PauseReason;
  readonly frame: StackFrame;
};

export type WorkerDebuggerBridgeCallbacks = {
  readonly onPause: (info: WorkerDebuggerPauseInfo) => void;
  readonly onResume: () => void;
};

/**
 * Owns a worker-local BreakpointStore + DebuggerSession for one run.
 * Main thread BreakpointStore remains the UI source of truth; sync via setBreakpoints.
 */
export class WorkerDebuggerBridge {
  private readonly breakpoints = new BreakpointStore();
  private session: DebuggerSession | null = null;
  private lastPauseReason: PauseReason = 'step';

  constructor(private readonly callbacks: WorkerDebuggerBridgeCallbacks) {}

  setBreakpoints(list: readonly WireBreakpoint[]): void {
    this.breakpoints.clear();
    for (const bp of list) {
      this.breakpoints.add(bp.line, bp.enabled);
    }
  }

  start(initialStepMode?: StepMode): DebuggerSession {
    this.session = new DebuggerSession(this.breakpoints, {
      onPause: ({ location, callStack, frame }) => {
        const reason = this.lastPauseReason;
        // After park, session resets mode to continue — reason is for UI only.
        this.callbacks.onPause({
          location,
          callStack,
          variables: snapshotVariablesFromFrame(frame),
          reason,
          frame,
        });
      },
      onResume: () => {
        this.callbacks.onResume();
      },
    });
    if (initialStepMode) {
      this.session.setInitialMode(initialStepMode);
      this.lastPauseReason = initialStepMode === 'continue' ? 'breakpoint' : 'step';
    }
    return this.session;
  }

  requestPause(): void {
    this.lastPauseReason = 'pause';
    this.session?.requestPause();
  }

  continue(): void {
    this.lastPauseReason = 'breakpoint';
    this.session?.continue();
  }

  stepInto(): void {
    this.lastPauseReason = 'step';
    this.session?.stepInto();
  }

  stepOver(): void {
    this.lastPauseReason = 'step';
    this.session?.stepOver();
  }

  stepOut(): void {
    this.lastPauseReason = 'step';
    this.session?.stepOut();
  }

  cancel(): void {
    this.session?.cancel(abortError('Debug session cancelled'));
    this.session = null;
  }

  getSession(): DebuggerSession | null {
    return this.session;
  }
}

function abortError(message: string): Error {
  const e = new Error(message);
  e.name = 'AbortError';
  return e;
}
