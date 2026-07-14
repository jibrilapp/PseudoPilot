import { describe, expect, it } from 'vitest';
import { bootstrap } from './index.js';

describe('teacher foundation', () => {
  it('bootstraps without product features', () => {
    expect(bootstrap()).toContain('teacher foundation ready');
  });
});
