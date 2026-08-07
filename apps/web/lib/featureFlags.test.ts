import { describe, expect, it } from 'vitest';
import { ENABLE_AI_COACH, withoutAiCoachEntry } from './featureFlags';

describe('featureFlags', () => {
  it('disables AI Coach UI for v1.0.0-beta', () => {
    expect(ENABLE_AI_COACH).toBe(false);
  });

  it('removes AI Coach nav entries when the flag is off', () => {
    const items = [
      { id: 'explorer' },
      { id: 'ai' },
      { id: 'docs' },
    ] as const;
    expect(withoutAiCoachEntry(items, false).map((i) => i.id)).toEqual([
      'explorer',
      'docs',
    ]);
  });

  it('keeps AI Coach nav entries when the flag is on', () => {
    const items = [
      { id: 'explorer' },
      { id: 'ai' },
      { id: 'docs' },
    ] as const;
    expect(withoutAiCoachEntry(items, true).map((i) => i.id)).toEqual([
      'explorer',
      'ai',
      'docs',
    ]);
  });
});
