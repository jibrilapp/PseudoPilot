import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import type { Program } from '../ast/nodes.js';

/**
 * Loop edge-case charter (WHILE / FOR / REPEAT).
 *
 * Success cases use `it.fails` — they document desired Cambridge behaviour and
 * are *known red* until the loop milestone lands (today: E_UNSUPPORTED).
 *
 * Rejection cases use normal `it` — they already fail closed (ok === false).
 */

function parseOk(source: string): Program {
  const result = parse(source);
  expect(result.ok, JSON.stringify(result.diagnostics, null, 2)).toBe(true);
  return result.ast;
}

describe('edge cases — loops (WHILE / FOR / REPEAT)', () => {
  describe('WHILE — now implemented', () => {
    it('1. minimal WHILE … ENDWHILE', () => {
      expect(parseOk(`
WHILE Count < 10
    Count ← Count + 1
ENDWHILE
`).body[0]?.kind).toBe('WhileStatement');
    });

    it('2. WHILE with empty body', () => {
      expect(parseOk(`
WHILE FALSE
ENDWHILE
`).body[0]?.kind).toBe('WhileStatement');
    });

    it('3. WHILE condition with AND/OR/NOT', () => {
      parseOk(`
WHILE NOT Done AND Tries < 3 OR Flag = TRUE
    OUTPUT Tries
ENDWHILE
`);
    });

    it('4. nested WHILE', () => {
      parseOk(`
WHILE I < 3
    WHILE J < 3
        OUTPUT I, J
        J ← J + 1
    ENDWHILE
    I ← I + 1
ENDWHILE
`);
    });

    it('5. WHILE containing IF', () => {
      parseOk(`
WHILE X > 0
    IF X = 1 THEN
        OUTPUT "one"
    ENDIF
    X ← X - 1
ENDWHILE
`);
    });

    it('6. IF containing WHILE', () => {
      parseOk(`
IF Run = TRUE THEN
    WHILE N > 0
        N ← N - 1
    ENDWHILE
ENDIF
`);
    });

    it('7. WHILE inside PROCEDURE with locals', () => {
      parseOk(`
PROCEDURE CountDown(N : INTEGER)
    DECLARE I : INTEGER
    I ← N
    WHILE I > 0
        OUTPUT I
        I ← I - 1
    ENDWHILE
ENDPROCEDURE
`);
    });
  });

  describe('desired successful parses (known failing — FOR / REPEAT)', () => {
    it.fails('8. minimal FOR … NEXT', () => {
      expect(parseOk(`
FOR I ← 1 TO 10
    OUTPUT I
NEXT I
`).body[0]?.kind).toBe('ForStatement');
    });

    it.fails('9. FOR with empty body', () => {
      parseOk(`
FOR I ← 1 TO 1
NEXT I
`);
    });

    it.fails('10. FOR bounds are expressions', () => {
      parseOk(`
FOR I ← Start + 1 TO End * 2
    OUTPUT I
NEXT I
`);
    });

    it.fails('11. nested FOR loops', () => {
      parseOk(`
FOR I ← 1 TO 3
    FOR J ← 1 TO 3
        OUTPUT I, J
    NEXT J
NEXT I
`);
    });

    it.fails('12. FOR with STEP (Cambridge extension)', () => {
      parseOk(`
FOR I ← 10 TO 1 STEP -1
    OUTPUT I
NEXT I
`);
    });

    it.fails('13. FOR inside FUNCTION with RETURN after loop', () => {
      parseOk(`
FUNCTION SumTo(N : INTEGER) RETURNS INTEGER
    DECLARE Total : INTEGER
    DECLARE I : INTEGER
    Total ← 0
    FOR I ← 1 TO N
        Total ← Total + I
    NEXT I
    RETURN Total
ENDFUNCTION
`);
    });

    it('14. minimal REPEAT … UNTIL', () => {
      expect(parseOk(`
REPEAT
    INPUT X
UNTIL X > 0
`).body[0]?.kind).toBe('RepeatStatement');
    });

    it('15. REPEAT with empty body', () => {
      parseOk(`
REPEAT
UNTIL TRUE
`);
    });

    it('16. nested REPEAT', () => {
      parseOk(`
REPEAT
    REPEAT
        OUTPUT "inner"
    UNTIL InnerDone = TRUE
UNTIL OuterDone = TRUE
`);
    });

    it('17. REPEAT containing WHILE and IF', () => {
      parseOk(`
REPEAT
    WHILE Temp > 0
        Temp ← Temp - 1
    ENDWHILE
    IF Temp = 0 THEN
        OUTPUT "zero"
    ENDIF
UNTIL Finished = TRUE
`);
    });

    it('18. lowercase while keywords', () => {
      parseOk(`
while x < 3
    x ← x + 1
endwhile
`);
    });

    it('19. WHILE with function-call condition', () => {
      parseOk(`
FUNCTION More() RETURNS BOOLEAN
    RETURN TRUE
ENDFUNCTION

WHILE More()
    OUTPUT "tick"
ENDWHILE
`);
    });

    it.fails('20. deep nest WHILE > FOR > REPEAT', () => {
      parseOk(`
WHILE KeepGoing = TRUE
    FOR I ← 1 TO 3
        REPEAT
            OUTPUT I
        UNTIL Done = TRUE
    NEXT I
ENDWHILE
`);
    });
  });

  describe('rejection / closed-fail cases (pass today)', () => {
    it('21. rejects ENDWHILE without WHILE', () => {
      expect(parse(`ENDWHILE`).ok).toBe(false);
    });

    it('22. rejects NEXT without FOR', () => {
      expect(parse(`NEXT I`).ok).toBe(false);
    });

    it('23. rejects UNTIL without REPEAT', () => {
      expect(parse(`UNTIL TRUE`).ok).toBe(false);
    });

    it('24. accepts WHILE (no longer E_UNSUPPORTED)', () => {
      const result = parse(`WHILE TRUE\nOUTPUT 1\nENDWHILE`);
      expect(result.ok).toBe(true);
      expect(result.ast.body[0]?.kind).toBe('WhileStatement');
    });

    it('25. rejects FOR keyword today via E_UNSUPPORTED', () => {
      const result = parse(`FOR I ← 1 TO 3\nOUTPUT I\nNEXT I`);
      expect(result.ok).toBe(false);
      expect(result.diagnostics.some((d) => d.code === 'E_UNSUPPORTED')).toBe(true);
    });

    it('26. FOR NEXT name mismatch should fail (charter when FOR lands)', () => {
      // Today fails for E_UNSUPPORTED; when FOR lands this should stay a hard fail.
      const result = parse(`
FOR I ← 1 TO 5
    OUTPUT I
NEXT J
`);
      expect(result.ok).toBe(false);
    });
  });
});
