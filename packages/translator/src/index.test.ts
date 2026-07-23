import { describe, expect, it } from 'vitest';
import {
  translatePseudocodeToPython,
  translatePythonToPseudocode,
} from './index.js';

function norm(s: string): string {
  return s.replace(/\r\n/g, '\n').trimEnd() + '\n';
}

describe('translatePseudocodeToPython (V1)', () => {
  it('translates assignment and arithmetic', () => {
    const result = translatePseudocodeToPython(`
Count ← 2 + 3 * 4
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('Count = 2 + 3 * 4\n');
  });

  it('translates DIV and MOD', () => {
    const result = translatePseudocodeToPython(`
Q ← 10 DIV 3
R ← 10 MOD 3
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('Q = 10 // 3\nR = 10 % 3\n');
  });

  it('translates INPUT and OUTPUT', () => {
    const result = translatePseudocodeToPython(`
INPUT Name
OUTPUT "Hello", Name
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('Name = input()\nprint("Hello", Name)\n');
  });

  it('translates literals and booleans', () => {
    const result = translatePseudocodeToPython(`
Flag ← TRUE
Msg ← "hi"
N ← 3.5
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('Flag = True\nMsg = "hi"\nN = 3.5\n');
  });

  it('translates relational and logical expressions', () => {
    const result = translatePseudocodeToPython(`
Ok ← Score >= 50 AND NOT Flag
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('Ok = Score >= 50 and not Flag\n');
  });

  it('preserves grouping parentheses when required', () => {
    const result = translatePseudocodeToPython(`
X ← (2 + 3) * 4
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('X = (2 + 3) * 4\n');
  });

  it('preserves // comments as # comments', () => {
    const result = translatePseudocodeToPython(`
// setup
X ← 1
`);
    expect(result.ok).toBe(true);
    expect(result.code).toContain('# setup');
    expect(result.code).toContain('X = 1');
  });

  it('accepts ASCII <- assignment', () => {
    const result = translatePseudocodeToPython(`X <- 1 + 2\n`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('X = 1 + 2\n');
  });

  it('translates simple IF', () => {
    const result = translatePseudocodeToPython(`
IF X = 1 THEN
    OUTPUT X
ENDIF
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('if X == 1:\n    print(X)\n');
  });

  it('translates IF ELSE', () => {
    const result = translatePseudocodeToPython(`
IF X > 5 THEN
    OUTPUT X
ELSE
    OUTPUT 0
ENDIF
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'if X > 5:\n    print(X)\nelse:\n    print(0)\n',
    );
  });

  it('translates nested IF', () => {
    const result = translatePseudocodeToPython(`
IF A = 1 THEN
    IF B = 2 THEN
        OUTPUT "both"
    ENDIF
ENDIF
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'if A == 1:\n    if B == 2:\n        print("both")\n',
    );
  });

  it('translates ELSE IF to elif', () => {
    const result = translatePseudocodeToPython(`
IF X = 1 THEN
    OUTPUT 1
ELSE IF X = 2 THEN
    OUTPUT 2
ELSE
    OUTPUT 0
ENDIF
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'if X == 1:\n    print(1)\nelif X == 2:\n    print(2)\nelse:\n    print(0)\n',
    );
  });

  it('translates empty IF branch to pass', () => {
    const result = translatePseudocodeToPython(`
IF Flag = TRUE THEN
ENDIF
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('if Flag == True:\n    pass\n');
  });

  it('translates multiple nested IF levels', () => {
    const result = translatePseudocodeToPython(`
IF A = 1 THEN
    IF B = 2 THEN
        IF C = 3 THEN
            OUTPUT C
        ELSE
            OUTPUT B
        ENDIF
    ENDIF
ENDIF
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'if A == 1:\n    if B == 2:\n        if C == 3:\n            print(C)\n        else:\n            print(B)\n',
    );
  });

  it('reports diagnostics for invalid IF syntax', () => {
    const result = translatePseudocodeToPython(`
IF X = 1
    OUTPUT X
ENDIF
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it('rejects DECLARE', () => {
    const result = translatePseudocodeToPython(`DECLARE X : INTEGER\n`);
    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some((d) => d.code === 'T_UNSUPPORTED_DECLARE'),
    ).toBe(true);
  });

  it('translates <> and unary minus', () => {
    const result = translatePseudocodeToPython(`Y ← -X <> 0\n`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('Y = -X != 0\n');
  });

  it('translates CHAR literals', () => {
    const result = translatePseudocodeToPython(`Letter ← 'A'\n`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(`Letter = 'A'\n`);
  });

  it('translates array element assignment and INPUT', () => {
    const result = translatePseudocodeToPython(`
Scores[1] ← 10
INPUT Scores[2]
OUTPUT Scores[1]
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'Scores[1] = 10\nScores[2] = input()\nprint(Scores[1])\n',
    );
  });

  it('translates multi-dimensional index as nested Python subscripts', () => {
    const result = translatePseudocodeToPython(`Grid[I, J] ← 1\n`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('Grid[I][J] = 1\n');
  });

  it('preserves trailing line comments', () => {
    const result = translatePseudocodeToPython(`X ← 1 // keep\n`);
    expect(result.ok).toBe(true);
    expect(result.code).toContain('X = 1');
    expect(result.code).toContain('# keep');
  });

  it('translates string escapes', () => {
    const result = translatePseudocodeToPython(`S ← "a\\"b"\n`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('S = "a\\"b"\n');
  });

  it('translates unary plus', () => {
    const result = translatePseudocodeToPython(`X ← +3\n`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('X = +3\n');
  });

  it('still emits partial code when a later unsupported stmt fails', () => {
    const result = translatePseudocodeToPython(`
X ← 1
DECLARE Y : INTEGER
`);
    expect(result.ok).toBe(false);
    expect(result.code).toContain('X = 1');
    expect(
      result.diagnostics.some((d) => d.code === 'T_UNSUPPORTED_DECLARE'),
    ).toBe(true);
  });
});

describe('translatePythonToPseudocode (V1)', () => {
  it('translates assignment and arithmetic', () => {
    const result = translatePythonToPseudocode(`count = 2 + 3 * 4\n`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('count ← 2 + 3 * 4\n');
  });

  it('translates // and % to DIV and MOD', () => {
    const result = translatePythonToPseudocode(`q = 10 // 3\nr = 10 % 3\n`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('q ← 10 DIV 3\nr ← 10 MOD 3\n');
  });

  it('translates input and print', () => {
    const result = translatePythonToPseudocode(`
name = input()
print("Hello", name)
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('INPUT name\nOUTPUT "Hello", name\n');
  });

  it('translates input(prompt) to OUTPUT + INPUT', () => {
    const result = translatePythonToPseudocode(`name = input("Enter name")\n`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('OUTPUT "Enter name"\nINPUT name\n');
  });

  it('translates True/False and comparisons', () => {
    const result = translatePythonToPseudocode(
      `ok = score >= 50 and not flag\n`,
    );
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('ok ← score >= 50 AND NOT flag\n');
  });

  it('can emit ASCII <-', () => {
    const result = translatePythonToPseudocode(`x = 1\n`, {
      assignmentArrow: 'ascii',
    });
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('x <- 1\n');
  });

  it('preserves # comments as // comments', () => {
    const result = translatePythonToPseudocode(`
# setup
x = 1
`);
    expect(result.ok).toBe(true);
    expect(result.code).toContain('// setup');
    expect(result.code).toContain('x ← 1');
  });

  it('rejects while (not IF) indented control flow', () => {
    const result = translatePythonToPseudocode(`
while True:
    print(1)
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'T_PY_PARSE')).toBe(true);
  });

  it('translates simple if', () => {
    const result = translatePythonToPseudocode(`
if x > 5:
    print(x)
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('IF x > 5 THEN\n    OUTPUT x\nENDIF\n');
  });

  it('translates if else', () => {
    const result = translatePythonToPseudocode(`
if x > 5:
    print(x)
else:
    print(0)
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'IF x > 5 THEN\n    OUTPUT x\nELSE\n    OUTPUT 0\nENDIF\n',
    );
  });

  it('translates elif to ELSE IF', () => {
    const result = translatePythonToPseudocode(`
if x == 1:
    print(1)
elif x == 2:
    print(2)
else:
    print(0)
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'IF x = 1 THEN\n    OUTPUT 1\nELSE IF x = 2 THEN\n    OUTPUT 2\nELSE\n    OUTPUT 0\nENDIF\n',
    );
  });

  it('translates nested if', () => {
    const result = translatePythonToPseudocode(`
if a == 1:
    if b == 2:
        print("both")
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'IF a = 1 THEN\n    IF b = 2 THEN\n        OUTPUT "both"\n    ENDIF\nENDIF\n',
    );
  });

  it('translates empty if body (pass)', () => {
    const result = translatePythonToPseudocode(`
if flag:
    pass
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('IF flag THEN\nENDIF\n');
  });

  it('reports diagnostics for invalid Python if syntax', () => {
    const result = translatePythonToPseudocode(`
if x > 5
    print(x)
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it('translates CHAR and indexed assignment', () => {
    const result = translatePythonToPseudocode(`
ch = 'Z'
scores[1] = 10
scores[2] = input()
print(scores[1], ch)
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      `ch ← 'Z'\nscores[1] ← 10\nINPUT scores[2]\nOUTPUT scores[1], ch\n`,
    );
  });

  it('translates nested Python indexes to Cambridge multi-index', () => {
    const result = translatePythonToPseudocode(`grid[i][j] = 1\n`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('grid[i, j] ← 1\n');
  });

  it('translates empty print()', () => {
    const result = translatePythonToPseudocode(`print()\n`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('OUTPUT\n');
  });

  it('translates unary plus', () => {
    const result = translatePythonToPseudocode(`x = +3\n`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('x ← +3\n');
  });
});

describe('round trip (V1 normalized)', () => {
  it('pseudocode → python → pseudocode preserves meaning', () => {
    const source = `Total ← 1 + 2 * 3
OUTPUT Total
`;
    const py = translatePseudocodeToPython(source);
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toBe(norm(source));
  });

  it('python → pseudocode → python preserves meaning', () => {
    const source = `total = 1 + 2 * 3
print(total)
`;
    const ps = translatePythonToPseudocode(source);
    expect(ps.ok).toBe(true);
    const back = translatePseudocodeToPython(ps.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toBe(norm(source));
  });

  it('round-trips DIV/MOD', () => {
    const source = `A ← 17 DIV 5
B ← 17 MOD 5
`;
    const py = translatePseudocodeToPython(source);
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toBe(norm(source));
  });

  it('round-trips CHAR and array element access', () => {
    const source = `Letter ← 'A'
Scores[1] ← 10
OUTPUT Scores[1], Letter
`;
    const py = translatePseudocodeToPython(source);
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toBe(norm(source));
  });

  it('round-trips IF ELSE', () => {
    const source = `IF x > 5 THEN
    OUTPUT x
ELSE
    OUTPUT 0
ENDIF
`;
    const py = translatePseudocodeToPython(source);
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toBe(norm(source));
  });
});

describe('operators module / precedence printing', () => {
  it('does not over-parenthesize left-assoc chains', () => {
    const result = translatePseudocodeToPython(`X ← 1 + 2 + 3\n`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('X = 1 + 2 + 3\n');
  });

  it('parenthesizes when mixed precedence requires it from source grouping', () => {
    const result = translatePythonToPseudocode(`x = 2 * (3 + 4)\n`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('x ← 2 * (3 + 4)\n');
  });
});
