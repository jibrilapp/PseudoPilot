'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  getRuntimeController,
  type RuntimeSnapshot,
} from '@/lib/runtime';

const emptySnapshot: RuntimeSnapshot = {
  state: 'idle',
  consoleLines: [],
  diagnostics: [],
  variables: [],
  frameName: null,
  steps: 0,
  awaitingInput: false,
  paused: false,
  pauseLocation: null,
  callStack: [],
  breakpoints: [],
};

/**
 * React binding for {@link RuntimeController}.
 * Components render snapshot state only — no interpreter / debugger calls here.
 */
export function usePseudocodeRuntime() {
  const controller = getRuntimeController();

  const snapshot = useSyncExternalStore(
    (onStoreChange) => controller.subscribe(onStoreChange),
    () => controller.getSnapshot(),
    () => emptySnapshot,
  );

  const [inputDraft, setInputDraft] = useState('');
  const inputDraftRef = useRef(inputDraft);
  inputDraftRef.current = inputDraft;

  useEffect(() => {
    if (!snapshot.awaitingInput) setInputDraft('');
  }, [snapshot.awaitingInput]);

  const run = useCallback(
    async (source: string) => {
      await controller.run(source);
    },
    [controller],
  );

  const stop = useCallback(() => {
    controller.stop();
  }, [controller]);

  const restart = useCallback(
    async (source: string) => {
      await controller.restart(source);
    },
    [controller],
  );

  const clearConsole = useCallback(() => {
    controller.clearConsole();
  }, [controller]);

  const submitInput = useCallback(() => {
    const line = inputDraftRef.current;
    setInputDraft('');
    controller.submitInput(line);
  }, [controller]);

  const pause = useCallback(() => {
    controller.pause();
  }, [controller]);

  const continueExec = useCallback(() => {
    controller.continue();
  }, [controller]);

  const stepInto = useCallback(() => {
    controller.stepInto();
  }, [controller]);

  const stepOver = useCallback(() => {
    controller.stepOver();
  }, [controller]);

  const stepOut = useCallback(() => {
    controller.stepOut();
  }, [controller]);

  const stepIntoFromIdle = useCallback(
    async (source: string) => {
      await controller.stepIntoFromIdle(source);
    },
    [controller],
  );

  const toggleBreakpoint = useCallback(
    (line: number) => {
      controller.toggleBreakpoint(line);
    },
    [controller],
  );

  const removeBreakpoint = useCallback(
    (line: number) => {
      controller.removeBreakpoint(line);
    },
    [controller],
  );

  const setBreakpointEnabled = useCallback(
    (line: number, enabled: boolean) => {
      controller.setBreakpointEnabled(line, enabled);
    },
    [controller],
  );

  return {
    ...snapshot,
    inputDraft,
    setInputDraft,
    run,
    stop,
    restart,
    clearConsole,
    submitInput,
    pause,
    continue: continueExec,
    stepInto,
    stepOver,
    stepOut,
    stepIntoFromIdle,
    toggleBreakpoint,
    removeBreakpoint,
    setBreakpointEnabled,
    isBusy:
      snapshot.state === 'running' ||
      snapshot.state === 'waitingForInput' ||
      snapshot.state === 'paused',
    canStep: snapshot.state === 'paused',
    canPause: snapshot.state === 'running',
    canContinue: snapshot.state === 'paused',
  };
}
