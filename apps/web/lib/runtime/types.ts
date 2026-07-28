/**
 * UI-facing runtime types (IDE layer).
 * Decoupled from interpreter internals beyond the public package API.
 */

export type ExecutionState =
  | 'idle'
  | 'running'
  | 'waitingForInput'
  | 'completed'
  | 'runtimeError'
  | 'semanticError'
  | 'cancelled';

export type RuntimeConsoleKind = 'out' | 'in' | 'info' | 'error';

export type RuntimeConsoleLine = {
  readonly id: string;
  readonly kind: RuntimeConsoleKind;
  readonly text: string;
};

export type RuntimeVariableRow = {
  readonly name: string;
  readonly type: string;
  readonly value: string;
  readonly kind: string;
  readonly scope: 'global' | 'local' | 'parameter' | 'constant';
};

export type RuntimeDiagnosticView = {
  readonly id: string;
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly code: string;
  readonly line?: number;
  readonly column?: number;
  readonly help?: string;
};

export type RuntimeSnapshot = {
  readonly state: ExecutionState;
  readonly consoleLines: readonly RuntimeConsoleLine[];
  readonly diagnostics: readonly RuntimeDiagnosticView[];
  readonly variables: readonly RuntimeVariableRow[];
  readonly frameName: string | null;
  readonly steps: number;
  readonly awaitingInput: boolean;
};

export function canTransition(
  from: ExecutionState,
  to: ExecutionState,
): boolean {
  if (from === to) return true;
  switch (from) {
    case 'idle':
      return to === 'running' || to === 'semanticError';
    case 'running':
      return (
        to === 'waitingForInput' ||
        to === 'completed' ||
        to === 'runtimeError' ||
        to === 'cancelled' ||
        to === 'semanticError'
      );
    case 'waitingForInput':
      return (
        to === 'running' ||
        to === 'cancelled' ||
        to === 'runtimeError' ||
        to === 'completed'
      );
    case 'completed':
    case 'runtimeError':
    case 'semanticError':
    case 'cancelled':
      return to === 'idle' || to === 'running' || to === 'semanticError';
    default:
      return false;
  }
}
