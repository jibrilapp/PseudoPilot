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

  it('translates WHILE (Count < 10) — IDE smoke', () => {
    const result = translatePseudocodeToPython(`WHILE Count < 10
    OUTPUT Count
    Count ← Count + 1
ENDWHILE
`);
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(norm(result.code)).toBe(
      'while Count < 10:\n    print(Count)\n    Count = Count + 1\n',
    );
  });

  it('does not emit T_UNSUPPORTED for valid WHILE', () => {
    const result = translatePseudocodeToPython(`
WHILE TRUE DO
    OUTPUT 1
ENDWHILE
`);
    expect(result.ok).toBe(true);
    expect(
      result.diagnostics.some((d) => d.code.startsWith('T_UNSUPPORTED')),
    ).toBe(false);
  });

  it('translates REPEAT UNTIL — IDE smoke', () => {
    const result = translatePseudocodeToPython(`REPEAT
    OUTPUT Count
    Count ← Count + 1
UNTIL Count > 10
`);
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(norm(result.code)).toBe(
      'while True:\n    print(Count)\n    Count = Count + 1\n    if Count > 10:\n        break\n',
    );
  });

  it('round-trips REPEAT through dist printers', () => {
    const py = translatePseudocodeToPython(`REPEAT
    OUTPUT Count
    Count ← Count + 1
UNTIL Count > 10
`);
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toContain('REPEAT');
    expect(norm(back.code)).toContain('UNTIL Count > 10');
  });

  it('translates FOR loop — IDE smoke', () => {
    const result = translatePseudocodeToPython(`FOR Count ← 1 TO 10
    OUTPUT Count
NEXT Count
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'for Count in range(1, 10 + 1):\n    print(Count)\n',
    );
  });

  it('round-trips FOR through dist printers', () => {
    const py = translatePseudocodeToPython(`FOR I ← 10 TO 1 STEP -1
    OUTPUT I
NEXT I
`);
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toContain('FOR I');
    expect(norm(back.code)).toContain('STEP -1');
    expect(norm(back.code)).toContain('NEXT I');
  });

  it('translates CASE OF — IDE smoke', () => {
    const result = translatePseudocodeToPython(`CASE OF Choice
    1 :
        OUTPUT "one"
    OTHERWISE
        OUTPUT "other"
ENDCASE
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'match Choice:\n    case 1:\n        print("one")\n    case _:\n        print("other")\n',
    );
  });

  it('round-trips CASE through dist printers', () => {
    const py = translatePseudocodeToPython(`CASE OF N
    1 TO 5 :
        OUTPUT "low"
    OTHERWISE
        OUTPUT "high"
ENDCASE
`);
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toContain('CASE OF N');
    expect(norm(back.code)).toContain('1 TO 5');
    expect(norm(back.code)).toContain('OTHERWISE');
  });
});
