/**
 * Generation-token debounce: rapid reschedules invalidate older callbacks.
 * Used so marker paints never apply after a newer edit (or cancel).
 */

export type GenerationDebouncer = {
  /** Schedule `fn`; any later schedule/cancel makes this invocation a no-op. */
  schedule(fn: () => void): void;
  /** Invalidate pending work (does not run `fn`). */
  cancel(): void;
  /** Monotonic generation (increments on schedule and cancel). */
  readonly generation: number;
};

export function createGenerationDebouncer(ms: number): GenerationDebouncer {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;

  return {
    get generation() {
      return generation;
    },
    schedule(fn: () => void) {
      generation += 1;
      const token = generation;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (token !== generation) return;
        fn();
      }, ms);
    },
    cancel() {
      generation += 1;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
