import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME, PACKAGE_VERSION } from './index.js';

describe('ai-coach foundation', () => {
  it('exports package identity', () => {
    expect(PACKAGE_NAME).toBe('@pseudopilot/ai-coach');
    expect(PACKAGE_VERSION).toBe('0.0.0');
  });
});
