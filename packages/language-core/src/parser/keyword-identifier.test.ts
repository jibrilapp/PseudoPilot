import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';

const MIDDLE_PROGRAM = `DECLARE output : STRING

FUNCTION middle(x : STRING, y : INTEGER, z : INTEGER) RETURNS STRING

DECLARE length : INTEGER

DECLARE right,answer : STRING

length ← LENGTH(x)

right ← RIGHT(x,(length-y) + 1)

answer ← LEFT(right,z)

RETURN answer

ENDFUNCTION

output ← middle("hello",3,3)

OUTPUT output
`;

describe('keyword/identifier spelling (Cambridge presentation)', () => {
  it('parses lowercase output as identifier alongside OUTPUT statement', () => {
    const result = parse(MIDDLE_PROGRAM);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('still parses lowercase output as OUTPUT statement when not assigning', () => {
    const result = parse('output name\n');
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.ast!.body[0]?.kind).toBe('OutputStatement');
  });

  it('rejects uppercase OUTPUT as identifier in DECLARE', () => {
    const result = parse('DECLARE OUTPUT : STRING\n');
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.message === 'Expected identifier.')).toBe(true);
  });
});
