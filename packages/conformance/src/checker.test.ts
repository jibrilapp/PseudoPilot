import { describe, expect, it } from 'vitest';
import { parse } from '@pseudopilot/language-core';
import { check } from '@pseudopilot/checker';
import { CORPUS } from './corpus/index.js';
import { checkOk } from './helpers.js';

describe('conformance / semantic checker', () => {
  it('accepts every corpus program', () => {
    for (const entry of CORPUS) {
      checkOk(entry.source);
    }
  });

  it('reports undeclared identifiers stably', () => {
    const a = check(parse('OUTPUT Missing\n').ast);
    const b = check(parse('OUTPUT Missing\n').ast);
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
    expect(a.diagnostics.map((d) => d.code)).toEqual(
      b.diagnostics.map((d) => d.code),
    );
  });

  it('rejects assign to CONSTANT', () => {
    const r = check(
      parse(`
CONSTANT Max = 1
Max ← 2
`).ast,
    );
    expect(r.diagnostics.some((d) => d.code === 'C_ASSIGN_TO_CONSTANT')).toBe(
      true,
    );
  });

  it('collects symbols for routines and params', () => {
    const { check: c } = checkOk(`
PROCEDURE P(X : INTEGER)
  DECLARE Y : INTEGER
  Y ← X
ENDPROCEDURE
`);
    const kinds = c.symbols.map((s) => `${s.kind}:${s.name}`);
    expect(kinds).toContain('procedure:P');
    expect(kinds).toContain('parameter:X');
    expect(kinds).toContain('variable:Y');
  });
});
