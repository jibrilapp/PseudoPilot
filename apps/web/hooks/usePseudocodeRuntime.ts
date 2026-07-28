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
};

/**
 * React binding for {@link RuntimeController}.
 * Components render snapshot state only — no interpreter calls here.
 *
 * Snapshot identity is stable between emits (controller caches it) so
 * useSyncExternalStore does not infinite-loop on Object.is checks.
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

  return {
    ...snapshot,
    inputDraft,
    setInputDraft,
    run,
    stop,
    restart,
    clearConsole,
    submitInput,
    isBusy:
      snapshot.state === 'running' || snapshot.state === 'waitingForInput',
  };
}
