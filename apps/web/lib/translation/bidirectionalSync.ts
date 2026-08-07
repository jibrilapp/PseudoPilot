/**
 * Origin-aware Pseudocode ↔ Python synchronization (UI layer).
 *
 * User edits on one side schedule translation into the other.
 * Applying translated text never re-triggers the opposite direction —
 * that is the infinite-loop guard. Identical-buffer edit* calls are also
 * ignored so Monaco peer `executeEdits` onChange echoes cannot start a
 * lossy reverse round-trip that rewrites the Pseudocode the user is editing.
 */

import {
  TRANSLATE_DEBOUNCE_MS,
  TRANSLATE_LARGE_DEBOUNCE_MS,
  TRANSLATE_LARGE_SOURCE_CHARS,
  type IdeDiagnostic,
  type TranslationStatus,
} from './types';
import type { SafeTranslateResult } from './runTranslate';

export type EditOrigin = 'pseudocode' | 'python';

export type BidirectionalSyncState = {
  readonly pseudocode: string;
  readonly python: string;
  readonly diagnostics: IdeDiagnostic[];
  readonly status: TranslationStatus;
  /** Which pane's last translate attempt failed (for badges / markers). */
  readonly errorSide: EditOrigin | null;
};

export type BidirectionalSyncOptions = {
  readonly initialPseudocode: string;
  readonly translateForward: (source: string) => SafeTranslateResult;
  readonly translateReverse: (source: string) => SafeTranslateResult;
  /** Override debounce delay (tests). Default uses size-based constants. */
  readonly debounceMs?: (sourceLength: number) => number;
  /** Inject timers (tests). */
  readonly setTimeoutFn?: typeof setTimeout;
  readonly clearTimeoutFn?: typeof clearTimeout;
};

export type BidirectionalSyncController = {
  getState(): BidirectionalSyncState;
  /** Initial forward translate of `initialPseudocode`. */
  bootstrap(): void;
  /**
   * Restore both buffers without translating (session autosave / load).
   * Cancels any in-flight sync timers.
   */
  restoreBuffers(nextPseudocode: string, nextPython: string): void;
  /** User typed in Pseudocode → schedule forward only. */
  editPseudocode(value: string): void;
  /** User typed in Python → schedule reverse only. */
  editPython(value: string): void;
  /** Internal/tests: force Pseudocode → Python even if buffers unchanged. */
  forceTranslateForward(): void;
  /** Internal/tests: force Python → Pseudocode even if buffers unchanged. */
  forceTranslateReverse(): void;
  subscribe(listener: () => void): () => void;
  dispose(): void;
  /** Test/introspection: pending direction after last edit. */
  pendingOrigin(): EditOrigin | null;
};

function defaultDebounceMs(sourceLength: number): number {
  return sourceLength > TRANSLATE_LARGE_SOURCE_CHARS
    ? TRANSLATE_LARGE_DEBOUNCE_MS
    : TRANSLATE_DEBOUNCE_MS;
}

export function createBidirectionalSync(
  options: BidirectionalSyncOptions,
): BidirectionalSyncController {
  const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
  const debounceMs = options.debounceMs ?? defaultDebounceMs;

  let pseudocode = options.initialPseudocode;
  let python = '';
  let lastGoodPseudocode = options.initialPseudocode;
  let lastGoodPython = '';
  let diagnostics: IdeDiagnostic[] = [];
  let status: TranslationStatus = 'idle';
  let errorSide: EditOrigin | null = null;

  let pending: EditOrigin | null = null;
  let forwardGen = 0;
  let reverseGen = 0;
  let forwardTimer: ReturnType<typeof setTimeout> | null = null;
  let reverseTimer: ReturnType<typeof setTimeout> | null = null;

  const listeners = new Set<() => void>();

  function emit(): void {
    for (const l of listeners) l();
  }

  function snapshot(): BidirectionalSyncState {
    return {
      pseudocode,
      python,
      diagnostics,
      status,
      errorSide,
    };
  }

  function cancelForward(): void {
    forwardGen += 1;
    if (forwardTimer != null) {
      clearTimeoutFn(forwardTimer);
      forwardTimer = null;
    }
  }

  function cancelReverse(): void {
    reverseGen += 1;
    if (reverseTimer != null) {
      clearTimeoutFn(reverseTimer);
      reverseTimer = null;
    }
  }

  function scheduleForward(source: string): void {
    cancelReverse();
    pending = 'pseudocode';
    status = 'pending';
    emit();
    forwardGen += 1;
    const token = forwardGen;
    if (forwardTimer != null) clearTimeoutFn(forwardTimer);
    forwardTimer = setTimeoutFn(() => {
      forwardTimer = null;
      if (token !== forwardGen) return;
      pending = null;
      const result = options.translateForward(source);
      diagnostics = result.diagnostics;
      if (result.ok) {
        lastGoodPython = result.code;
        lastGoodPseudocode = source;
        python = result.code;
        status = 'ok';
        errorSide = null;
      } else {
        // Keep last good Python; leave Pseudocode as the (possibly invalid) edit.
        python = lastGoodPython;
        status = 'error';
        errorSide = 'pseudocode';
      }
      emit();
    }, debounceMs(source.length));
  }

  function scheduleReverse(source: string): void {
    cancelForward();
    pending = 'python';
    status = 'pending';
    emit();
    reverseGen += 1;
    const token = reverseGen;
    if (reverseTimer != null) clearTimeoutFn(reverseTimer);
    reverseTimer = setTimeoutFn(() => {
      reverseTimer = null;
      if (token !== reverseGen) return;
      pending = null;
      const result = options.translateReverse(source);
      diagnostics = result.diagnostics;
      if (result.ok) {
        lastGoodPseudocode = result.code;
        lastGoodPython = source;
        // Apply translated Pseudocode WITHOUT scheduling forward (loop guard).
        pseudocode = result.code;
        status = 'ok';
        errorSide = null;
      } else {
        // Keep last good Pseudocode; leave Python as the (possibly invalid) edit.
        pseudocode = lastGoodPseudocode;
        status = 'error';
        errorSide = 'python';
      }
      emit();
    }, debounceMs(source.length));
  }

  return {
    getState: snapshot,

    bootstrap() {
      scheduleForward(pseudocode);
    },

    restoreBuffers(nextPseudocode: string, nextPython: string) {
      cancelForward();
      cancelReverse();
      pending = null;
      pseudocode = nextPseudocode;
      python = nextPython;
      lastGoodPseudocode = nextPseudocode;
      lastGoodPython = nextPython;
      diagnostics = [];
      status = 'ok';
      errorSide = null;
      emit();
    },

    editPseudocode(value: string) {
      // Identical buffer: ignore peer-apply echoes from Monaco executeEdits.
      // Re-scheduling forward here would be harmless, but the Python twin of
      // this guard is load-bearing (see editPython).
      if (value === pseudocode) return;
      pseudocode = value;
      emit();
      scheduleForward(value);
    },

    editPython(value: string) {
      // After Pseudocode→Python, applying the translated text via executeEdits
      // can re-fire onChange with the same string. Scheduling reverse for that
      // echo round-trips through a lossy translator and rewrites unrelated
      // Pseudocode lines (indent, identifiers) while the user is editing.
      if (value === python) return;
      python = value;
      emit();
      scheduleReverse(value);
    },

    forceTranslateForward() {
      scheduleForward(pseudocode);
    },

    forceTranslateReverse() {
      scheduleReverse(python);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    dispose() {
      cancelForward();
      cancelReverse();
      listeners.clear();
      pending = null;
    },

    pendingOrigin() {
      return pending;
    },
  };
}
