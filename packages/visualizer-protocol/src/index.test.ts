import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME, PACKAGE_VERSION } from './index.js';

describe('visualizer-protocol foundation', () => {
  it('exports package identity', () => {
    expect(PACKAGE_NAME).toBe('@pseudopilot/visualizer-protocol');
    expect(PACKAGE_VERSION).toBe('0.0.0');
  });
});
