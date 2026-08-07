/**
 * Product feature flags for the student IDE (`apps/web`).
 *
 * Flip a single constant to restore a gated surface — do not delete the
 * underlying implementation.
 */

/**
 * AI Coach UI (Activity Bar, toolbar, right panel, mobile dock, welcome copy).
 *
 * `false` for **v1.0.0-beta** — coach is reserved for a future update.
 * Set to `true` to restore the previous AI Coach chrome and behaviour.
 */
export const ENABLE_AI_COACH = false;

/** Hide `{ id: 'ai' }` navigation entries when the coach UI is off. */
export function withoutAiCoachEntry<T extends { id: string }>(
  items: readonly T[],
  enabled: boolean = ENABLE_AI_COACH,
): T[] {
  if (enabled) return [...items];
  return items.filter((item) => item.id !== 'ai');
}
