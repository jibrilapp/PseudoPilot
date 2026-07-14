import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import type {
  AssignmentStatement,
  CallExpression,
  CallStatement,
  FunctionDeclaration,
  ProcedureDeclaration,
  Program,
  ReturnStatement,
  Statement,
} from '../ast/nodes.js';

function parseOk(source: string): Program {
  const result = parse(source);
  expect(result.ok, JSON.stringify(result.diagnostics, null, 2)).toBe(true);
  return result.ast;
}

function findRoutine(body: Statement[], name: string): Statement | undefined {
  return body.find(
    (s) =>
      (s.kind === 'ProcedureDeclaration' || s.kind === 'FunctionDeclaration') &&
      s.name.name === name,
  );
}

describe('PROCEDURE', () => {
  it('parses a procedure with parameters and locals', () => {
    const ast = parseOk(`
PROCEDURE DisplaySum(A : INTEGER, B : INTEGER)
    DECLARE Total : INTEGER
    Total ← A + B
    OUTPUT Total
ENDPROCEDURE

CALL DisplaySum(3, 4)
`);
    const proc = findRoutine(ast.body, 'DisplaySum') as ProcedureDeclaration;
    expect(proc.kind).toBe('ProcedureDeclaration');
    expect(proc.parameters).toHaveLength(2);
    expect(proc.parameters[0]).toMatchObject({
      kind: 'Parameter',
      name: { name: 'A' },
      typeName: { name: 'INTEGER' },
    });
    expect(proc.body.map((s) => s.kind)).toEqual([
      'DeclareStatement',
      'AssignmentStatement',
      'OutputStatement',
    ]);
    expect(ast.body[1]).toMatchObject({
      kind: 'CallStatement',
      callee: { name: 'DisplaySum' },
    });
    expect((ast.body[1] as CallStatement).args).toHaveLength(2);
  });

  it('parses procedures with empty parameter lists', () => {
    const ast = parseOk(`
PROCEDURE Hello()
    OUTPUT "hi"
ENDPROCEDURE

PROCEDURE Greet
    OUTPUT "hey"
ENDPROCEDURE

CALL Hello()
CALL Greet
`);
    expect(findRoutine(ast.body, 'Hello')).toMatchObject({
      kind: 'ProcedureDeclaration',
      parameters: [],
    });
    expect(findRoutine(ast.body, 'Greet')).toMatchObject({
      kind: 'ProcedureDeclaration',
      parameters: [],
    });
  });

  it('rejects RETURN inside a procedure', () => {
    const result = parse(`
PROCEDURE Bad()
    RETURN 1
ENDPROCEDURE
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_RETURN_IN_PROCEDURE')).toBe(true);
  });

  it('rejects nested PROCEDURE', () => {
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
});

describe('FUNCTION', () => {
  it('parses a function with RETURNS type and RETURN value', () => {
    const ast = parseOk(`
FUNCTION Add(A : INTEGER, B : INTEGER) RETURNS INTEGER
    DECLARE Sum : INTEGER
    Sum ← A + B
    RETURN Sum
ENDFUNCTION

Result ← Add(2, 3)
`);
    const fn = findRoutine(ast.body, 'Add') as FunctionDeclaration;
    expect(fn.returnType.name).toBe('INTEGER');
    expect(fn.body[fn.body.length - 1]?.kind).toBe('ReturnStatement');
    const assign = ast.body[1] as AssignmentStatement;
    expect(assign.value.kind).toBe('CallExpression');
    expect(assign.value).toMatchObject({
      kind: 'CallExpression',
      callee: { name: 'Add' },
    });
  });

  it('parses recursive function calls in the AST', () => {
    const ast = parseOk(`
FUNCTION Factorial(N : INTEGER) RETURNS INTEGER
    IF N <= 1 THEN
        RETURN 1
    ELSE
        RETURN N * Factorial(N - 1)
    ENDIF
ENDFUNCTION

OUTPUT Factorial(5)
`);
    const fn = findRoutine(ast.body, 'Factorial') as FunctionDeclaration;
    const iff = fn.body[0];
    expect(iff?.kind).toBe('IfStatement');
    if (iff?.kind !== 'IfStatement') return;

    const elseReturn = iff.alternate?.[0] as ReturnStatement;
    expect(elseReturn.kind).toBe('ReturnStatement');
    expect(elseReturn.value.kind).toBe('BinaryExpression');
    if (elseReturn.value.kind !== 'BinaryExpression') return;
    expect(elseReturn.value.right.kind).toBe('CallExpression');
    const recursive = elseReturn.value.right as CallExpression;
    expect(recursive.callee.name).toBe('Factorial');
  });

  it('parses mutual recursion between two functions', () => {
    const ast = parseOk(`
FUNCTION IsEven(N : INTEGER) RETURNS BOOLEAN
    IF N = 0 THEN
        RETURN TRUE
    ELSE
        RETURN IsOdd(N - 1)
    ENDIF
ENDFUNCTION

FUNCTION IsOdd(N : INTEGER) RETURNS BOOLEAN
    IF N = 0 THEN
        RETURN FALSE
    ELSE
        RETURN IsEven(N - 1)
    ENDIF
ENDFUNCTION
`);
    expect(findRoutine(ast.body, 'IsEven')?.kind).toBe('FunctionDeclaration');
    expect(findRoutine(ast.body, 'IsOdd')?.kind).toBe('FunctionDeclaration');
    const even = findRoutine(ast.body, 'IsEven') as FunctionDeclaration;
    const iff = even.body[0];
    expect(iff?.kind).toBe('IfStatement');
    if (iff?.kind !== 'IfStatement') return;
    const ret = iff.alternate?.[0] as ReturnStatement;
    expect(ret.value).toMatchObject({
      kind: 'CallExpression',
      callee: { name: 'IsOdd' },
    });
  });

  it('requires RETURNS on functions', () => {
    const result = parse(`
FUNCTION Bad(A : INTEGER)
    RETURN A
ENDFUNCTION
`);
    expect(result.ok).toBe(false);
  });

  it('rejects RETURN at program top level', () => {
    const result = parse('RETURN 1');
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_RETURN_OUTSIDE')).toBe(true);
  });
});

describe('DECLARE (locals / globals)', () => {
  it('parses multi-name DECLARE', () => {
    const ast = parseOk('DECLARE A, B, C : REAL');
    expect(ast.body[0]).toMatchObject({
      kind: 'DeclareStatement',
      names: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
      typeRef: { kind: 'TypeName', name: 'REAL' },
    });
  });

  it('supports CHAR, STRING, BOOLEAN types', () => {
    const ast = parseOk(`
DECLARE Letter : CHAR
DECLARE Name : STRING
DECLARE Ok : BOOLEAN
`);
    expect(
      ast.body.map((s) => {
        expect(s.kind).toBe('DeclareStatement');
        return (s as { typeRef: { name: string } }).typeRef.name;
      }),
    ).toEqual(['CHAR', 'STRING', 'BOOLEAN']);
  });
});

describe('CALL edges', () => {
  it('parses CALL with and without parentheses', () => {
    const ast = parseOk(`
PROCEDURE Ping()
    OUTPUT "pong"
ENDPROCEDURE

CALL Ping
CALL Ping()
`);
    expect((ast.body[1] as CallStatement).args).toEqual([]);
    expect((ast.body[2] as CallStatement).args).toEqual([]);
  });

  it('rejects trailing comma in call arguments', () => {
    const result = parse(`
PROCEDURE P(A : INTEGER)
    OUTPUT A
ENDPROCEDURE
CALL P(1,)
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'E_TRAILING_COMMA')).toBe(true);
  });
});
