import type { SourceSpan } from '@pseudopilot/language-core';
import type { Environment } from './environment.js';
import type { RuntimeValue } from './value.js';

export type FrameKind = 'global' | 'procedure' | 'function';

export type StackFrame = {
  readonly id: number;
  readonly kind: FrameKind;
  /** Display name (`<global>`, procedure/function name). */
  readonly name: string;
  readonly env: Environment;
  /** Call site span (undefined for global). */
  readonly callSpan?: SourceSpan;
};

/**
 * Call stack for procedures/functions (debugger-ready).
 * Frame 0 is always global.
 */
export class CallStack {
  private frames: StackFrame[] = [];
  private nextId = 1;

  push(
    kind: FrameKind,
    name: string,
    env: Environment,
    callSpan?: SourceSpan,
  ): StackFrame {
    const frame: StackFrame = {
      id: this.nextId++,
      kind,
      name,
      env,
      ...(callSpan !== undefined ? { callSpan } : {}),
    };
    this.frames.push(frame);
    return frame;
  }

  pop(): StackFrame | undefined {
    if (this.frames.length <= 1) {
      return undefined;
    }
    return this.frames.pop();
  }

  current(): StackFrame {
    return this.frames[this.frames.length - 1]!;
  }

  depth(): number {
    return this.frames.length;
  }

  /** Top-first snapshot for UI / diagnostics. */
  snapshot(): readonly StackFrame[] {
    return [...this.frames].reverse();
  }

  clear(): void {
    this.frames = [];
    this.nextId = 1;
  }
}

export type StatementHookInfo = {
  readonly span: SourceSpan;
  readonly frame: StackFrame;
  readonly step: number;
  /** Call-stack depth including the global frame (≥ 1 while running). */
  readonly depth: number;
  /**
   * Open file handles (text + random) when the runtime host uses
   * {@link VirtualFileSystem}; empty otherwise.
   */
  readonly openFiles?: readonly import('./files/VirtualFileSystem.js').OpenFileSnapshot[];
};

export type StatementHookResult = void | 'continue' | 'pause';

/** Optional debugger / IDE hooks (no-op unless provided). */
export type DebuggerHooks = {
  /**
   * Called before executing a statement (and on loop-header re-ticks).
   *
   * May return a Promise so the IDE can suspend (breakpoints / stepping)
   * without aborting the run. Prefer awaiting a resume gate inside the hook;
   * returning `'pause'` synchronously still aborts with `R_DEBUG_PAUSE`
   * (legacy / tests).
   */
  onBeforeStatement?: (
    info: StatementHookInfo,
  ) => StatementHookResult | Promise<StatementHookResult>;

  onEnterFrame?: (frame: StackFrame) => void;
  onExitFrame?: (frame: StackFrame, returned?: RuntimeValue) => void;
};
