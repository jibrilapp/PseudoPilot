import { describe, expect, it } from 'vitest';
import {
  translatePseudocodeToPython,
  translatePythonToPseudocode,
} from './index.js';

function norm(s: string): string {
  return s.replace(/\r\n/g, '\n');
}

describe('identifier sanitization (Cambridge → Python)', () => {
  it('sanitizes DECLARE list / print / str / int (valid Cambridge ids)', () => {
    // Note: Cambridge keywords (class, input, …) cannot appear as identifiers
    // in Cambridge source; those are covered via reverse / sanitizer unit tests.
    const result = translatePseudocodeToPython(
      `
DECLARE list : INTEGER
DECLARE print : STRING
DECLARE str : STRING
DECLARE int : INTEGER
list ← 1
print ← "hi"
str ← "s"
int ← 3
OUTPUT list, print, str, int
`,
      { semanticCheck: false },
    );
    expect(result.ok).toBe(true);
    expect(result.code).toContain('list_: int');
    expect(result.code).toContain('print_: str');
    expect(result.code).toContain('str_: str');
    expect(result.code).toContain('int_: int');
    expect(result.code).toContain('list_ = 1');
    expect(result.code).toContain('print_ = "hi"');
    expect(result.code).toContain('str_ = "s"');
    expect(result.code).toContain('int_ = 3');
    expect(result.code).toContain('print(list_, print_, str_, int_)');
  });

  it('leaves non-colliding names unchanged', () => {
    const result = translatePseudocodeToPython(
      `DECLARE Count : INTEGER\nDECLARE Total : INTEGER\nCount ← 1\nOUTPUT Count, Total\n`,
      { semanticCheck: false },
    );
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toBe(
      'Count: int\nTotal: int\nCount = 1\nprint(Count, Total)\n',
    );
  });

  it('sanitizes TYPE named list and field references', () => {
    const result = translatePseudocodeToPython(
      `
TYPE list
    DECLARE Value : INTEGER
ENDTYPE
DECLARE Item : list
Item.Value ← 1
`,
      { semanticCheck: false },
    );
    expect(result.ok).toBe(true);
    expect(result.code).toContain('class list_:');
    expect(result.code).toContain('Item: list_ = list_()');
    expect(result.code).toContain('Item.Value = 1');
  });

  it('sanitizes FUNCTION print', () => {
    const result = translatePseudocodeToPython(
      `
FUNCTION print(X : INTEGER) RETURNS INTEGER
    RETURN X
ENDFUNCTION
OUTPUT print(1)
`,
      { semanticCheck: false },
    );
    expect(result.ok).toBe(true);
    expect(result.code).toContain('def print_(X: int) -> int:');
    expect(result.code).toContain('print(print_(1))');
  });

  it('sanitizes PROCEDURE named lambda (Python keyword, valid Cambridge id)', () => {
    const result = translatePseudocodeToPython(
      `
PROCEDURE lambda(Msg : STRING)
    OUTPUT Msg
ENDPROCEDURE
CALL lambda("hi")
`,
      { semanticCheck: false },
    );
    expect(result.ok).toBe(true);
    expect(result.code).toContain('def lambda_(Msg: str):');
    expect(result.code).toContain('lambda_("hi")');
  });

  it('sanitizes nested scopes and shadowing consistently', () => {
    const result = translatePseudocodeToPython(
      `
DECLARE list : INTEGER
PROCEDURE P()
    DECLARE list : INTEGER
    list ← 2
    OUTPUT list
ENDPROCEDURE
list ← 1
CALL P()
`,
      { semanticCheck: false },
    );
    expect(result.ok).toBe(true);
    expect(result.code).toContain('list_: int');
    expect(result.code).toMatch(/def P\(\):\n    list_: int/);
    expect(result.code).toContain('list_ = 2');
    expect(result.code).toContain('print(list_)');
    expect(result.code).toContain('list_ = 1');
  });

  it('sanitizes FOR loop variables that collide', () => {
    const result = translatePseudocodeToPython(
      `
FOR list ← 1 TO 3
    OUTPUT list
NEXT list
`,
      { semanticCheck: false },
    );
    expect(result.ok).toBe(true);
    expect(result.code).toContain('for list_ in range(1, 3 + 1):');
    expect(result.code).toContain('print(list_)');
  });

  it('sanitizes CONSTANT and parameter names', () => {
    const result = translatePseudocodeToPython(
      `
CONSTANT max = 10
PROCEDURE P(str : STRING)
    OUTPUT str, max
ENDPROCEDURE
`,
      { semanticCheck: false },
    );
    expect(result.ok).toBe(true);
    expect(result.code).toContain('max_ = 10  # CONSTANT');
    expect(result.code).toContain('def P(str_: str):');
    expect(result.code).toContain('print(str_, max_)');
  });
});

describe('identifier sanitization reverse (Python → Cambridge)', () => {
  it('recovers sanitized DECLARE names including Cambridge keywords', () => {
    // class / input are Cambridge keywords — only reachable via reverse from
    // PseudoPilot-emitted Python (class_ / input_).
    const result = translatePythonToPseudocode(`
list_: int
class_: int
print_: str
input_: str
list_ = 1
print(list_, class_, print_, input_)
`);
    expect(result.ok).toBe(true);
    expect(norm(result.code)).toContain('DECLARE list : INTEGER');
    expect(norm(result.code)).toContain('DECLARE class : INTEGER');
    expect(norm(result.code)).toContain('DECLARE print : STRING');
    expect(norm(result.code)).toContain('DECLARE input : STRING');
    expect(norm(result.code)).toContain('list ← 1');
    expect(norm(result.code)).toContain('OUTPUT list, class, print, input');
  });

  it('round-trips reserved identifiers that are valid Cambridge ids', () => {
    const src = `
DECLARE list : INTEGER
DECLARE print : STRING
list ← 1
print ← "x"
OUTPUT list, print
`;
    const py = translatePseudocodeToPython(src, { semanticCheck: false });
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toContain('DECLARE list : INTEGER');
    expect(norm(back.code)).toContain('DECLARE print : STRING');
    expect(norm(back.code)).toContain('list ← 1');
    expect(norm(back.code)).toContain('print ← "x"');
    expect(norm(back.code)).toContain('OUTPUT list, print');
  });

  it('round-trips TYPE list', () => {
    const src = `
TYPE list
    DECLARE Value : INTEGER
ENDTYPE
`;
    const py = translatePseudocodeToPython(src, { semanticCheck: false });
    expect(py.ok).toBe(true);
    expect(py.code).toContain('class list_:');
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toContain('TYPE list');
  });

  it('recovers CLASS class and PROCEDURE input from sanitized Python', () => {
    const cls = translatePythonToPseudocode(`
class class_:
    def __init__(self) -> None:
        pass
`);
    expect(cls.ok).toBe(true);
    expect(norm(cls.code)).toContain('CLASS class');

    const proc = translatePythonToPseudocode(`
def input_(Msg: str):
    print(Msg)

input_("hi")
`);
    expect(proc.ok).toBe(true);
    expect(norm(proc.code)).toContain('PROCEDURE input(Msg : STRING)');
    expect(norm(proc.code)).toContain('CALL input("hi")');
  });

  it('round-trips FUNCTION print', () => {
    const src = `
FUNCTION print(X : INTEGER) RETURNS INTEGER
    RETURN X
ENDFUNCTION
OUTPUT print(1)
`;
    const py = translatePseudocodeToPython(src, { semanticCheck: false });
    expect(py.ok).toBe(true);
    const back = translatePythonToPseudocode(py.code);
    expect(back.ok).toBe(true);
    expect(norm(back.code)).toContain(
      'FUNCTION print(X : INTEGER) RETURNS INTEGER',
    );
    expect(norm(back.code)).toContain('OUTPUT print(1)');
  });
});
