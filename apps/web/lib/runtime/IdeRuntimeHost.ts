import {
  VirtualFileSystem,
  type RuntimeHost,
} from '@pseudopilot/interpreter';

export type InputRequestHandlers = {
  readonly onWaiting: () => void;
  readonly onResolved: () => void;
};

/**
 * Browser RuntimeHost: OUTPUT is sync into the controller;
 * INPUT returns a Promise resolved by {@link IdeRuntimeHost.submitInput}.
 * File I/O uses an in-tab {@link VirtualFileSystem} (never the OS disk).
 */
export class IdeRuntimeHost implements RuntimeHost {
  readonly files = new VirtualFileSystem();
  private pending:
    | {
        resolve: (value: string) => void;
        reject: (reason?: unknown) => void;
      }
    | null = null;

  constructor(
    private readonly onOutput: (line: string) => void,
    private readonly inputHooks: InputRequestHandlers,
  ) {}

  writeOutput(line: string): void {
    this.onOutput(line);
  }

  readInput(prompt?: string): Promise<string> {
    void prompt;
    // Interpreter is single-threaded; overlapping INPUT would deadlock the UI
    // (second wait with no way to resolve the first). Reject the stale waiter.
    if (this.pending) {
      const stale = this.pending;
      this.pending = null;
      stale.reject(new Error('Overlapping INPUT requests.'));
    }
    return new Promise<string>((resolve, reject) => {
      this.pending = { resolve, reject };
      this.inputHooks.onWaiting();
    });
  }

  get isAwaitingInput(): boolean {
    return this.pending !== null;
  }

  submitInput(line: string): void {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    this.inputHooks.onResolved();
    p.resolve(line);
  }

  /** Reject a pending INPUT (Stop / session teardown). */
  cancelInput(reason: unknown = new DOMException('Aborted', 'AbortError')): void {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    this.inputHooks.onResolved();
    p.reject(reason);
  }
}
