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

/** Optional debugger / IDE hooks (no-op unless provided). */
export type DebuggerHooks = {
  /**
   * Called before executing a statement.
   * Future: return 'pause' for breakpoints / stepping.
   */
  onBeforeStatement?: (info: {
    span: SourceSpan;
    frame: StackFrame;
    step: number;
  }) => void | 'continue' | 'pause';

  onEnterFrame?: (frame: StackFrame) => void;
  onExitFrame?: (frame: StackFrame, returned?: RuntimeValue) => void;
};
