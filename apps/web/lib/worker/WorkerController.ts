/**
 * Main-thread facade over the execution worker.
 * Owns the WorkerPort lifecycle; RuntimeController maps events → UI snapshots.
 */

import type { StepMode } from '@/lib/debugger';
import type {
  WireBreakpoint,
  WorkerCommand,
  WorkerEvent,
} from './protocol';
import {
  createBrowserWorkerPort,
  createInProcessWorkerPort,
  type WorkerPort,
} from './port';

export type WorkerControllerHandlers = {
  readonly onEvent: (event: WorkerEvent) => void;
};

export type WorkerControllerOptions = {
  /**
   * Inject a port (tests use in-process). Default: browser Worker with
   * in-process fallback when Worker is unavailable.
   */
  readonly createPort?: () => WorkerPort;
  /** Prefer in-process even in browsers (tests / SSR). */
  readonly inProcess?: boolean;
};

/**
 * Thin command/event bridge to the execution worker.
 * Does not own UI state — that remains in RuntimeController.
 */
export class WorkerController {
  private port: WorkerPort | null = null;
  private unsubscribe: (() => void) | null = null;
  private ready = false;
  private readonly pending: WorkerCommand[] = [];
  private handlers: WorkerControllerHandlers | null = null;
  private crashCount = 0;

  constructor(private readonly options: WorkerControllerOptions = {}) {}

  /** Ensure a live worker and attach event handlers. */
  ensureStarted(handlers: WorkerControllerHandlers): void {
    this.handlers = handlers;
    if (this.port) return;
    this.spawn();
  }

  isReady(): boolean {
    return this.ready;
  }

  getCrashCount(): number {
    return this.crashCount;
  }

  post(command: WorkerCommand): void {
    if (!this.port) {
      if (this.handlers) this.spawn();
      else return;
    }
    if (!this.ready && command.type !== 'ping') {
      this.pending.push(command);
      return;
    }
    this.port!.postMessage(command);
  }

  run(args: {
    sessionId: number;
    source: string;
    breakpoints: readonly WireBreakpoint[];
    initialStepMode?: StepMode;
  }): void {
    this.post({
      type: 'run',
      sessionId: args.sessionId,
      source: args.source,
      breakpoints: args.breakpoints,
      initialStepMode: args.initialStepMode,
    });
  }

  stop(sessionId: number): void {
    this.post({ type: 'stop', sessionId });
  }

  pause(sessionId: number): void {
    this.post({ type: 'pause', sessionId });
  }

  continue(sessionId: number): void {
    this.post({ type: 'continue', sessionId });
  }

  stepInto(sessionId: number): void {
    this.post({ type: 'stepInto', sessionId });
  }

  stepOver(sessionId: number): void {
    this.post({ type: 'stepOver', sessionId });
  }

  stepOut(sessionId: number): void {
    this.post({ type: 'stepOut', sessionId });
  }

  input(sessionId: number, line: string): void {
    this.post({ type: 'input', sessionId, line });
  }

  setBreakpoints(sessionId: number, breakpoints: readonly WireBreakpoint[]): void {
    this.post({ type: 'setBreakpoints', sessionId, breakpoints });
  }

  /** Tear down and spawn a fresh worker (crash recovery / recreate). */
  recreate(): void {
    this.teardown();
    if (this.handlers) this.spawn();
  }

  terminate(): void {
    this.teardown();
    this.handlers = null;
  }

  private spawn(): void {
    const create =
      this.options.createPort ??
      (this.options.inProcess
        ? createInProcessWorkerPort
        : createBrowserWorkerPort);

    this.port = create();
    this.ready = false;
    this.unsubscribe = this.port.onMessage((event) => {
      if (event.type === 'ready' || event.type === 'pong') {
        this.ready = true;
        this.flushPending();
      }
      if (event.type === 'workerError' && event.sessionId === null) {
        this.crashCount += 1;
        // Recreate worker so subsequent runs still work.
        queueMicrotask(() => {
          if (!this.handlers) return;
          this.teardown();
          this.spawn();
        });
      }
      this.handlers?.onEvent(event);
    });
  }

  private flushPending(): void {
    if (!this.port) return;
    const queued = this.pending.splice(0, this.pending.length);
    for (const cmd of queued) {
      this.port.postMessage(cmd);
    }
  }

  private teardown(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.port?.terminate();
    this.port = null;
    this.ready = false;
    this.pending.length = 0;
  }
}

export { createInProcessWorkerPort, createBrowserWorkerPort };
export type { WorkerPort };
