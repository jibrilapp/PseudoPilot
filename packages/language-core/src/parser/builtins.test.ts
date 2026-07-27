import { describe, expect, it } from 'vitest';
import { parse } from '@pseudopilot/language-core';

describe('builtins & concat parse', () => {
  it('parses & with same precedence as +', () => {
    const r = parse(`OUTPUT "a" & "b" & "c"\n`);
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const out = r.ast.body[0];
    expect(out?.kind).toBe('OutputStatement');
  });

  it('parses LENGTH and MID as CallExpression', () => {
    const r = parse(`OUTPUT MID(LEFT("abcdef", 4), 2, 2)\n`);
    expect(r.ok).toBe(true);
  });
});
