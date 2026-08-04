import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';

describe('parser recovery — expression vs structural diagnostics', () => {
  it('reports missing ) with E_MISSING_RPAREN and still closes FOR with NEXT', () => {
    const result = parse(`
FOR count ← 1 TO 5
  OUTPUT LENGTH(
NEXT count
`);
    expect(result.diagnostics.some((d) => d.code === 'E_MISSING_RPAREN')).toBe(
      true,
    );
    // NEXT must still close the loop — do not cascade a misleading E_FOR_NEXT.
    expect(result.diagnostics.some((d) => d.code === 'E_FOR_NEXT')).toBe(false);
    expect(result.ast?.body.some((s) => s.kind === 'ForStatement')).toBe(true);
  });

  it('does not treat NEXT as part of a malformed call expression', () => {
    const result = parse(`
FOR i ← 1 TO 3
  OUTPUT MID("ab", 1
NEXT i
`);
    expect(
      result.diagnostics.some(
        (d) => d.code === 'E_MISSING_RPAREN' || d.message.includes('")"'),
      ),
    ).toBe(true);
    expect(result.diagnostics.some((d) => d.code === 'E_FOR_NEXT')).toBe(false);
  });

  it('parses LENGTH(5) cleanly so the checker can report C_BUILTIN_ARG_TYPE', () => {
    const result = parse(`
DECLARE count : INTEGER
count ← LENGTH(5)
`);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('recovers nested FOR when an inner call is missing )', () => {
    const result = parse(`
FOR a ← 1 TO 5
  FOR b ← 1 TO 3
    OUTPUT LENGTH(
  NEXT b
NEXT a
`);
    expect(result.diagnostics.some((d) => d.code === 'E_MISSING_RPAREN')).toBe(
      true,
    );
    expect(result.diagnostics.some((d) => d.code === 'E_FOR_NEXT')).toBe(false);
  });
});
