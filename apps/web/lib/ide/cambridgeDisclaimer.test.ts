import { describe, expect, it } from 'vitest';
import {
  CAMBRIDGE_DISCLAIMER,
  CAMBRIDGE_DISCLAIMER_SHORT,
} from './cambridgeDisclaimer';

describe('cambridgeDisclaimer', () => {
  it('states educational alignment and denies official Cambridge affiliation', () => {
    expect(CAMBRIDGE_DISCLAIMER).toMatch(/educational tool/i);
    expect(CAMBRIDGE_DISCLAIMER).toMatch(/9618/);
    expect(CAMBRIDGE_DISCLAIMER).toMatch(/not an official Cambridge International product/i);
    expect(CAMBRIDGE_DISCLAIMER).toMatch(/does not guarantee exam board endorsement/i);
  });

  it('provides a short status-bar label', () => {
    expect(CAMBRIDGE_DISCLAIMER_SHORT).toMatch(/unofficial/i);
    expect(CAMBRIDGE_DISCLAIMER_SHORT).toMatch(/not affiliated/i);
  });
});
