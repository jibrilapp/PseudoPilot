/**
 * Debugger types (IDE layer). Independent of React.
 */

export type Breakpoint = {
  readonly id: string;
  readonly line: number;
  readonly enabled: boolean;
  /** Reserved for future conditional breakpoints. */
  readonly condition?: string;
};

export type StepMode = 'continue' | 'stepInto' | 'stepOver' | 'stepOut';

export type CallStackFrameView = {
  readonly id: number;
  readonly name: string;
  readonly kind: string;
  readonly line: number | null;
  readonly args: readonly { readonly name: string; readonly value: string }[];
};

export type PauseLocation = {
  readonly line: number;
  readonly column: number;
  readonly step: number;
  readonly depth: number;
  readonly frameName: string;
  readonly frameKind: string;
};
