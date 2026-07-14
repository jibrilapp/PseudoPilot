import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import type {
  CallExpression,
  FunctionDeclaration,
  ProcedureDeclaration,
  Program,
  Statement,
} from '../ast/nodes.js';

/**
 * Adversarial edge cases for PROCEDURE / FUNCTION milestone.
 * Goal: break parameters, DECLARE locals, CALL / CallExpression, RETURN, recursion.
 */

function parseOk(source: string): Program {
  const result = parse(source);
  expect(result.ok, JSON.stringify(result.diagnostics, null, 2)).toBe(true);
  return result.ast;
}

function routine(body: Statement[], name: string): Statement {
  const found = body.find(
    (s) =>
      (s.kind === 'ProcedureDeclaration' || s.kind === 'FunctionDeclaration') &&
      s.name.name === name,
  );
  expect(found, `missing routine ${name}`).toBeTruthy();
  return found!;
}

describe('edge cases — PROCEDURE / FUNCTION', () => {
  it('1. procedure with zero params, no parentheses', () => {
    const proc = routine(
      parseOk(`
PROCEDURE Hi
    OUTPUT "hi"
ENDPROCEDURE
`).body,
      'Hi',
    ) as ProcedureDeclaration;
    expect(proc.parameters).toEqual([]);
  });

  it('2. procedure with empty () parameter list', () => {
    const proc = routine(
      parseOk(`
PROCEDURE Hi()
    OUTPUT "hi"
ENDPROCEDURE
`).body,
      'Hi',
    ) as ProcedureDeclaration;
    expect(proc.parameters).toEqual([]);
  });

  it('3. many typed parameters (5)', () => {
    const proc = routine(
      parseOk(`
PROCEDURE Pack(A : INTEGER, B : REAL, C : STRING, D : BOOLEAN, E : CHAR)
    OUTPUT A, B, C, D, E
ENDPROCEDURE
`).body,
      'Pack',
    ) as ProcedureDeclaration;
    expect(proc.parameters.map((p) => p.typeName.name)).toEqual([
      'INTEGER',
      'REAL',
      'STRING',
      'BOOLEAN',
      'CHAR',
    ]);
  });

  it('4. multiple DECLARE locals including multi-name', () => {
    const proc = routine(
      parseOk(`
PROCEDURE Work(N : INTEGER)
    DECLARE I, J : INTEGER
    DECLARE Name : STRING
    I ← 0
    J ← N
    Name ← "x"
ENDPROCEDURE
`).body,
      'Work',
    ) as ProcedureDeclaration;
    expect(proc.body.filter((s) => s.kind === 'DeclareStatement')).toHaveLength(2);
  });

  it('5. CALL with and without parentheses, with args', () => {
    const ast = parseOk(`
PROCEDURE P(A : INTEGER)
    OUTPUT A
ENDPROCEDURE
PROCEDURE Q()
    OUTPUT "q"
ENDPROCEDURE
CALL P(1)
CALL Q()
CALL Q
`);
    expect(ast.body.filter((s) => s.kind === 'CallStatement')).toHaveLength(3);
  });

  it('6. function call as expression in OUTPUT and assignment', () => {
    const ast = parseOk(`
FUNCTION Dbl(X : INTEGER) RETURNS INTEGER
    RETURN X * 2
ENDFUNCTION
Result ← Dbl(21)
OUTPUT Dbl(Result)
`);
    expect(ast.body[1]).toMatchObject({
      kind: 'AssignmentStatement',
      value: { kind: 'CallExpression', callee: { name: 'Dbl' } },
    });
    expect(ast.body[2]).toMatchObject({
      kind: 'OutputStatement',
    });
  });

  it('7. nested CallExpression arguments', () => {
    const ast = parseOk(`
FUNCTION Inc(X : INTEGER) RETURNS INTEGER
    RETURN X + 1
ENDFUNCTION
OUTPUT Inc(Inc(Inc(0)))
`);
    let expr = (ast.body[1] as { expressions: CallExpression[] }).expressions[0];
    expect(expr?.kind).toBe('CallExpression');
    for (let i = 0; i < 2; i++) {
      expect(expr?.kind).toBe('CallExpression');
      expr = (expr as CallExpression).args[0] as CallExpression;
    }
  });

  it('8. recursive function (self CallExpression)', () => {
    const fn = routine(
      parseOk(`
FUNCTION Fib(N : INTEGER) RETURNS INTEGER
    IF N <= 1 THEN
        RETURN N
    ELSE
        RETURN Fib(N - 1) + Fib(N - 2)
    ENDIF
ENDFUNCTION
`).body,
      'Fib',
    ) as FunctionDeclaration;
    expect(JSON.stringify(fn)).toContain('"name":"Fib"');
    expect(JSON.stringify(fn)).toContain('"kind":"CallExpression"');
  });

  it('9. mutual recursion between three functions', () => {
    parseOk(`
FUNCTION A(N : INTEGER) RETURNS INTEGER
    IF N = 0 THEN
        RETURN 0
    ELSE
        RETURN B(N - 1)
    ENDIF
ENDFUNCTION
FUNCTION B(N : INTEGER) RETURNS INTEGER
    IF N = 0 THEN
        RETURN 1
    ELSE
        RETURN C(N - 1)
    ENDIF
ENDFUNCTION
FUNCTION C(N : INTEGER) RETURNS INTEGER
    IF N = 0 THEN
        RETURN 2
    ELSE
        RETURN A(N - 1)
    ENDIF
ENDFUNCTION
`);
  });

  it('10. IF / ELSE IF / CALL inside procedure', () => {
    parseOk(`
PROCEDURE Router(X : INTEGER)
    IF X = 1 THEN
        CALL One()
    ELSE IF X = 2 THEN
        CALL Two()
    ELSE
        CALL Other()
    ENDIF
ENDPROCEDURE
PROCEDURE One()
    OUTPUT 1
ENDPROCEDURE
PROCEDURE Two()
    OUTPUT 2
ENDPROCEDURE
PROCEDURE Other()
    OUTPUT 0
ENDPROCEDURE
`);
  });

  it('11. lowercase procedure/function/call/return keywords', () => {
    parseOk(`
procedure greeter(name : string)
    output name
endprocedure

function id(x : integer) returns integer
    return x
endfunction

call greeter("Ada")
output id(7)
`);
  });

  it('12. comments around routine headers and ends', () => {
    parseOk(`
// header
PROCEDURE P(A : INTEGER) // params
    // body
    OUTPUT A // out
ENDPROCEDURE // end

FUNCTION F() RETURNS BOOLEAN // ret
    RETURN TRUE // value
ENDFUNCTION
`);
  });

  it('13. blank lines inside routine bodies', () => {
    parseOk(`
FUNCTION Gap() RETURNS INTEGER

    DECLARE X : INTEGER

    X ← 1

    RETURN X

ENDFUNCTION
`);
  });

  it('14. global DECLARE mixed with routines and calls', () => {
    const ast = parseOk(`
DECLARE G : INTEGER
PROCEDURE SetG(V : INTEGER)
    G ← V
ENDPROCEDURE
FUNCTION GetG() RETURNS INTEGER
    RETURN G
ENDFUNCTION
CALL SetG(9)
OUTPUT GetG()
`);
    expect(ast.body[0]?.kind).toBe('DeclareStatement');
    expect(ast.body.filter((s) => s.kind === 'CallStatement')).toHaveLength(1);
  });

  it('15. RETURN expression with nested calls and arithmetic', () => {
    parseOk(`
FUNCTION Mix(A : INTEGER, B : INTEGER) RETURNS INTEGER
    RETURN (A + B) * Mix(A - 1, B) DIV 2
ENDFUNCTION
`);
  });

  it('16. rejects trailing comma in parameter list', () => {
    const result = parse(`
PROCEDURE Bad(A : INTEGER,)
    OUTPUT A
ENDPROCEDURE
`);
    expect(result.ok).toBe(false);
  });

  it('17. rejects missing type after parameter colon', () => {
    const result = parse(`
PROCEDURE Bad(A :)
    OUTPUT A
ENDPROCEDURE
`);
    expect(result.ok).toBe(false);
  });

  it('18. rejects missing RETURNS on FUNCTION', () => {
    const result = parse(`
FUNCTION Bad(A : INTEGER)
    RETURN A
ENDFUNCTION
`);
    expect(result.ok).toBe(false);
  });

  it('19. rejects missing ENDPROCEDURE', () => {
    const result = parse(`
PROCEDURE Bad()
    OUTPUT 1
`);
    expect(result.ok).toBe(false);
  });

  it('20. rejects missing ENDFUNCTION', () => {
    const result = parse(`
FUNCTION Bad() RETURNS INTEGER
    RETURN 1
`);
    expect(result.ok).toBe(false);
  });

  it('21. rejects RETURN inside PROCEDURE', () => {
    const result = parse(`
PROCEDURE Bad()
    RETURN 1
ENDPROCEDURE
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_RETURN_IN_PROCEDURE')).toBe(true);
  });

  it('22. rejects RETURN at program top level', () => {
    const result = parse(`RETURN 1`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_RETURN_OUTSIDE')).toBe(true);
  });

  it('23. rejects nested PROCEDURE', () => {
    const result = parse(`
PROCEDURE Outer()
    PROCEDURE Inner()
        OUTPUT 1
    ENDPROCEDURE
ENDPROCEDURE
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_NESTED_ROUTINE')).toBe(true);
  });

  it('24. rejects nested FUNCTION', () => {
    const result = parse(`
FUNCTION Outer() RETURNS INTEGER
    FUNCTION Inner() RETURNS INTEGER
        RETURN 1
    ENDFUNCTION
    RETURN 2
ENDFUNCTION
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_NESTED_ROUTINE')).toBe(true);
  });

  it('25. rejects trailing comma in CALL args', () => {
    const result = parse(`
PROCEDURE P(A : INTEGER)
    OUTPUT A
ENDPROCEDURE
CALL P(1,)
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_TRAILING_COMMA')).toBe(true);
  });

  it('26. rejects CALL without callee name', () => {
    const result = parse(`CALL`);
    expect(result.ok).toBe(false);
  });

  it('27. rejects parameter without colon', () => {
    const result = parse(`
PROCEDURE Bad(A INTEGER)
    OUTPUT A
ENDPROCEDURE
`);
    expect(result.ok).toBe(false);
  });

  it('28. rejects unknown type name', () => {
    const result = parse(`
PROCEDURE Bad(A : NUMBER)
    OUTPUT A
ENDPROCEDURE
`);
    expect(result.ok).toBe(false);
  });

  it('29. rejects ENDPROCEDURE at top level', () => {
    const result = parse(`ENDPROCEDURE`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_UNEXPECTED_KW')).toBe(true);
  });

  it('30. rejects assigning to a call expression target', () => {
    const result = parse(`
FUNCTION F() RETURNS INTEGER
    RETURN 1
ENDFUNCTION
F() ← 2
`);
    expect(result.ok).toBe(false);
  });
});
