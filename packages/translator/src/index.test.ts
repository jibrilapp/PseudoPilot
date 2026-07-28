import { describe, expect, it } from 'vitest';
import {
  translatePseudocodeToPython as translateCam,
  translatePythonToPseudocode,
} from './index.js';
import {
  ABSOLUTE_MAX_SOURCE_CHARS,
  type TranslateOptions,
} from './types.js';

/** Golden IR/print tests disable the checker so undeclared demo vars still translate. */
function translatePseudocodeToPython(
  source: string,
  options?: TranslateOptions,
) {
  return translateCam(source, { semanticCheck: false, ...options });
}

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

  it('translates simple WHILE', () => {
    const result = translatePseudocodeToPython(`
WHILE Count < 10
    Count ← Count + 1
ENDWHILE
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'while Count < 10:\n    Count = Count + 1\n',
    );
  });

  it('translates WHILE with DO', () => {
    const result = translatePseudocodeToPython(`
WHILE Count < 10 DO
    OUTPUT Count
ENDWHILE
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'while Count < 10:\n    print(Count)\n',
    );
  });

  it('translates nested WHILE', () => {
    const result = translatePseudocodeToPython(`
WHILE I < 2
    WHILE J < 2
        OUTPUT I, J
    ENDWHILE
ENDWHILE
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'while I < 2:\n    while J < 2:\n        print(I, J)\n',
    );
  });

  it('translates WHILE containing IF', () => {
    const result = translatePseudocodeToPython(`
WHILE X > 0
    IF X = 1 THEN
        OUTPUT "one"
    ENDIF
    X ← X - 1
ENDWHILE
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'while X > 0:\n    if X == 1:\n        print("one")\n    X = X - 1\n',
    );
  });

  it('translates IF containing WHILE', () => {
    const result = translatePseudocodeToPython(`
IF Run = TRUE THEN
    WHILE N > 0
        N ← N - 1
    ENDWHILE
ENDIF
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'if Run == True:\n    while N > 0:\n        N = N - 1\n',
    );
  });

  it('translates empty WHILE body to pass', () => {
    const result = translatePseudocodeToPython(`
WHILE FALSE
ENDWHILE
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('while False:\n    pass\n');
  });

  it('reports diagnostics for invalid WHILE syntax', () => {
    const result = translatePseudocodeToPython(`
WHILE TRUE
    OUTPUT 1
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it('translates REPEAT UNTIL', () => {
    const result = translatePseudocodeToPython(`
REPEAT
    OUTPUT Count
    Count ← Count + 1
UNTIL Count > 10
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'while True:\n    print(Count)\n    Count = Count + 1\n    if Count > 10:\n        break\n',
    );
  });

  it('translates empty REPEAT body', () => {
    const result = translatePseudocodeToPython(`
REPEAT
UNTIL TRUE
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('while True:\n    pass\n    if True:\n        break\n');
  });

  it('translates REPEAT inside WHILE', () => {
    const result = translatePseudocodeToPython(`
WHILE Flag = TRUE
    REPEAT
        OUTPUT Count
    UNTIL Count > 10
ENDWHILE
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'while Flag == True:\n    while True:\n        print(Count)\n        if Count > 10:\n            break\n',
    );
  });

  it('translates WHILE inside REPEAT', () => {
    const result = translatePseudocodeToPython(`
REPEAT
    WHILE Count < 10
        OUTPUT Count
    ENDWHILE
UNTIL Done = TRUE
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'while True:\n    while Count < 10:\n        print(Count)\n    if Done == True:\n        break\n',
    );
  });

  it('translates IF inside REPEAT', () => {
    const result = translatePseudocodeToPython(`
REPEAT
    IF Count > 5 THEN
        OUTPUT Count
    ENDIF
UNTIL Count > 10
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'while True:\n    if Count > 5:\n        print(Count)\n    if Count > 10:\n        break\n',
    );
  });

  it('translates REPEAT inside IF', () => {
    const result = translatePseudocodeToPython(`
IF Run = TRUE THEN
    REPEAT
        OUTPUT Count
    UNTIL Count > 10
ENDIF
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'if Run == True:\n    while True:\n        print(Count)\n        if Count > 10:\n            break\n',
    );
  });

  it('reports diagnostics for missing UNTIL', () => {
    const result = translatePseudocodeToPython(`
REPEAT
    OUTPUT Count
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.message.includes('UNTIL'))).toBe(true);
  });

  it('reports diagnostics for malformed REPEAT condition', () => {
    const result = translatePseudocodeToPython(`
REPEAT
    OUTPUT Count
UNTIL
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it('translates OPENFILE / WRITEFILE / READFILE / CLOSEFILE / EOF', () => {
    const result = translatePseudocodeToPython(`
OPENFILE "f.txt" FOR WRITE
WRITEFILE "f.txt", "hi"
CLOSEFILE "f.txt"
OPENFILE "f.txt" FOR READ
DECLARE Line : STRING
WHILE NOT EOF("f.txt")
  READFILE "f.txt", Line
  OUTPUT Line
ENDWHILE
CLOSEFILE "f.txt"
`);
    expect(result.ok).toBe(true);
    expect(result.code).toContain('open("f.txt", "w")');
    expect(result.code).toContain('.write(');
    expect(result.code).toContain('.readline()');
    expect(result.code).toContain('_pp_eof(');
    expect(result.code).toContain('.close()');
  });

  it('round-trips file I/O through Python', () => {
    const src = `
OPENFILE "f.txt" FOR WRITE
WRITEFILE "f.txt", "hi"
CLOSEFILE "f.txt"
`;
    const py = translatePseudocodeToPython(src);
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toContain('OPENFILE "f.txt" FOR WRITE');
    expect(norm(back.code)).toContain('WRITEFILE "f.txt", "hi"');
    expect(norm(back.code)).toContain('CLOSEFILE "f.txt"');
  });

  it('round-trips dynamic-path file I/O via _pp_files', () => {
    const src = `
DECLARE Path : STRING
Path ← "dyn.txt"
OPENFILE Path FOR WRITE
WRITEFILE Path, "x"
CLOSEFILE Path
`;
    const py = translatePseudocodeToPython(src);
    expect(py.ok).toBe(true);
    expect(py.code).toContain('_pp_files[');
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toContain('OPENFILE Path FOR WRITE');
    expect(norm(back.code)).toContain('WRITEFILE Path, "x"');
    expect(norm(back.code)).toContain('CLOSEFILE Path');
  });

  it('translates DECLARE scalars', () => {
    const result = translatePseudocodeToPython(`DECLARE Count : INTEGER\n`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('Count: int\n');
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

  it('translates while loops', () => {
    const result = translatePythonToPseudocode(`
while True:
    print(1)
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'WHILE TRUE DO\n    OUTPUT 1\nENDWHILE\n',
    );
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

  it('translates nested while', () => {
    const result = translatePythonToPseudocode(`
while i < 2:
    while j < 2:
        print(i, j)
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'WHILE i < 2 DO\n    WHILE j < 2 DO\n        OUTPUT i, j\n    ENDWHILE\nENDWHILE\n',
    );
  });

  it('translates while containing if', () => {
    const result = translatePythonToPseudocode(`
while x > 0:
    if x == 1:
        print("one")
    x = x - 1
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'WHILE x > 0 DO\n    IF x = 1 THEN\n        OUTPUT "one"\n    ENDIF\n    x ← x - 1\nENDWHILE\n',
    );
  });

  it('translates if containing while', () => {
    const result = translatePythonToPseudocode(`
if run:
    while n > 0:
        n = n - 1
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'IF run THEN\n    WHILE n > 0 DO\n        n ← n - 1\n    ENDWHILE\nENDIF\n',
    );
  });

  it('translates empty while body (pass)', () => {
    const result = translatePythonToPseudocode(`
while False:
    pass
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('WHILE FALSE DO\nENDWHILE\n');
  });

  it('translates repeat-until pattern', () => {
    const result = translatePythonToPseudocode(`
while True:
    print(Count)
    Count = Count + 1
    if Count > 10:
        break
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'REPEAT\n    OUTPUT Count\n    Count ← Count + 1\nUNTIL Count > 10\n',
    );
  });

  it('translates repeat inside while', () => {
    const result = translatePythonToPseudocode(`
while flag:
    while True:
        print(Count)
        if Count > 10:
            break
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'WHILE flag DO\n    REPEAT\n        OUTPUT Count\n    UNTIL Count > 10\nENDWHILE\n',
    );
  });

  it('translates while inside repeat', () => {
    const result = translatePythonToPseudocode(`
while True:
    while count < 10:
        print(count)
    if done:
        break
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'REPEAT\n    WHILE count < 10 DO\n        OUTPUT count\n    ENDWHILE\nUNTIL done\n',
    );
  });

  it('translates if inside repeat', () => {
    const result = translatePythonToPseudocode(`
while True:
    if Count > 5:
        print(Count)
    if Count > 10:
        break
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'REPEAT\n    IF Count > 5 THEN\n        OUTPUT Count\n    ENDIF\nUNTIL Count > 10\n',
    );
  });

  it('translates repeat inside if', () => {
    const result = translatePythonToPseudocode(`
if run:
    while True:
        print(Count)
        if Count > 10:
            break
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'IF run THEN\n    REPEAT\n        OUTPUT Count\n    UNTIL Count > 10\nENDIF\n',
    );
  });

  it('rejects malformed repeat body', () => {
    const result = translatePythonToPseudocode(`
while True:
print(Count)
    if Count > 10:
        break
`);
    expect(result.ok).toBe(false);
  });

  it('rejects unsupported break outside repeat pattern', () => {
    const result = translatePythonToPseudocode(`
while x > 0:
    break
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'T_PY_PARSE')).toBe(true);
  });

  it('rejects single-arg range() for loops', () => {
    const result = translatePythonToPseudocode(`
for i in range(3):
    print(i)
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'T_PY_PARSE')).toBe(true);
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

  it('round-trips WHILE', () => {
    const source = `WHILE Count < 10 DO
    Count ← Count + 1
ENDWHILE
`;
    const py = translatePseudocodeToPython(source);
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toBe(norm(source));
  });

  it('round-trips REPEAT', () => {
    const source = `REPEAT
    OUTPUT Count
    Count ← Count + 1
UNTIL Count > 10
`;
    const py = translatePseudocodeToPython(source);
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toBe(norm(source));
  });
});

describe('FOR loop translation', () => {
  it('translates ascending FOR to Python range()', () => {
    const result = translatePseudocodeToPython(`
FOR Count ← 1 TO 10
    OUTPUT Count
NEXT Count
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('for Count in range(1, 10 + 1):\n    print(Count)\n');
  });

  it('translates descending FOR with STEP to Python range()', () => {
    const result = translatePseudocodeToPython(`
FOR I ← 10 TO 1 STEP -2
    OUTPUT I
NEXT I
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('for I in range(10, 1 - 1, -2):\n    print(I)\n');
  });

  it('translates FOR with positive STEP', () => {
    const result = translatePseudocodeToPython(`
FOR I ← 0 TO 20 STEP 5
    OUTPUT I
NEXT I
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('for I in range(0, 20 + 1, 5):\n    print(I)\n');
  });

  it('translates nested FOR loops', () => {
    const result = translatePseudocodeToPython(`
FOR I ← 1 TO 3
    FOR J ← 1 TO 3
        OUTPUT I, J
    NEXT J
NEXT I
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('for I in range(1, 3 + 1):');
    expect(norm(result.code)).toContain('for J in range(1, 3 + 1):');
    expect(norm(result.code)).toContain('print(I, J)');
  });

  it('translates IF inside FOR', () => {
    const result = translatePseudocodeToPython(`
FOR I ← 1 TO 10
    IF I > 5 THEN
        OUTPUT I
    ENDIF
NEXT I
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('for I in range(1, 10 + 1):');
    expect(norm(result.code)).toContain('if I > 5:');
  });

  it('translates FOR inside IF', () => {
    const result = translatePseudocodeToPython(`
IF Run = TRUE THEN
    FOR I ← 1 TO 5
        OUTPUT I
    NEXT I
ENDIF
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('if Run == True:');
    expect(norm(result.code)).toContain('for I in range(1, 5 + 1):');
  });

  it('translates WHILE inside FOR', () => {
    const result = translatePseudocodeToPython(`
FOR I ← 1 TO 5
    WHILE X > 0
        X ← X - 1
    ENDWHILE
NEXT I
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('for I in range(1, 5 + 1):');
    expect(norm(result.code)).toContain('while X > 0:');
  });

  it('translates FOR inside WHILE', () => {
    const result = translatePseudocodeToPython(`
WHILE More = TRUE
    FOR I ← 1 TO 3
        OUTPUT I
    NEXT I
ENDWHILE
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('while More == True:');
    expect(norm(result.code)).toContain('for I in range(1, 3 + 1):');
  });

  it('translates REPEAT inside FOR', () => {
    const result = translatePseudocodeToPython(`
FOR I ← 1 TO 5
    REPEAT
        OUTPUT I
    UNTIL Done = TRUE
NEXT I
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('for I in range(1, 5 + 1):');
    expect(norm(result.code)).toContain('while True:');
  });

  it('translates FOR with empty body', () => {
    const result = translatePseudocodeToPython(`
FOR I ← 1 TO 1
NEXT I
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('pass');
  });

  it('reports diagnostics for missing NEXT', () => {
    const result = translatePseudocodeToPython(`
FOR I ← 1 TO 10
    OUTPUT I
`);
    expect(result.ok).toBe(false);
  });

  it('reports diagnostics for malformed STEP', () => {
    const result = translatePseudocodeToPython(`
FOR I ← 1 TO 10 STEP
    OUTPUT I
NEXT I
`);
    expect(result.ok).toBe(false);
  });

  it('reports diagnostics for missing TO', () => {
    const result = translatePseudocodeToPython(`
FOR I ← 1 10
    OUTPUT I
NEXT I
`);
    expect(result.ok).toBe(false);
  });
});

describe('FOR reverse translation (Python → Cambridge)', () => {
  it('translates ascending range() to FOR', () => {
    const result = translatePythonToPseudocode(`
for Count in range(1, 10 + 1):
    print(Count)
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('FOR Count ← 1 TO 10\n    OUTPUT Count\nNEXT Count\n');
  });

  it('translates descending range() with step to FOR STEP', () => {
    const result = translatePythonToPseudocode(`
for I in range(10, 1 - 1, -2):
    print(I)
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('FOR I ← 10 TO 1 STEP -2\n    OUTPUT I\nNEXT I\n');
  });

  it('translates nested range() loops', () => {
    const result = translatePythonToPseudocode(`
for I in range(1, 3 + 1):
    for J in range(1, 3 + 1):
        print(I, J)
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('FOR I ← 1 TO 3');
    expect(norm(result.code)).toContain('FOR J ← 1 TO 3');
    expect(norm(result.code)).toContain('NEXT J');
    expect(norm(result.code)).toContain('NEXT I');
  });

  it('round-trips ascending FOR', () => {
    const source = `FOR Count ← 1 TO 10\n    OUTPUT Count\nNEXT Count\n`;
    const py = translatePseudocodeToPython(source);
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toBe(norm(source));
  });

  it('round-trips descending FOR with STEP', () => {
    const source = `FOR I ← 10 TO 1 STEP -1\n    OUTPUT I\nNEXT I\n`;
    const py = translatePseudocodeToPython(source);
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toBe(norm(source));
  });

  it('rejects range() without ±1 adjustment', () => {
    const result = translatePythonToPseudocode(`
for i in range(1, 10):
    print(i)
`);
    expect(result.ok).toBe(false);
  });

  it('translates FOR inside IF from Python', () => {
    const result = translatePythonToPseudocode(`
if Run == True:
    for I in range(1, 5 + 1):
        print(I)
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('FOR I ← 1 TO 5');
  });
});

describe('CASE OF translation', () => {
  it('translates simple CASE to match/case', () => {
    const result = translatePseudocodeToPython(`
CASE OF Choice
    1 :
        OUTPUT "one"
    2 :
        OUTPUT "two"
ENDCASE
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'match Choice:\n    case 1:\n        print("one")\n    case 2:\n        print("two")\n',
    );
  });

  it('translates CASE with OTHERWISE', () => {
    const result = translatePseudocodeToPython(`
CASE OF Choice
    1 :
        OUTPUT "one"
    OTHERWISE
        OUTPUT "other"
ENDCASE
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('case _:');
    expect(norm(result.code)).toContain('print("other")');
  });

  it('translates CASE range labels', () => {
    const result = translatePseudocodeToPython(`
CASE OF N
    1 TO 5 :
        OUTPUT "low"
ENDCASE
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('case _v if 1 <= _v and _v <= 5:');
  });

  it('translates nested CASE', () => {
    const result = translatePseudocodeToPython(`
CASE OF Outer
    1 :
        CASE OF Inner
            2 :
                OUTPUT "nested"
        ENDCASE
ENDCASE
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('match Outer:');
    expect(norm(result.code)).toContain('match Inner:');
  });

  it('translates CASE inside IF', () => {
    const result = translatePseudocodeToPython(`
IF Ready = TRUE THEN
    CASE OF X
        1 :
            OUTPUT 1
    ENDCASE
ENDIF
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('if Ready == True:');
    expect(norm(result.code)).toContain('match X:');
  });

  it('translates IF inside CASE', () => {
    const result = translatePseudocodeToPython(`
CASE OF X
    1 :
        IF Y > 0 THEN
            OUTPUT Y
        ENDIF
ENDCASE
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('case 1:');
    expect(norm(result.code)).toContain('if Y > 0:');
  });

  it('translates CASE inside FOR', () => {
    const result = translatePseudocodeToPython(`
FOR I ← 1 TO 3
    CASE OF I
        1 :
            OUTPUT "one"
        OTHERWISE
            OUTPUT I
    ENDCASE
NEXT I
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('for I in range(1, 3 + 1):');
    expect(norm(result.code)).toContain('match I:');
  });

  it('translates CASE inside WHILE', () => {
    const result = translatePseudocodeToPython(`
WHILE Going = TRUE
    CASE OF X
        0 :
            Going ← FALSE
    ENDCASE
ENDWHILE
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('while Going == True:');
    expect(norm(result.code)).toContain('match X:');
  });

  it('translates CASE inside REPEAT', () => {
    const result = translatePseudocodeToPython(`
REPEAT
    CASE OF X
        1 :
            OUTPUT 1
    ENDCASE
UNTIL Done = TRUE
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('while True:');
    expect(norm(result.code)).toContain('match X:');
  });

  it('reports diagnostics for missing ENDCASE', () => {
    const result = translatePseudocodeToPython(`
CASE OF Choice
    1 :
        OUTPUT 1
`);
    expect(result.ok).toBe(false);
  });

  it('reports diagnostics for missing OF', () => {
    const result = translatePseudocodeToPython(`
CASE Choice
    1 :
        OUTPUT 1
ENDCASE
`);
    expect(result.ok).toBe(false);
  });

  it('reports diagnostics for duplicate labels', () => {
    const result = translatePseudocodeToPython(`
CASE OF Choice
    1 :
        OUTPUT "a"
    1 :
        OUTPUT "b"
ENDCASE
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_CASE_DUP')).toBe(true);
  });
});

describe('CASE reverse translation (Python → Cambridge)', () => {
  it('translates match/case to CASE OF', () => {
    const result = translatePythonToPseudocode(`
match Choice:
    case 1:
        print("one")
    case 2:
        print("two")
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'CASE OF Choice\n    1 :\n        OUTPUT "one"\n    2 :\n        OUTPUT "two"\nENDCASE\n',
    );
  });

  it('translates case _ to OTHERWISE', () => {
    const result = translatePythonToPseudocode(`
match Choice:
    case 1:
        print("one")
    case _:
        print("other")
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('OTHERWISE');
    expect(norm(result.code)).toContain('OUTPUT "other"');
  });

  it('translates guarded range case to TO label', () => {
    const result = translatePythonToPseudocode(`
match N:
    case _v if 1 <= _v and _v <= 5:
        print("low")
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('1 TO 5');
  });

  it('round-trips simple CASE', () => {
    const source = `CASE OF Choice\n    1 :\n        OUTPUT "one"\n    OTHERWISE\n        OUTPUT "other"\nENDCASE\n`;
    const py = translatePseudocodeToPython(source);
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toBe(norm(source));
  });

  it('round-trips CASE with range', () => {
    const source = `CASE OF N\n    1 TO 5 :\n        OUTPUT "low"\n    OTHERWISE\n        OUTPUT "high"\nENDCASE\n`;
    const py = translatePseudocodeToPython(source);
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toBe(norm(source));
  });
});

describe('PROCEDURE translation', () => {
  it('translates PROCEDURE and CALL to def and call', () => {
    const result = translatePseudocodeToPython(`
PROCEDURE DisplaySum(A : INTEGER, B : INTEGER)
    OUTPUT A + B
ENDPROCEDURE

CALL DisplaySum(3, 4)
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'def DisplaySum(A: int, B: int):\n    print(A + B)\n\nDisplaySum(3, 4)\n',
    );
  });

  it('translates parameterless PROCEDURE', () => {
    const result = translatePseudocodeToPython(`
PROCEDURE Hello
    OUTPUT "hi"
ENDPROCEDURE
CALL Hello
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('def Hello():');
    expect(norm(result.code)).toContain('Hello()');
  });

  it('translates empty PROCEDURE body', () => {
    const result = translatePseudocodeToPython(`
PROCEDURE Nop()
ENDPROCEDURE
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('pass');
  });

  it('translates typed STRING and BOOLEAN params', () => {
    const result = translatePseudocodeToPython(`
PROCEDURE Show(Msg : STRING, Flag : BOOLEAN)
    OUTPUT Msg, Flag
ENDPROCEDURE
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('def Show(Msg: str, Flag: bool):');
  });

  it('translates nested CALL inside PROCEDURE', () => {
    const result = translatePseudocodeToPython(`
PROCEDURE Inner()
    OUTPUT "inner"
ENDPROCEDURE
PROCEDURE Outer()
    CALL Inner()
ENDPROCEDURE
CALL Outer()
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('def Inner():');
    expect(norm(result.code)).toContain('def Outer():');
    expect(norm(result.code)).toContain('Inner()');
    expect(norm(result.code)).toContain('Outer()');
  });

  it('translates PROCEDURE containing IF and FOR', () => {
    const result = translatePseudocodeToPython(`
PROCEDURE CountUp(N : INTEGER)
    FOR I ← 1 TO N
        IF I > 0 THEN
            OUTPUT I
        ENDIF
    NEXT I
ENDPROCEDURE
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('def CountUp(N: int):');
    expect(norm(result.code)).toContain('for I in range(1, N + 1):');
    expect(norm(result.code)).toContain('if I > 0:');
  });

  it('translates CALL with expression arguments', () => {
    const result = translatePseudocodeToPython(`
PROCEDURE P(A : INTEGER)
    OUTPUT A
ENDPROCEDURE
CALL P(X + 1)
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('P(X + 1)');
  });

  it('rejects RETURN outside FUNCTION', () => {
    const result = translatePseudocodeToPython(`
PROCEDURE Bad()
    RETURN 1
ENDPROCEDURE
`);
    expect(result.ok).toBe(false);
  });

  it('translates DECLARE inside PROCEDURE', () => {
    const result = translatePseudocodeToPython(`
PROCEDURE Bad()
    DECLARE X : INTEGER
    OUTPUT X
ENDPROCEDURE
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('X: int');
    expect(norm(result.code)).toContain('print(X)');
  });

  it('rejects missing ENDPROCEDURE', () => {
    const result = translatePseudocodeToPython(`
PROCEDURE Bad()
    OUTPUT 1
`);
    expect(result.ok).toBe(false);
  });

  it('rejects Python-keyword procedure names', () => {
    const result = translatePseudocodeToPython(`
PROCEDURE import()
    OUTPUT 1
ENDPROCEDURE
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'T_PROC_PY_KEYWORD')).toBe(true);
  });

  it('rejects duplicate procedure parameters', () => {
    const result = translatePseudocodeToPython(
      `
PROCEDURE P(A : INTEGER, A : INTEGER)
    OUTPUT A
ENDPROCEDURE
`,
      { semanticCheck: true },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'C_DUP_PARAMETER')).toBe(
      true,
    );
  });

  it('warns when CALL appears before PROCEDURE', () => {
    const result = translatePseudocodeToPython(`
CALL Foo()
PROCEDURE Foo()
    OUTPUT 1
ENDPROCEDURE
`);
    expect(result.ok).toBe(true);
    expect(result.diagnostics.some((d) => d.code === 'T_CALL_BEFORE_PROC')).toBe(true);
  });

  it('warns when procedure shadows print', () => {
    const result = translatePseudocodeToPython(`
PROCEDURE print()
    OUTPUT 1
ENDPROCEDURE
`);
    expect(result.ok).toBe(true);
    expect(result.diagnostics.some((d) => d.code === 'T_PROC_SHADOWS_BUILTIN')).toBe(true);
  });
});

describe('PROCEDURE reverse translation (Python → Cambridge)', () => {
  it('translates def and call to PROCEDURE and CALL', () => {
    const result = translatePythonToPseudocode(`
def DisplaySum(A: int, B: int):
    print(A + B)

DisplaySum(3, 4)
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'PROCEDURE DisplaySum(A : INTEGER, B : INTEGER)\n    OUTPUT A + B\nENDPROCEDURE\nCALL DisplaySum(3, 4)\n',
    );
  });

  it('defaults unannotated params to INTEGER', () => {
    const result = translatePythonToPseudocode(`
def Foo(A, B):
    print(A)
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('A : INTEGER');
    expect(norm(result.code)).toContain('B : INTEGER');
    expect(result.diagnostics.some((d) => d.code === 'T_PROC_DEFAULT_TYPE')).toBe(true);
  });

  it('rejects nested def', () => {
    const result = translatePythonToPseudocode(`
def Outer():
    def Inner():
        print(1)
    Inner()
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.message.includes('Nested'))).toBe(true);
  });

  it('maps def with return annotation to FUNCTION', () => {
    const result = translatePythonToPseudocode(`
def Foo() -> int:
    return 1
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('FUNCTION Foo() RETURNS INTEGER');
    expect(norm(result.code)).toContain('RETURN 1');
  });

  it('rejects duplicate Python parameters', () => {
    const result = translatePythonToPseudocode(`
def Foo(A: int, A: int):
    print(A)
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.message.includes('Duplicate'))).toBe(true);
  });

  it('round-trips PROCEDURE with CALL', () => {
    const source = `PROCEDURE DisplaySum(A : INTEGER, B : INTEGER)\n    OUTPUT A + B\nENDPROCEDURE\nCALL DisplaySum(3, 4)\n`;
    const py = translatePseudocodeToPython(source);
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toBe(norm(source));
  });

  it('round-trips nested procedure calls', () => {
    const source = `PROCEDURE Inner()\n    OUTPUT "inner"\nENDPROCEDURE\nPROCEDURE Outer()\n    CALL Inner()\nENDPROCEDURE\nCALL Outer()\n`;
    const py = translatePseudocodeToPython(source);
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toContain('PROCEDURE Inner');
    expect(norm(back.code)).toContain('CALL Inner()');
    expect(norm(back.code)).toContain('CALL Outer()');
  });
});

describe('FUNCTION translation', () => {
  it('translates FUNCTION with RETURN to def -> return', () => {
    const result = translatePseudocodeToPython(`
FUNCTION Add(A : INTEGER, B : INTEGER) RETURNS INTEGER
    RETURN A + B
ENDFUNCTION

OUTPUT Add(2, 3)
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'def Add(A: int, B: int) -> int:\n    return A + B\n\nprint(Add(2, 3))\n',
    );
  });

  it('translates zero-parameter FUNCTION', () => {
    const result = translatePseudocodeToPython(`
FUNCTION Pi() RETURNS REAL
    RETURN 3.14
ENDFUNCTION
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('def Pi() -> float:');
    expect(norm(result.code)).toContain('return 3.14');
  });

  it('translates recursive FUNCTION', () => {
    const result = translatePseudocodeToPython(`
FUNCTION Factorial(N : INTEGER) RETURNS INTEGER
    IF N <= 1 THEN
        RETURN 1
    ELSE
        RETURN N * Factorial(N - 1)
    ENDIF
ENDFUNCTION
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('return N * Factorial(N - 1)');
  });

  it('translates nested function calls in expressions', () => {
    const result = translatePseudocodeToPython(`
FUNCTION Inc(X : INTEGER) RETURNS INTEGER
    RETURN X + 1
ENDFUNCTION
OUTPUT Inc(Inc(Inc(1)))
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('print(Inc(Inc(Inc(1))))');
  });

  it('translates function call as argument', () => {
    const result = translatePseudocodeToPython(`
FUNCTION Double(N : INTEGER) RETURNS INTEGER
    RETURN N * 2
ENDFUNCTION
FUNCTION Add(A : INTEGER, B : INTEGER) RETURNS INTEGER
    RETURN A + B
ENDFUNCTION
OUTPUT Add(Double(2), Double(3))
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('print(Add(Double(2), Double(3)))');
  });

  it('translates PROCEDURE calling FUNCTION via OUTPUT', () => {
    const result = translatePseudocodeToPython(`
FUNCTION Val() RETURNS INTEGER
    RETURN 7
ENDFUNCTION
PROCEDURE Show()
    OUTPUT Val()
ENDPROCEDURE
CALL Show()
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('def Val() -> int:');
    expect(norm(result.code)).toContain('print(Val())');
  });

  it('translates assignment from function call', () => {
    const result = translatePseudocodeToPython(`
FUNCTION Add(A : INTEGER, B : INTEGER) RETURNS INTEGER
    RETURN A + B
ENDFUNCTION
X ← Add(1, 2)
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('X = Add(1, 2)');
  });

  it('errors when FUNCTION has no RETURN', () => {
    const result = translatePseudocodeToPython(
      `
FUNCTION Bad() RETURNS INTEGER
    OUTPUT 1
ENDFUNCTION
`,
      { semanticCheck: true },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'C_FUNC_NO_RETURN')).toBe(
      true,
    );
  });

  it('warns on unreachable code after RETURN', () => {
    const result = translatePseudocodeToPython(
      `
FUNCTION Bad() RETURNS INTEGER
    RETURN 1
    OUTPUT 2
ENDFUNCTION
`,
      { semanticCheck: true },
    );
    expect(result.ok).toBe(true);
    expect(result.diagnostics.some((d) => d.code === 'C_UNREACHABLE')).toBe(
      true,
    );
  });

  it('rejects missing ENDFUNCTION', () => {
    const result = translatePseudocodeToPython(`
FUNCTION Bad() RETURNS INTEGER
    RETURN 1
`);
    expect(result.ok).toBe(false);
  });

  it('rejects missing RETURNS', () => {
    const result = translatePseudocodeToPython(`
FUNCTION Bad(A : INTEGER)
    RETURN A
ENDFUNCTION
`);
    expect(result.ok).toBe(false);
  });

  it('rejects duplicate FUNCTION parameters', () => {
    const result = translatePseudocodeToPython(
      `
FUNCTION Bad(A : INTEGER, A : INTEGER) RETURNS INTEGER
    RETURN A
ENDFUNCTION
`,
      { semanticCheck: true },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'C_DUP_PARAMETER')).toBe(
      true,
    );
  });
});

describe('FUNCTION reverse translation (Python → Cambridge)', () => {
  it('translates def -> return to FUNCTION RETURN', () => {
    const result = translatePythonToPseudocode(`
def Add(A: int, B: int) -> int:
    return A + B

print(Add(2, 3))
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'FUNCTION Add(A : INTEGER, B : INTEGER) RETURNS INTEGER\n    RETURN A + B\nENDFUNCTION\nOUTPUT Add(2, 3)\n',
    );
  });

  it('translates nested calls', () => {
    const result = translatePythonToPseudocode(`
def Inc(X: int) -> int:
    return X + 1

print(Inc(Inc(1)))
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('OUTPUT Inc(Inc(1))');
  });

  it('round-trips FUNCTION', () => {
    const source = `FUNCTION Add(A : INTEGER, B : INTEGER) RETURNS INTEGER\n    RETURN A + B\nENDFUNCTION\nOUTPUT Add(2, 3)\n`;
    const py = translatePseudocodeToPython(source);
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toBe(norm(source));
  });

  it('round-trips recursive FUNCTION', () => {
    const source = `FUNCTION Factorial(N : INTEGER) RETURNS INTEGER\n    IF N <= 1 THEN\n        RETURN 1\n    ELSE\n        RETURN N * Factorial(N - 1)\n    ENDIF\nENDFUNCTION\n`;
    const py = translatePseudocodeToPython(source);
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toBe(norm(source));
  });

  it('keeps bare def without -> as PROCEDURE', () => {
    const result = translatePythonToPseudocode(`
def Show():
    print(1)
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('PROCEDURE Show()');
    expect(norm(result.code)).not.toContain('FUNCTION');
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

describe('DECLARE and CONSTANT (V9)', () => {
  it('translates every scalar DECLARE type', () => {
    const result = translatePseudocodeToPython(`
DECLARE Count : INTEGER
DECLARE Name : STRING
DECLARE Finished : BOOLEAN
DECLARE Grade : CHAR
DECLARE Average : REAL
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'Count: int\nName: str\nFinished: bool\nGrade: str  # CHAR\nAverage: float\n',
    );
  });

  it('translates multi-name DECLARE', () => {
    const result = translatePseudocodeToPython(`DECLARE A, B : INTEGER\n`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('A: int\nB: int\n');
  });

  it('translates array DECLARE with bounds comment', () => {
    const result = translatePseudocodeToPython(
      `DECLARE Scores : ARRAY[1:10] OF INTEGER\n`,
    );
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('Scores: list[int]  # ARRAY[1:10]\n');
  });

  it('translates CONSTANT literals', () => {
    const result = translatePseudocodeToPython(`
CONSTANT PI = 3.14159
CONSTANT Greeting = "Hello"
CONSTANT Letter = 'A'
CONSTANT Flag = TRUE
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'PI = 3.14159  # CONSTANT\nGreeting = "Hello"  # CONSTANT\nLetter = \'A\'  # CONSTANT\nFlag = True  # CONSTANT\n',
    );
  });

  it('translates DECLARE/CONSTANT inside PROCEDURE and FUNCTION', () => {
    const result = translatePseudocodeToPython(`
PROCEDURE P()
    DECLARE X : INTEGER
    CONSTANT Max = 10
    X ← Max
    OUTPUT X
ENDPROCEDURE

FUNCTION F() RETURNS INTEGER
    DECLARE Y : INTEGER
    Y ← 1
    RETURN Y
ENDFUNCTION
`);
    expect(result.ok).toBe(true);
    expect(result.code).toContain('X: int');
    expect(result.code).toContain('Max = 10  # CONSTANT');
    expect(result.code).toContain('Y: int');
  });

  it('round-trips DECLARE and CONSTANT', () => {
    const src = `
DECLARE Count : INTEGER
DECLARE Grade : CHAR
DECLARE Scores : ARRAY[1:5] OF INTEGER
CONSTANT PI = 3.14
Count ← 1
`;
    const py = translatePseudocodeToPython(src);
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toContain('DECLARE Count : INTEGER');
    expect(norm(back.code)).toContain('DECLARE Grade : CHAR');
    expect(norm(back.code)).toContain('DECLARE Scores : ARRAY[1:5] OF INTEGER');
    expect(norm(back.code)).toContain('CONSTANT PI = 3.14');
  });

  it('diagnostics: duplicate DECLARE', () => {
    const result = translatePseudocodeToPython(
      `
DECLARE X : INTEGER
DECLARE X : REAL
`,
      { semanticCheck: true },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'C_DUP_VARIABLE')).toBe(true);
  });

  it('diagnostics: duplicate CONSTANT', () => {
    const result = translatePseudocodeToPython(
      `
CONSTANT A = 1
CONSTANT A = 2
`,
      { semanticCheck: true },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'C_DUP_CONSTANT')).toBe(true);
  });

  it('diagnostics: assign to CONSTANT', () => {
    const result = translatePseudocodeToPython(
      `
CONSTANT Max = 10
Max ← 11
`,
      { semanticCheck: true },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'C_ASSIGN_TO_CONSTANT')).toBe(
      true,
    );
    expect(result.code).not.toContain('Max = 11');
    expect(result.code).toContain('Max = 10  # CONSTANT');
  });

  it('diagnostics: INPUT to CONSTANT', () => {
    const result = translatePseudocodeToPython(
      `
CONSTANT Max = 10
INPUT Max
`,
      { semanticCheck: true },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'C_ASSIGN_TO_CONSTANT')).toBe(
      true,
    );
    expect(result.code).not.toContain('input()');
  });

  it('diagnostics: FOR cannot use CONSTANT as loop variable', () => {
    const result = translatePseudocodeToPython(
      `
CONSTANT I = 1
FOR I ← 1 TO 5
    OUTPUT I
NEXT I
`,
      { semanticCheck: true },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'C_ASSIGN_TO_CONSTANT')).toBe(
      true,
    );
    expect(result.code).not.toContain('for I in range');
  });

  it('diagnostics: REJECT Python keyword DECLARE/CONSTANT names', () => {
    const decl = translatePseudocodeToPython(`DECLARE class : INTEGER\n`, {
      semanticCheck: false,
    });
    expect(decl.ok).toBe(false);
    expect(decl.diagnostics.some((d) => d.code === 'T_DECL_PY_KEYWORD')).toBe(true);
    expect(decl.code).not.toContain('class:');

    const cons = translatePseudocodeToPython(`CONSTANT def = 1\n`, {
      semanticCheck: false,
    });
    expect(cons.ok).toBe(false);
    expect(cons.diagnostics.some((d) => d.code === 'T_DECL_PY_KEYWORD')).toBe(true);
    expect(cons.code).not.toContain('def =');
  });

  it('diagnostics: DECLARE then CONSTANT same name', () => {
    const result = translatePseudocodeToPython(
      `
DECLARE X : INTEGER
CONSTANT X = 1
`,
      { semanticCheck: true },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'C_DUP_CONSTANT')).toBe(true);
  });

  it('warns when DECLARE shadows translator builtins', () => {
    const result = translatePseudocodeToPython(`DECLARE print : INTEGER\n`, {
      semanticCheck: false,
    });
    expect(result.ok).toBe(true);
    expect(result.diagnostics.some((d) => d.code === 'T_DECL_SHADOWS_BUILTIN')).toBe(
      true,
    );
  });

  it('semantic check: undeclared identifier fails translate ok', () => {
    const result = translatePseudocodeToPython(`OUTPUT X\n`, {
      semanticCheck: true,
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'C_UNDECL_IDENT')).toBe(true);
    expect(result.code).toContain('print(X)');
  });

  it('canonicalizes identifier casing for Python (Cambridge case-insensitive)', () => {
    const result = translatePseudocodeToPython(
      `
DECLARE Count : INTEGER
count ← 1
OUTPUT COUNT
`,
      { semanticCheck: true },
    );
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe('Count: int\nCount = 1\nprint(Count)\n');
  });

  it('allows shadowing CONSTANT in nested PROCEDURE scope', () => {
    const result = translatePseudocodeToPython(`
CONSTANT Max = 1
PROCEDURE P()
    DECLARE Max : INTEGER
    Max ← 2
ENDPROCEDURE
`);
    expect(result.ok).toBe(true);
  });

  it('reverse: annotation-only declare', () => {
    const result = translatePythonToPseudocode(`Count: int\nName: str\n`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'DECLARE Count : INTEGER\nDECLARE Name : STRING\n',
    );
  });

  it('reverse: case-insensitive CONSTANT/CHAR tags', () => {
    const result = translatePythonToPseudocode(
      `PI = 3.14  # constant\nGrade: str  # char\n`,
    );
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('CONSTANT PI = 3.14');
    expect(norm(result.code)).toContain('DECLARE Grade : CHAR');
  });

  it('round-trips ARRAY bounds with identifier upper', () => {
    const py = translatePseudocodeToPython(
      `DECLARE N : INTEGER\nDECLARE Scores : ARRAY[1:N] OF INTEGER\n`,
    );
    expect(py.ok).toBe(true);
    expect(py.code).toContain('# ARRAY[1:N]');
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toContain('DECLARE Scores : ARRAY[1:N] OF INTEGER');
  });
});

describe('source size limits', () => {
  it('rejects oversized Cambridge source with T_SOURCE_TOO_LARGE', () => {
    const source = 'X ← 1\n'.repeat(100);
    const result = translatePseudocodeToPython(source, { maxSourceChars: 10 });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('');
    expect(result.diagnostics.some((d) => d.code === 'T_SOURCE_TOO_LARGE')).toBe(
      true,
    );
  });

  it('rejects oversized Python source with T_SOURCE_TOO_LARGE', () => {
    const source = 'x = 1\n'.repeat(100);
    const result = translatePythonToPseudocode(source, { maxSourceChars: 10 });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'T_SOURCE_TOO_LARGE')).toBe(
      true,
    );
  });

  it('caps maxSourceChars at the absolute ceiling', () => {
    const source = 'X ← 1\n';
    const result = translatePseudocodeToPython(source, {
      maxSourceChars: ABSOLUTE_MAX_SOURCE_CHARS + 1_000_000,
    });
    expect(result.ok).toBe(true);
  });
});

describe('builtins and & translation', () => {
  it('translates string builtins and & to Python', () => {
    const result = translatePseudocodeToPython(
      `
DECLARE Name : STRING
OUTPUT LENGTH(Name)
OUTPUT LEFT(Name, 3)
OUTPUT RIGHT(Name, 2)
OUTPUT MID(Name, 2, 3)
OUTPUT LCASE(Name)
OUTPUT UCASE(Name)
OUTPUT Name & "!"
`,
      { semanticCheck: true },
    );
    expect(result.ok).toBe(true);
    const code = result.code;
    expect(code).toContain('len(Name)');
    expect(code).toContain('Name[:3]');
    expect(code).toContain('Name[-2:]');
    expect(code).toContain('Name[(2) - 1 : (2) - 1 + (3)]');
    expect(code).toContain('Name.lower()');
    expect(code).toContain('Name.upper()');
    expect(code).toContain('Name + "!"');
    expect(code).not.toContain('&');
  });

  it('parenthesizes RIGHT and RAND count expressions (precedence)', () => {
    const result = translatePseudocodeToPython(
      `
DECLARE S : STRING
DECLARE N : INTEGER
OUTPUT RIGHT(S, N + 1)
OUTPUT RAND(N + 1)
`,
      { semanticCheck: true },
    );
    expect(result.ok).toBe(true);
    // Must NOT emit S[-N + 1:] or random.random() * N + 1
    expect(result.code).toContain('S[-(N + 1):]');
    expect(result.code).not.toMatch(/S\[-N \+ 1:\]/);
    expect(result.code).toContain('random.random() * (N + 1)');
    expect(result.code).not.toMatch(/random\.random\(\) \* N \+ 1/);
  });

  it('translates INT and RAND', () => {
    const result = translatePseudocodeToPython(
      `
OUTPUT INT(4.8)
OUTPUT RAND(10)
`,
      { semanticCheck: true },
    );
    expect(result.ok).toBe(true);
    expect(result.code).toContain('import random');
    expect(result.code).toContain('int(4.8)');
    expect(result.code).toContain('random.random() * 10');
  });

  it('round-trips builtins via Python', () => {
    const py = translatePseudocodeToPython(
      `
DECLARE S : STRING
OUTPUT LENGTH(S)
OUTPUT LEFT(S, 1)
OUTPUT RIGHT(S, 1)
OUTPUT MID(S, 2, 3)
OUTPUT LCASE(S)
OUTPUT S & "x"
`,
      { semanticCheck: true },
    );
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(back.code).toContain('LENGTH(S)');
    expect(back.code).toContain('LEFT(S, 1)');
    expect(back.code).toContain('RIGHT(S, 1)');
    expect(back.code).toContain('MID(S, 2, 3)');
    expect(back.code).toContain('LCASE(S)');
    expect(back.code).toContain('&');
  });

  it('does not treat LENGTH as stringy for reverse + → &', () => {
    const back = translatePythonToPseudocode('print(len(S) + 1)');
    expect(back.ok).toBe(true);
    expect(back.code).toContain('LENGTH(S) + 1');
    expect(back.code).not.toContain('&');
  });
});
