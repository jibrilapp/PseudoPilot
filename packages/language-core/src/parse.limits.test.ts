import { describe, expect, it } from 'vitest';
import { parse } from './parse.js';

describe('parse source size limits', () => {
  it('rejects oversized source with P_SOURCE_TOO_LARGE', () => {
    const source = 'X ← 1\n'.repeat(50);
    const result = parse(source, { maxSourceChars: 8 });
    expect(result.ok).toBe(false);
    expect(result.ast.body).toEqual([]);
    expect(result.diagnostics.some((d) => d.code === 'P_SOURCE_TOO_LARGE')).toBe(
      true,
    );
  });

  it('parses within the configured budget', () => {
    const result = parse('X ← 1\n', { maxSourceChars: 100 });
    expect(result.ok).toBe(true);
    expect(result.ast.body).toHaveLength(1);
  });
});
