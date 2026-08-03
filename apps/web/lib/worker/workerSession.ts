/**
 * Worker-side session runner — invoked by the Web Worker entry or the
 * in-process test port. Owns AbortController, host, debugger, and runPseudocode.
 */

import { runPseudocode } from '@pseudopilot/interpreter';
import type { StepMode } from '@/lib/debugger';
import type {
  WireBreakpoint,
  WireDiagnostic,
  WorkerEvent,
} from './protocol';
import { WorkerDebuggerBridge } from './WorkerDebuggerBridge';
import { WorkerRuntimeHost } from './WorkerRuntimeHost';
import { snapshotFromRunResult } from './snapshot';

export type PostEvent = (event: WorkerEvent) => void;

export class WorkerSessionRunner {
  private sessionId: number | null = null;
  private abort: AbortController | null = null;
  private host: WorkerRuntimeHost | null = null;
  private debugger: WorkerDebuggerBridge | null = null;
  private runPromise: Promise<void> | null = null;
  private progressTick = 0;

  constructor(private readonly post: PostEvent) {}

  async run(args: {
    sessionId: number;
    source: string;
    breakpoints: readonly WireBreakpoint[];
    initialStepMode?: StepMode;
  }): Promise<void> {
    // Overlapping run: cancel prior first.
    if (this.runPromise) {
      this.stop(this.sessionId ?? args.sessionId);
      await this.runPromise.catch(() => undefined);
    }

    const task = this.execute(args);
    this.runPromise = task;
    try {
      await task;
    } finally {
      if (this.runPromise === task) this.runPromise = null;
    }
  }

  stop(sessionId: number): void {
    // Allow force-stop from terminate (any session).
    if (
      this.sessionId !== null &&
      this.sessionId !== sessionId &&
      sessionId !== Number.MAX_SAFE_INTEGER
    ) {
      return;
    }
    this.debugger?.cancel();
    this.host?.cancelInput();
    this.abort?.abort();
  }

  pause(sessionId: number): void {
    if (this.sessionId !== sessionId) return;
    this.debugger?.requestPause();
  }

  continue(sessionId: number): void {
    if (this.sessionId !== sessionId) return;
    this.debugger?.continue();
  }

  stepInto(sessionId: number): void {
    if (this.sessionId !== sessionId) return;
    this.debugger?.stepInto();
  }

  stepOver(sessionId: number): void {
    if (this.sessionId !== sessionId) return;
    this.debugger?.stepOver();
  }

  stepOut(sessionId: number): void {
    if (this.sessionId !== sessionId) return;
    this.debugger?.stepOut();
  }

  input(sessionId: number, line: string): void {
    if (this.sessionId !== sessionId) return;
    this.host?.submitInput(line);
  }

  setBreakpoints(sessionId: number, breakpoints: readonly WireBreakpoint[]): void {
    if (this.sessionId !== sessionId) return;
    this.debugger?.setBreakpoints(breakpoints);
  }

  private async execute(args: {
    sessionId: number;
    source: string;
    breakpoints: readonly WireBreakpoint[];
    initialStepMode?: StepMode;
  }): Promise<void> {
    const { sessionId, source, breakpoints, initialStepMode } = args;
    this.sessionId = sessionId;
    this.progressTick = 0;

    const abort = new AbortController();
    this.abort = abort;

    const host = new WorkerRuntimeHost({
      onOutput: (line) => {
        if (this.sessionId !== sessionId) return;
        this.post({ type: 'output', sessionId, line });
      },
      onInputRequest: (prompt) => {
        if (this.sessionId !== sessionId) return;
        this.post(
          prompt !== undefined
            ? { type: 'inputRequest', sessionId, prompt }
            : { type: 'inputRequest', sessionId },
        );
      },
    });
    this.host = host;

    const dbg = new WorkerDebuggerBridge({
      onPause: ({ location, callStack, variables, reason }) => {
        if (this.sessionId !== sessionId) return;
        this.post({
          type: 'paused',
          sessionId,
          location,
          callStack: [...callStack],
          variables: [...variables],
          reason,
        });
      },
      onResume: () => {
        if (this.sessionId !== sessionId) return;
        this.post({ type: 'resumed', sessionId });
      },
    });
    dbg.setBreakpoints(breakpoints);
    const session = dbg.start(initialStepMode);
    this.debugger = dbg;
    const hooks = session.createHooks();

    try {
      const result = await runPseudocode(source, {
        host,
        signal: abort.signal,
        debugger: {
          onEnterFrame: hooks.onEnterFrame,
          onExitFrame: hooks.onExitFrame,
          onBeforeStatement: async (info) => {
            if (this.sessionId !== sessionId) return 'continue';
            this.progressTick += 1;
            // Compact progress — not every step (avoid flooding the main thread).
            if (this.progressTick % 64 === 0) {
              this.post({
                type: 'progress',
                sessionId,
                steps: info.step,
              });
            }
            return (await hooks.onBeforeStatement?.(info)) ?? 'continue';
          },
        },
      });

      if (this.sessionId !== sessionId) return;

      const snap = snapshotFromRunResult(result.globals, result.callStack);

      if (!result.ok) {
        const diagnostics = result.diagnostics.map(mapDiag);
        const code = result.diagnostics[0]?.code ?? '';
        if (code.startsWith('C_') || code.startsWith('E_')) {
          this.post({ type: 'semanticError', sessionId, diagnostics });
        } else if (code === 'R_CANCELLED' || abort.signal.aborted) {
          this.post({
            type: 'cancelled',
            sessionId,
            steps: result.steps,
          });
        } else {
          this.post({
            type: 'runtimeError',
            sessionId,
            steps: result.steps,
            diagnostics,
            variables: snap.variables,
            frameName: snap.frameName,
          });
        }
        return;
      }

      if (abort.signal.aborted) {
        this.post({ type: 'cancelled', sessionId, steps: result.steps });
        return;
      }

      this.post({
        type: 'completed',
        sessionId,
        steps: result.steps,
        variables: snap.variables,
        frameName: snap.frameName,
      });
    } catch (e) {
      if (this.sessionId !== sessionId) return;
      if (abort.signal.aborted || isAbortLike(e)) {
        this.post({ type: 'cancelled', sessionId, steps: 0 });
        return;
      }
      const message =
        e instanceof Error ? e.message : 'Unexpected worker runtime failure.';
      this.post({
        type: 'runtimeError',
        sessionId,
        steps: 0,
        diagnostics: [
          {
            severity: 'error',
            code: 'R_INTERNAL',
            message,
          },
        ],
        variables: [],
        frameName: null,
      });
    } finally {
      if (this.sessionId === sessionId) {
        this.host = null;
        this.abort = null;
        this.debugger = null;
        this.sessionId = null;
      }
    }
  }
}

function mapDiag(d: {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  span?: { start: { line: number; column: number } };
  help?: string;
}): WireDiagnostic {
  const base: WireDiagnostic = {
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

/** Dispatch a command against a runner (shared by Web Worker + in-process port). */
export function handleWorkerCommand(
  runner: WorkerSessionRunner,
  cmd: import('./protocol.js').WorkerCommand,
  post: PostEvent,
): void {
  switch (cmd.type) {
    case 'ping':
      post({ type: 'pong' });
      return;
    case 'run':
      void runner
        .run({
          sessionId: cmd.sessionId,
          source: cmd.source,
          breakpoints: cmd.breakpoints,
          initialStepMode: cmd.initialStepMode,
        })
        .catch((e) => {
          post({
            type: 'workerError',
            sessionId: cmd.sessionId,
            message: e instanceof Error ? e.message : String(e),
          });
        });
      return;
    case 'stop':
      runner.stop(cmd.sessionId);
      return;
    case 'pause':
      runner.pause(cmd.sessionId);
      return;
    case 'continue':
      runner.continue(cmd.sessionId);
      return;
    case 'stepInto':
      runner.stepInto(cmd.sessionId);
      return;
    case 'stepOver':
      runner.stepOver(cmd.sessionId);
      return;
    case 'stepOut':
      runner.stepOut(cmd.sessionId);
      return;
    case 'input':
      runner.input(cmd.sessionId, cmd.line);
      return;
    case 'setBreakpoints':
      runner.setBreakpoints(cmd.sessionId, cmd.breakpoints);
      return;
    default: {
      const _exhaustive: never = cmd;
      return _exhaustive;
    }
  }
}
