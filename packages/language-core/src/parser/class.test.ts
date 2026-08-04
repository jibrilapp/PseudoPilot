import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import type {
  ClassDeclaration,
  ClassFunctionDeclaration,
  ClassProcedureDeclaration,
  ExpressionStatement,
  MethodCallExpression,
  NewExpression,
  Program,
} from '../ast/nodes.js';

/**
 * Cambridge 9618 OOP parsing foundation: CLASS / ENDCLASS, PUBLIC / PRIVATE
 * members, constructors (PROCEDURE NEW), INHERITS + SUPER.NEW, instantiation
 * with NEW, and method calls without the CALL keyword.
 */

function parseOk(source: string): Program {
  const result = parse(source);
  expect(result.diagnostics.filter((d) => d.severity === 'error'), JSON.stringify(result.diagnostics, null, 2)).toEqual([]);
  return result.ast;
}

function findClass(body: Program['body'], name: string): ClassDeclaration {
  const found = body.find((s) => s.kind === 'ClassDeclaration' && s.name.name === name);
  expect(found, `missing class ${name}`).toBeTruthy();
  return found as ClassDeclaration;
}

describe('CLASS / ENDCLASS — Cambridge 9618 OOP foundation', () => {
  it('parses a simple class with a PRIVATE property and a NEW constructor', () => {
    const ast = parseOk(`
CLASS Pet
PRIVATE Name : STRING
PUBLIC PROCEDURE NEW(GivenName : STRING)
  Name ← GivenName
ENDPROCEDURE
ENDCLASS
`);
    const cls = findClass(ast.body, 'Pet');
    expect(cls.inherits).toBeNull();
    expect(cls.members).toHaveLength(2);

    const property = cls.members[0];
    expect(property?.kind).toBe('ClassPropertyDeclaration');
    if (property?.kind === 'ClassPropertyDeclaration') {
      expect(property.visibility).toBe('PRIVATE');
      expect(property.names.map((n) => n.name)).toEqual(['Name']);
      expect(property.typeRef).toMatchObject({ kind: 'TypeName', name: 'STRING' });
    }

    const ctor = cls.members[1];
    expect(ctor?.kind).toBe('ClassProcedureDeclaration');
    if (ctor?.kind === 'ClassProcedureDeclaration') {
      expect(ctor.visibility).toBe('PUBLIC');
      expect(ctor.name.name).toBe('NEW');
      expect(ctor.parameters).toHaveLength(1);
      expect(ctor.body).toHaveLength(1);
      expect(ctor.body[0]).toMatchObject({
        kind: 'AssignmentStatement',
        target: { kind: 'Identifier', name: 'Name' },
        value: { kind: 'Identifier', name: 'GivenName' },
      });
    }
  });

  it('parses INHERITS with SUPER.NEW(...) in the subclass constructor', () => {
    const ast = parseOk(`
CLASS Pet
PRIVATE Name : STRING
PUBLIC PROCEDURE NEW(GivenName : STRING)
  Name ← GivenName
ENDPROCEDURE
ENDCLASS

CLASS Cat INHERITS Pet
PRIVATE Breed : STRING
PUBLIC PROCEDURE NEW(GivenName : STRING, GivenBreed : STRING)
  SUPER.NEW(GivenName)
  Breed ← GivenBreed
ENDPROCEDURE
ENDCLASS
`);
    const cat = findClass(ast.body, 'Cat');
    expect(cat.inherits?.name).toBe('Pet');

    const ctor = cat.members.find(
      (m) => m.kind === 'ClassProcedureDeclaration',
    ) as ClassProcedureDeclaration;
    expect(ctor.parameters).toHaveLength(2);
    expect(ctor.body).toHaveLength(2);

    const superCall = ctor.body[0] as ExpressionStatement;
    expect(superCall.kind).toBe('ExpressionStatement');
    expect(superCall.expression.kind).toBe('MethodCallExpression');
    const call = superCall.expression as MethodCallExpression;
    expect(call.object).toMatchObject({ kind: 'SuperExpression' });
    expect(call.method.name).toBe('NEW');
    expect(call.args).toHaveLength(1);
    expect(call.args[0]).toMatchObject({ kind: 'Identifier', name: 'GivenName' });
  });

  it('parses NEW Cat(...) instantiation in an assignment', () => {
    const ast = parseOk(`
CLASS Cat
PUBLIC PROCEDURE NEW(GivenName : STRING, GivenBreed : STRING)
ENDPROCEDURE
ENDCLASS

MyCat \u2190 NEW Cat("Kitty", "Shorthaired")
`);
    const assign = ast.body.find((s) => s.kind === 'AssignmentStatement');
    expect(assign).toBeDefined();
    if (assign?.kind === 'AssignmentStatement') {
      expect(assign.target).toMatchObject({ kind: 'Identifier', name: 'MyCat' });
      expect(assign.value.kind).toBe('NewExpression');
      const newExpr = assign.value as NewExpression;
      expect(newExpr.className.name).toBe('Cat');
      expect(newExpr.args).toHaveLength(2);
      expect(newExpr.args[0]).toMatchObject({ kind: 'StringLiteral', value: 'Kitty' });
    }
  });

  it('parses Player.SetAttempts(5) as an ExpressionStatement (no CALL keyword)', () => {
    const ast = parseOk(`
Player.SetAttempts(5)
`);
    expect(ast.body).toHaveLength(1);
    const stmt = ast.body[0] as ExpressionStatement;
    expect(stmt.kind).toBe('ExpressionStatement');
    expect(stmt.expression.kind).toBe('MethodCallExpression');
    const call = stmt.expression as MethodCallExpression;
    expect(call.object).toMatchObject({ kind: 'Identifier', name: 'Player' });
    expect(call.method.name).toBe('SetAttempts');
    expect(call.args).toHaveLength(1);
  });

  it('parses OUTPUT Player.GetAttempts() (method call inside an expression)', () => {
    const ast = parseOk(`
OUTPUT Player.GetAttempts()
`);
    expect(ast.body[0]).toMatchObject({
      kind: 'OutputStatement',
      expressions: [
        {
          kind: 'MethodCallExpression',
          object: { kind: 'Identifier', name: 'Player' },
          method: { name: 'GetAttempts' },
          args: [],
        },
      ],
    });
  });

  it('still supports CALL Obj.Method(args) with the explicit CALL keyword', () => {
    const ast = parseOk(`
CALL Player.SetAttempts(5)
`);
    expect(ast.body[0]).toMatchObject({
      kind: 'CallStatement',
      callee: { kind: 'MemberExpression', property: { name: 'SetAttempts' } },
    });
  });

  it('rejects nested CLASS declarations with E_NESTED_CLASS', () => {
    const result = parse(`
CLASS Outer
CLASS Inner
ENDCLASS
ENDCLASS
`);
    expect(result.diagnostics.some((d) => d.code === 'E_NESTED_CLASS')).toBe(true);
  });

  it('parses an empty class body', () => {
    const ast = parseOk(`
CLASS Empty
ENDCLASS
`);
    const cls = findClass(ast.body, 'Empty');
    expect(cls.members).toHaveLength(0);
  });

  it('parses a PUBLIC FUNCTION method with RETURNS and a body', () => {
    const ast = parseOk(`
CLASS Counter
PRIVATE Attempts : INTEGER
PUBLIC PROCEDURE NEW()
  Attempts \u2190 0
ENDPROCEDURE
PUBLIC FUNCTION GetAttempts() RETURNS INTEGER
  RETURN Attempts
ENDFUNCTION
ENDCLASS
`);
    const cls = findClass(ast.body, 'Counter');
    const fn = cls.members.find(
      (m) => m.kind === 'ClassFunctionDeclaration',
    ) as ClassFunctionDeclaration;
    expect(fn).toBeDefined();
    expect(fn.visibility).toBe('PUBLIC');
    expect(fn.name.name).toBe('GetAttempts');
    expect(fn.returnType).toMatchObject({ kind: 'TypeName', name: 'INTEGER' });
    expect(fn.body).toHaveLength(1);
    expect(fn.body[0]).toMatchObject({ kind: 'ReturnStatement' });
  });

  it('accepts an optional DECLARE keyword before a class property', () => {
    const ast = parseOk(`
CLASS Widget
PRIVATE DECLARE Width : INTEGER
ENDCLASS
`);
    const cls = findClass(ast.body, 'Widget');
    expect(cls.members[0]).toMatchObject({
      kind: 'ClassPropertyDeclaration',
      visibility: 'PRIVATE',
      names: [{ name: 'Width' }],
    });
  });

  it('defaults visibility to null when PUBLIC/PRIVATE is omitted', () => {
    const ast = parseOk(`
CLASS Widget
Width : INTEGER
PROCEDURE NEW()
ENDPROCEDURE
ENDCLASS
`);
    const cls = findClass(ast.body, 'Widget');
    expect(cls.members[0]).toMatchObject({
      kind: 'ClassPropertyDeclaration',
      visibility: null,
    });
    expect(cls.members[1]).toMatchObject({
      kind: 'ClassProcedureDeclaration',
      visibility: null,
      name: { name: 'NEW' },
    });
  });

  it('rejects PUBLIC/PRIVATE at program level', () => {
    const result = parse('PRIVATE X : INTEGER\n');
    expect(result.diagnostics.some((d) => d.code === 'E_VISIBILITY_OUTSIDE_CLASS')).toBe(
      true,
    );
  });

  it('rejects CLASS declared inside a PROCEDURE', () => {
    const result = parse(`
PROCEDURE P
  CLASS Inner
  ENDCLASS
ENDPROCEDURE
`);
    expect(result.diagnostics.some((d) => d.code === 'E_NESTED_CLASS')).toBe(true);
  });
});
