/**
 * Structured message protocol between the main-thread RuntimeController
 * and the execution Web Worker.
 *
 * Design goals:
 * - No shared mutable state (structured clone only)
 * - Interpreter APIs unchanged — worker owns host + debugger gate
 * - Protocol ready for future sandbox / remote / cloud transports
 */

import type {
  Breakpoint,
  CallStackFrameView,
  PauseLocation,
  StepMode,
} from '@/lib/debugger';

/** Compact breakpoint wire format (id optional — worker only needs line/enabled). */
export type WireBreakpoint = {
  readonly line: number;
  readonly enabled: boolean;
};

export type WireVariable = {
  readonly name: string;
  readonly type: string;
  readonly value: string;
  readonly kind: string;
  readonly scope: 'global' | 'local' | 'parameter' | 'constant';
};

export type WireDiagnostic = {
  readonly severity: 'error' | 'warning';
  readonly code: string;
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
  readonly help?: string;
};

export type PauseReason = 'breakpoint' | 'step' | 'pause';

/** Main thread → worker */
export type WorkerCommand =
  | {
      readonly type: 'run';
      readonly sessionId: number;
      readonly source: string;
      readonly breakpoints: readonly WireBreakpoint[];
      readonly initialStepMode?: StepMode;
    }
  | { readonly type: 'stop'; readonly sessionId: number }
  | { readonly type: 'pause'; readonly sessionId: number }
  | { readonly type: 'continue'; readonly sessionId: number }
  | { readonly type: 'stepInto'; readonly sessionId: number }
  | { readonly type: 'stepOver'; readonly sessionId: number }
  | { readonly type: 'stepOut'; readonly sessionId: number }
  | {
      readonly type: 'input';
      readonly sessionId: number;
      readonly line: string;
    }
  | {
      readonly type: 'setBreakpoints';
      readonly sessionId: number;
      readonly breakpoints: readonly WireBreakpoint[];
    }
  | { readonly type: 'ping' };

/** Worker → main thread */
export type WorkerEvent =
  | { readonly type: 'ready' }
  | { readonly type: 'pong' }
  | {
      readonly type: 'output';
      readonly sessionId: number;
      readonly line: string;
    }
  | {
      readonly type: 'inputRequest';
      readonly sessionId: number;
      readonly prompt?: string;
    }
  | {
      readonly type: 'paused';
      readonly sessionId: number;
      readonly location: PauseLocation;
      readonly callStack: readonly CallStackFrameView[];
      readonly variables: readonly WireVariable[];
      readonly reason: PauseReason;
    }
  | {
      readonly type: 'resumed';
      readonly sessionId: number;
    }
  | {
      readonly type: 'progress';
      readonly sessionId: number;
      readonly steps: number;
    }
  | {
      readonly type: 'completed';
      readonly sessionId: number;
      readonly steps: number;
      readonly variables: readonly WireVariable[];
      readonly frameName: string | null;
    }
  | {
      readonly type: 'runtimeError';
      readonly sessionId: number;
      readonly steps: number;
      readonly diagnostics: readonly WireDiagnostic[];
      readonly variables: readonly WireVariable[];
      readonly frameName: string | null;
    }
  | {
      readonly type: 'semanticError';
      readonly sessionId: number;
      readonly diagnostics: readonly WireDiagnostic[];
    }
  | {
      readonly type: 'cancelled';
      readonly sessionId: number;
      readonly steps: number;
    }
  | {
      readonly type: 'workerError';
      readonly sessionId: number | null;
      readonly message: string;
    };

/** @deprecated Prefer WorkerCommand / WorkerEvent names. */
export type WorkerMessages = WorkerCommand;
/** @deprecated Prefer WorkerEvent. */
export type WorkerResponses = WorkerEvent;

export type WorkerProtocol = {
  readonly command: WorkerCommand;
  readonly event: WorkerEvent;
};

export function toWireBreakpoints(
  breakpoints: readonly Breakpoint[],
): WireBreakpoint[] {
  return breakpoints.map((b) => ({ line: b.line, enabled: b.enabled }));
}
