import { describe, expect, it } from 'vitest';
import {
  NEW_FILE_TEMPLATE,
  WELCOME_EXAMPLES,
  welcomeExampleById,
} from './welcomeExamples';

describe('welcomeExamples', () => {
  it('includes starter and cambridge groups', () => {
    const groups = new Set(WELCOME_EXAMPLES.map((e) => e.group));
    expect(groups.has('starter')).toBe(true);
    expect(groups.has('cambridge')).toBe(true);
    expect(WELCOME_EXAMPLES.length).toBeGreaterThanOrEqual(4);
  });

  it('keeps non-empty sources and stable ids', () => {
    const ids = new Set<string>();
    for (const ex of WELCOME_EXAMPLES) {
      expect(ex.source.trim().length).toBeGreaterThan(10);
      expect(ids.has(ex.id)).toBe(false);
      ids.add(ex.id);
    }
    expect(welcomeExampleById('for-sum')?.title).toMatch(/FOR/i);
  });

  it('ships a new-file template with OUTPUT', () => {
    expect(NEW_FILE_TEMPLATE).toContain('OUTPUT');
  });
});
