'use client';

import { useEffect, useRef, useState } from 'react';
import { runPseudocodeToPython } from '@/lib/translation/runTranslate';
import {
  TRANSLATE_DEBOUNCE_MS,
  TRANSLATE_LARGE_DEBOUNCE_MS,
  TRANSLATE_LARGE_SOURCE_CHARS,
  type IdeDiagnostic,
  type TranslationStatus,
} from '@/lib/translation/types';

export type UsePseudocodeTranslationResult = {
  readonly pseudocode: string;
  readonly setPseudocode: (value: string) => void;
  /** Last successful Python output (unchanged when translation fails). */
  readonly python: string;
  readonly diagnostics: IdeDiagnostic[];
  readonly status: TranslationStatus;
};

/**
 * Debounced live translation: pseudocode edits → Python pane.
 * On failure, keeps the previous successful Python text and surfaces diagnostics.
 */
export function usePseudocodeTranslation(
  initialPseudocode: string,
): UsePseudocodeTranslationResult {
  const [pseudocode, setPseudocode] = useState(initialPseudocode);
  const [python, setPython] = useState('');
  const [diagnostics, setDiagnostics] = useState<IdeDiagnostic[]>([]);
  const [status, setStatus] = useState<TranslationStatus>('idle');
  const lastGoodPython = useRef('');

  useEffect(() => {
    const delay =
      pseudocode.length > TRANSLATE_LARGE_SOURCE_CHARS
        ? TRANSLATE_LARGE_DEBOUNCE_MS
        : TRANSLATE_DEBOUNCE_MS;
    const timer = window.setTimeout(() => {
      const result = runPseudocodeToPython(pseudocode);
      setDiagnostics(result.diagnostics);

      if (result.ok) {
        lastGoodPython.current = result.code;
        setPython(result.code);
        setStatus('ok');
        return;
      }

      // Keep previous successful translation visible.
      setPython(lastGoodPython.current);
      setStatus('error');
    }, delay);

    return () => window.clearTimeout(timer);
  }, [pseudocode]);

  return {
    pseudocode,
    setPseudocode,
    python,
    diagnostics,
    status,
  };
}
