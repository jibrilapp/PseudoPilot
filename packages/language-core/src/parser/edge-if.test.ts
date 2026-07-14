import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import type { IfStatement, Program, Statement } from '../ast/nodes.js';

/**
 * Adversarial edge cases for the decision (IF) milestone.
 * Goal: try to break nesting, ELSE IF disambiguation, and recovery.
 */

function parseOk(source: string): Program {
  const result = parse(source);
  expect(result.ok, JSON.stringify(result.diagnostics, null, 2)).toBe(true);
  return result.ast;
}

function asIf(stmt: Statement | undefined): IfStatement {
  expect(stmt?.kind).toBe('IfStatement');
  return stmt as IfStatement;
}

describe('edge cases — IF / ELSE / ELSE IF (decision)', () => {
  it('1. empty THEN and empty ELSE', () => {
    const iff = asIf(
      parseOk(`
IF TRUE THEN
ELSE
ENDIF
`).body[0],
    );
    expect(iff.consequent).toEqual([]);
    expect(iff.alternate).toEqual([]);
  });

  it('1b. IF condition with THEN on the next line', () => {
    parseOk(`
IF A = 1
THEN
    OUTPUT 1
ENDIF
`);
  });

  it('2. comments between every structural keyword', () => {
    const iff = asIf(
      parseOk(`
// before
IF TRUE // cond
THEN // then
    // body
    OUTPUT 1 // out
// mid
ELSE // else
    OUTPUT 2
// end
ENDIF // done
`).body[0],
    );
    expect(iff.consequent).toHaveLength(1);
    expect(iff.alternate).toHaveLength(1);
  });

  it('3. deep nesting (5 levels)', () => {
    const source = `
IF A = 1 THEN
  IF B = 2 THEN
    IF C = 3 THEN
      IF D = 4 THEN
        IF E = 5 THEN
          OUTPUT "deep"
        ENDIF
      ENDIF
    ENDIF
  ENDIF
ENDIF
`;
    let node: Statement | undefined = parseOk(source).body[0];
    for (let depth = 0; depth < 5; depth++) {
      const iff = asIf(node);
      if (depth < 4) node = iff.consequent[0];
      else expect(iff.consequent[0]?.kind).toBe('OutputStatement');
    }
  });

  it('4. ELSE IF chain with empty middle clause', () => {
    const iff = asIf(
      parseOk(`
IF A = 1 THEN
    OUTPUT 1
ELSE IF A = 2 THEN
ELSE IF A = 3 THEN
    OUTPUT 3
ELSE
    OUTPUT 0
ENDIF
`).body[0],
    );
    expect(iff.elseIfClauses).toHaveLength(2);
    expect(iff.elseIfClauses[0]?.consequent).toEqual([]);
    expect(iff.elseIfClauses[1]?.consequent).toHaveLength(1);
  });

  it('5. lowercase keywords still lex as IF/THEN/ENDIF', () => {
    const iff = asIf(parseOk(`if true then\nOUTPUT 1\nendif`).body[0]);
    expect(iff.condition).toMatchObject({ kind: 'BooleanLiteral', value: true });
  });

  it('6. condition with function call and logic', () => {
    const iff = asIf(
      parseOk(`
FUNCTION Ready() RETURNS BOOLEAN
    RETURN TRUE
ENDFUNCTION

IF Ready() AND NOT Done OR X < 0 THEN
    OUTPUT "go"
ENDIF
`).body[1],
    );
    expect(iff.condition.kind).toBe('BinaryExpression');
  });

  it('7. parenthesized condition with mixed precedence', () => {
    const iff = asIf(
      parseOk(`
IF (A < 1 OR B > 2) AND C = 3 THEN
    OUTPUT 1
ENDIF
`).body[0],
    );
    expect(iff.condition.kind).toBe('BinaryExpression');
  });

  it('8. string and real comparisons', () => {
    parseOk(`
IF Name = "Ada" THEN
    OUTPUT 1
ENDIF
IF Rate >= 3.14 THEN
    OUTPUT 2
ENDIF
`);
  });

  it('9. many statements in each branch', () => {
    const iff = asIf(
      parseOk(`
IF OK = TRUE THEN
    DECLARE A : INTEGER
    INPUT A
    A ← A + 1
    OUTPUT A
ELSE
    DECLARE B : INTEGER
    B ← 0
    OUTPUT B
ENDIF
`).body[0],
    );
    expect(iff.consequent).toHaveLength(4);
    expect(iff.alternate).toHaveLength(3);
  });

  it('10. IF as only statement inside procedure', () => {
    parseOk(`
PROCEDURE Check(X : INTEGER)
    IF X > 0 THEN
        OUTPUT "pos"
    ENDIF
ENDPROCEDURE
`);
  });

  it('11. RETURN inside IF inside FUNCTION', () => {
    parseOk(`
FUNCTION Sign(X : INTEGER) RETURNS INTEGER
    IF X < 0 THEN
        RETURN -1
    ELSE IF X = 0 THEN
        RETURN 0
    ELSE
        RETURN 1
    ENDIF
ENDFUNCTION
`);
  });

  it('12. rejects second ELSE', () => {
    const result = parse(`
IF TRUE THEN
    OUTPUT 1
ELSE
    OUTPUT 2
ELSE
    OUTPUT 3
ENDIF
`);
    expect(result.ok).toBe(false);
  });

  it('13. rejects ELSE IF after final ELSE', () => {
    const result = parse(`
IF TRUE THEN
    OUTPUT 1
ELSE
    OUTPUT 2
ELSE IF FALSE THEN
    OUTPUT 3
ENDIF
`);
    expect(result.ok).toBe(false);
  });

  it('14. rejects IF without THEN', () => {
    const result = parse(`IF TRUE\nOUTPUT 1\nENDIF`);
    expect(result.ok).toBe(false);
  });

  it('15. rejects IF without ENDIF', () => {
    const result = parse(`IF TRUE THEN\nOUTPUT 1\n`);
    expect(result.ok).toBe(false);
  });

  it('16. rejects bare ENDIF', () => {
    const result = parse(`ENDIF`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_UNEXPECTED_KW')).toBe(true);
  });

  it('17. rejects bare THEN', () => {
    const result = parse(`THEN\nOUTPUT 1`);
    expect(result.ok).toBe(false);
  });

  it('18. rejects missing condition', () => {
    const result = parse(`IF THEN\nOUTPUT 1\nENDIF`);
    expect(result.ok).toBe(false);
  });

  it('19. rejects assignment operator in condition (←)', () => {
    const result = parse(`IF X ← 1 THEN\nOUTPUT 1\nENDIF`);
    expect(result.ok).toBe(false);
  });

  it('20. rejects two IFs jammed on one line without structure', () => {
    const result = parse(`IF TRUE THEN OUTPUT 1 ENDIF IF FALSE THEN OUTPUT 2 ENDIF`);
    expect(result.ok).toBe(false);
  });

  it('21. nested IF in ELSE IF clause body', () => {
    const iff = asIf(
      parseOk(`
IF A = 1 THEN
    OUTPUT "a"
ELSE IF A = 2 THEN
    IF B = 1 THEN
        OUTPUT "a2b1"
    ENDIF
ELSE
    OUTPUT "other"
ENDIF
`).body[0],
    );
    expect(iff.elseIfClauses[0]?.consequent[0]?.kind).toBe('IfStatement');
  });

  it('22. blank lines everywhere in a chain', () => {
    parseOk(`
IF A = 1 THEN


    OUTPUT 1


ELSE IF A = 2 THEN


    OUTPUT 2


ELSE


    OUTPUT 3


ENDIF
`);
  });

  it('23. CASE-like long ELSE IF ladder (10 clauses)', () => {
    let source = 'IF N = 0 THEN\nOUTPUT 0\n';
    for (let i = 1; i <= 10; i++) {
      source += `ELSE IF N = ${i} THEN\nOUTPUT ${i}\n`;
    }
    source += 'ELSE\nOUTPUT -1\nENDIF\n';
    const iff = asIf(parseOk(source).body[0]);
    expect(iff.elseIfClauses).toHaveLength(10);
  });

  it('24. recovers after a bad IF and still parses a later IF', () => {
    const result = parse(`
IF THEN
OUTPUT "bad"
ENDIF
IF TRUE THEN
OUTPUT "good"
ENDIF
`);
    expect(result.ok).toBe(false);
    expect(result.ast.body.some((s) => s.kind === 'IfStatement')).toBe(true);
  });
});
