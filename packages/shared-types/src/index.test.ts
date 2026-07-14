import { describe, expect, it } from 'vitest';
import {
  PACKAGE_NAME,
  PLATFORM_NAME,
  type CapacityHint,
  type RateLimitResult,
} from './index.js';

describe('shared-types foundation', () => {
  it('names the platform', () => {
    expect(PLATFORM_NAME).toBe('PseudoPilot');
    expect(PACKAGE_NAME).toBe('@pseudopilot/shared-types');
  });

  it('models rate-limit and capacity contracts for scale', () => {
    const limit: RateLimitResult = {
      allowed: true,
      limit: 120,
      remaining: 119,
      resetAt: Date.now() + 60_000,
      scope: 'user',
    };
    const capacity: CapacityHint = {
      mode: 'ClientLocal',
      preferClientLocal: true,
    };
    expect(limit.allowed).toBe(true);
    expect(capacity.preferClientLocal).toBe(true);
  });
});
