import { describe, expect, it } from 'vitest';
import { bootstrap } from './index.js';

describe('runtime-sandbox foundation', () => {
  it('bootstraps as an extractable service', () => {
    expect(bootstrap()).toContain('runtime-sandbox ready');
  });
});
