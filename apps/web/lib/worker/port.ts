/**
 * Transport abstraction: real Web Worker or in-process (Vitest / Node).
 */

import type { WorkerCommand, WorkerEvent } from './protocol';
import {
  WorkerSessionRunner,
  handleWorkerCommand,
} from './workerSession';

export type WorkerPort = {
  postMessage(command: WorkerCommand): void;
  onMessage(handler: (event: WorkerEvent) => void): () => void;
  terminate(): void;
};

/**
 * In-process port — same protocol as a Web Worker, no thread hop.
 * Used by unit tests so Node Vitest can exercise the full stack.
 */
export function createInProcessWorkerPort(): WorkerPort {
  const listeners = new Set<(event: WorkerEvent) => void>();
  let terminated = false;

  const post = (event: WorkerEvent): void => {
    if (terminated) return;
    // Microtask so command handlers don't re-enter synchronously mid-stack.
    queueMicrotask(() => {
      if (terminated) return;
      for (const l of listeners) l(event);
    });
  };

  const runner = new WorkerSessionRunner(post);
  post({ type: 'ready' });

  return {
    postMessage(command) {
      if (terminated) return;
      handleWorkerCommand(runner, command, post);
    },
    onMessage(handler) {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
    terminate() {
      terminated = true;
      listeners.clear();
      runner.stop(Number.MAX_SAFE_INTEGER);
    },
  };
}

/**
 * Browser Web Worker port. Falls back to in-process when Worker is unavailable
 * (SSR / unsupported environments).
 *
 * Important: do **not** pass `{ type: 'module' }`. Next.js / webpack emit
 * classic worker chunks that use `importScripts`. Loading those as module
 * workers fails silently (no `ready`), so Run appears to do nothing in
 * production. Webpack's `new URL(..., import.meta.url)` worker handling
 * expects a classic Worker.
 */
export function createBrowserWorkerPort(): WorkerPort {
  if (typeof Worker === 'undefined') {
    return createInProcessWorkerPort();
  }

  try {
    const worker = new Worker(
      new URL('./execution.worker.ts', import.meta.url),
    );

    const listeners = new Set<(event: WorkerEvent) => void>();

    const onMessage = (ev: MessageEvent<WorkerEvent>): void => {
      const data = ev.data;
      if (!data || typeof data !== 'object' || !('type' in data)) return;
      for (const l of listeners) l(data);
    };

    const onError = (ev: ErrorEvent): void => {
      const event: WorkerEvent = {
        type: 'workerError',
        sessionId: null,
        message: ev.message || 'Worker crashed',
      };
      for (const l of listeners) l(event);
    };

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);

    return {
      postMessage(command) {
        worker.postMessage(command);
      },
      onMessage(handler) {
        listeners.add(handler);
        return () => {
          listeners.delete(handler);
        };
      },
      terminate() {
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
        listeners.clear();
        worker.terminate();
      },
    };
  } catch {
    return createInProcessWorkerPort();
  }
}
