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

  it('rejects IF statements', () => {
    const result = translatePseudocodeToPython(`
IF X = 1 THEN
    OUTPUT X
ENDIF
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'T_UNSUPPORTED_IF')).toBe(
      true,
    );
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

  it('rejects indented blocks', () => {
    const result = translatePythonToPseudocode(`
if True:
    print(1)
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'T_PY_INDENT')).toBe(true);
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
