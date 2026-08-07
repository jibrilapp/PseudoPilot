import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_BLOCK_NESTING,
  P_NESTING_TOO_DEEP,
  parse,
} from './parse.js';

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

function deepIfCompact(depth: number): string {
  const lines = ['DECLARE N : INTEGER', 'N ← 1'];
  for (let i = 0; i < depth; i += 1) lines.push('IF N > 0 THEN');
  lines.push('N ← N + 1');
  for (let i = 0; i < depth; i += 1) lines.push('ENDIF');
  lines.push('OUTPUT N');
  return lines.join('\n');
}

describe('parse nesting limits (regression)', () => {
  it('accepts nesting at the default ceiling', () => {
    const result = parse(deepIfCompact(DEFAULT_MAX_BLOCK_NESTING));
    expect(result.ok).toBe(true);
  });

  it('rejects pathological nesting with P_NESTING_TOO_DEEP (no throw)', () => {
    const depth = DEFAULT_MAX_BLOCK_NESTING + 64;
    let threw = false;
    let result;
    try {
      result = parse(deepIfCompact(depth));
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(result!.ok).toBe(false);
    expect(
      result!.diagnostics.some((d) => d.code === P_NESTING_TOO_DEEP),
    ).toBe(true);
    // Recovery should not flood with leftover ENDIF noise.
    const unexpected = result!.diagnostics.filter(
      (d) => d.code === 'E_UNEXPECTED_KW',
    ).length;
    expect(unexpected).toBeLessThan(8);
  });

  it('honours a lowered maxBlockNesting option', () => {
    const result = parse(deepIfCompact(20), { maxBlockNesting: 8 });
    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some((d) => d.code === P_NESTING_TOO_DEEP),
    ).toBe(true);
  });
});
