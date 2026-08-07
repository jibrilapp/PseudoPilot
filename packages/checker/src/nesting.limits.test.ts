import { describe, expect, it } from 'vitest';
import { parse } from '@pseudopilot/language-core';
import {
  C_NESTING_TOO_DEEP,
  DEFAULT_MAX_STATEMENT_NESTING,
  check,
} from './index.js';

function deepIfAst(depth: number) {
  // Build via parser with a raised nesting ceiling so we can unit-test the checker.
  const lines = ['DECLARE N : INTEGER', 'N ← 1'];
  for (let i = 0; i < depth; i += 1) lines.push('IF N > 0 THEN');
  lines.push('N ← N + 1');
  for (let i = 0; i < depth; i += 1) lines.push('ENDIF');
  lines.push('OUTPUT N');
  return parse(lines.join('\n'), { maxBlockNesting: depth + 8 });
}

describe('checker nesting limits (regression)', () => {
  it('accepts nesting at the default ceiling', () => {
    const parsed = deepIfAst(DEFAULT_MAX_STATEMENT_NESTING);
    expect(parsed.ok).toBe(true);
    const result = check(parsed.ast);
    expect(result.ok).toBe(true);
  });

  it('rejects deeper nesting with C_NESTING_TOO_DEEP (no throw)', () => {
    const parsed = deepIfAst(DEFAULT_MAX_STATEMENT_NESTING + 32);
    expect(parsed.ok).toBe(true);
    let threw = false;
    let result;
    try {
      result = check(parsed.ast);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(result!.ok).toBe(false);
    expect(
      result!.diagnostics.some((d) => d.code === C_NESTING_TOO_DEEP),
    ).toBe(true);
  });

  it('honours lowered maxStatementNesting', () => {
    const parsed = deepIfAst(40);
    expect(parsed.ok).toBe(true);
    const result = check(parsed.ast, { maxStatementNesting: 8 });
    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some((d) => d.code === C_NESTING_TOO_DEEP),
    ).toBe(true);
  });
});
