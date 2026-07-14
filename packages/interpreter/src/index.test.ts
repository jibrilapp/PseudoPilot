import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME, PACKAGE_VERSION } from './index.js';

describe('interpreter foundation', () => {
  it('exports package identity', () => {
    expect(PACKAGE_NAME).toBe('@pseudopilot/interpreter');
    expect(PACKAGE_VERSION).toBe('0.0.0');
  });
});
