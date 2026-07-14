import { describe, expect, it } from 'vitest';
import { bootstrap } from './index.js';

describe('api foundation', () => {
  it('bootstraps without product features', () => {
    expect(bootstrap()).toContain('api foundation ready');
  });
});
