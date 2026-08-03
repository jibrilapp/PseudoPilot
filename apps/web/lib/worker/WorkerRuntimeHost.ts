/**
 * RuntimeHost that lives inside the worker.
 * OUTPUT/INPUT cross the boundary via postEvent; VFS stays in-worker.
 */

import {
  VirtualFileSystem,
  type RuntimeHost,
} from '@pseudopilot/interpreter';

export type WorkerHostCallbacks = {
  readonly onOutput: (line: string) => void;
  readonly onInputRequest: (prompt?: string) => void;
};

/**
 * Worker-side host: parks INPUT on a Promise resolved by main-thread Input messages.
 * File I/O uses an in-worker {@link VirtualFileSystem}.
 */
export class WorkerRuntimeHost implements RuntimeHost {
  readonly files = new VirtualFileSystem();
  private pending:
    | {
        resolve: (value: string) => void;
        reject: (reason?: unknown) => void;
      }
    | null = null;

  constructor(private readonly callbacks: WorkerHostCallbacks) {}

  writeOutput(line: string): void {
    this.callbacks.onOutput(line);
  }

  readInput(prompt?: string): Promise<string> {
    if (this.pending) {
      const stale = this.pending;
      this.pending = null;
      stale.reject(abortError('Overlapping INPUT requests.'));
    }
    return new Promise<string>((resolve, reject) => {
      this.pending = { resolve, reject };
      this.callbacks.onInputRequest(prompt);
    });
  }

  submitInput(line: string): void {
    if (!this.pending) return;
    const p = this.pending;
    this.pending = null;
    p.resolve(line);
  }

  cancelInput(reason: unknown = abortError('INPUT cancelled')): void {
    if (!this.pending) return;
    const p = this.pending;
    this.pending = null;
    p.reject(reason);
  }

  hasPendingInput(): boolean {
    return this.pending !== null;
  }
}

function abortError(message: string): Error {
  const e = new Error(message);
  e.name = 'AbortError';
  return e;
}
