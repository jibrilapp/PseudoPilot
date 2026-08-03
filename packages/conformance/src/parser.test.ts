import { describe, expect, it } from 'vitest';
import { parse } from '@pseudopilot/language-core';
import { CORPUS } from './corpus/index.js';
import { parseOk } from './helpers.js';

describe('conformance / parser', () => {
  it('parses every corpus program', () => {
    for (const entry of CORPUS) {
      const r = parseOk(entry.source);
      expect(r.ast.kind, entry.id).toBe('Program');
      expect(r.ast.body.length, entry.id).toBeGreaterThan(0);
    }
  });

  it('recovers on invalid programs without crashing', () => {
    const samples = [
      'IF TRUE\nOUTPUT 1\n',
      'DECLARE\n',
      'FUNCTION F RETURNS INTEGER\nENDFUNCTION\n',
      '((((\n',
      '',
    ];
    for (const src of samples) {
      expect(() => parse(src)).not.toThrow();
      const r = parse(src);
      expect(r.ast.kind).toBe('Program');
    }
  });

  it('parses nested control structures', () => {
    const src = `
WHILE TRUE
  FOR I ← 1 TO 2
    IF I = 1 THEN
      OUTPUT I
    ENDIF
  NEXT I
ENDWHILE
`;
    const r = parseOk(src);
    expect(r.ast.body[0]?.kind).toBe('WhileStatement');
  });
});
