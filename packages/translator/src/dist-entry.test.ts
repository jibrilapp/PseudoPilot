/**
 * Regression: the IDE imports `@pseudopilot/translator` via package.json `exports`
 * → `./dist/index.js`. Vitest runs TypeScript from `src/`, so source-only tests
 * can pass while a stale `dist/` still rejects IF (T_UNSUPPORTED_IF).
 *
 * This suite must import the built entry. Run `pnpm build` before these tests
 * (wired via the package `test` script / turbo).
 */
import { describe, expect, it } from 'vitest';
import {
  translatePseudocodeToPython,
  translatePythonToPseudocode,
} from '../dist/index.js';

function norm(s: string): string {
  return s.replace(/\r\n/g, '\n');
}

describe('built dist entry (IDE import path)', () => {
  it('translates simple IF (Count > 5) — IDE smoke', () => {
    const result = translatePseudocodeToPython(`IF Count > 5 THEN
    OUTPUT Count
ENDIF
`);
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(norm(result.code)).toBe('if Count > 5:\n    print(Count)\n');
  });

  it('translates IF ELSE (Count > 5) — IDE smoke', () => {
    const result = translatePseudocodeToPython(`IF Count > 5 THEN
    OUTPUT Count
ELSE
    OUTPUT 0
ENDIF
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'if Count > 5:\n    print(Count)\nelse:\n    print(0)\n',
    );
  });

  it('does not emit T_UNSUPPORTED_IF for valid IF', () => {
    const result = translatePseudocodeToPython(`
IF X = 1 THEN
    OUTPUT X
ENDIF
`);
    expect(result.diagnostics.some((d) => d.code === 'T_UNSUPPORTED_IF')).toBe(
      false,
    );
    expect(result.ok).toBe(true);
  });

  it('round-trips IF through dist printers', () => {
    const py = translatePseudocodeToPython(`IF x > 5 THEN
    OUTPUT x
ELSE
    OUTPUT 0
ENDIF
`);
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toContain('IF x > 5 THEN');
    expect(norm(back.code)).toContain('ENDIF');
  });
});
