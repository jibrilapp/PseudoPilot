import { describe, expect, it } from 'vitest';
import { bootstrap } from './index.js';

describe('worker foundation', () => {
  it('bootstraps without product features', () => {
    expect(bootstrap()).toContain('worker foundation ready');
  });
});
