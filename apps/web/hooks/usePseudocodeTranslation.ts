'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createBidirectionalSync,
  type BidirectionalSyncState,
  type EditOrigin,
} from '@/lib/translation/bidirectionalSync';
import {
  runPseudocodeToPython,
  runPythonToPseudocode,
} from '@/lib/translation/runTranslate';
import type { IdeDiagnostic, TranslationStatus } from '@/lib/translation/types';

export type UseBidirectionalTranslationResult = {
  readonly pseudocode: string;
  readonly setPseudocode: (value: string) => void;
  readonly python: string;
  readonly setPython: (value: string) => void;
  readonly diagnostics: IdeDiagnostic[];
  readonly status: TranslationStatus;
  /** Which pane's last translate attempt failed (null when ok/idle). */
  readonly errorSide: EditOrigin | null;
  /** Restore both buffers without re-translating (autosave / session load). */
  readonly restoreBuffers: (pseudocode: string, python: string) => void;
  /** Internal/tests: force Pseudocode → Python. Not exposed in primary UX. */
  readonly translateForwardNow: () => void;
  /** Internal/tests: force Python → Pseudocode. Not exposed in primary UX. */
  readonly translateReverseNow: () => void;
};

const IDLE: BidirectionalSyncState = {
  pseudocode: '',
  python: '',
  diagnostics: [],
  status: 'idle',
  errorSide: null,
};

/**
 * Origin-aware live translation: Pseudocode ↔ Python.
 *
 * - Pseudocode edits → forward translate → update Python (no reverse).
 * - Python edits → reverse translate → update Pseudocode (no forward).
 * - Failures keep the last good peer buffer and surface diagnostics.
 */
export function usePseudocodeTranslation(
  initialPseudocode: string,
): UseBidirectionalTranslationResult {
  const [state, setState] = useState<BidirectionalSyncState>(() => ({
    ...IDLE,
    pseudocode: initialPseudocode,
  }));

  const syncRef = useRef<ReturnType<typeof createBidirectionalSync> | null>(
    null,
  );

  useEffect(() => {
    const sync = createBidirectionalSync({
      initialPseudocode,
      translateForward: runPseudocodeToPython,
      translateReverse: runPythonToPseudocode,
    });
    syncRef.current = sync;
    const unsub = sync.subscribe(() => {
      setState(sync.getState());
    });
    sync.bootstrap();
    setState(sync.getState());
    return () => {
      unsub();
      sync.dispose();
      syncRef.current = null;
    };
    // Bootstrap once per mount for the initial buffer.
  }, []);

  const setPseudocode = useCallback((value: string) => {
    syncRef.current?.editPseudocode(value);
  }, []);

  const setPython = useCallback((value: string) => {
    syncRef.current?.editPython(value);
  }, []);

  const restoreBuffers = useCallback(
    (nextPseudocode: string, nextPython: string) => {
      syncRef.current?.restoreBuffers(nextPseudocode, nextPython);
    },
    [],
  );

  const translateForwardNow = useCallback(() => {
    syncRef.current?.forceTranslateForward();
  }, []);

  const translateReverseNow = useCallback(() => {
    syncRef.current?.forceTranslateReverse();
  }, []);

  return {
    pseudocode: state.pseudocode,
    setPseudocode,
    python: state.python,
    setPython,
    diagnostics: state.diagnostics,
    status: state.status,
    errorSide: state.errorSide,
    restoreBuffers,
    translateForwardNow,
    translateReverseNow,
  };
}
