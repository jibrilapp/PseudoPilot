import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import type {
  FunctionDeclaration,
  ProcedureDeclaration,
  Program,
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

describe('Cambridge grouped parameter declarations', () => {
  it('parses a single grouped parameter pair on a FUNCTION', () => {
    const ast = parseOk(`
FUNCTION F(a, b : INTEGER) RETURNS REAL
  RETURN a + b
ENDFUNCTION
`);
    const fn = findRoutine(ast.body, 'F') as FunctionDeclaration;
    expect(fn.parameters).toHaveLength(2);
    expect(fn.parameters.map((p) => p.name.name)).toEqual(['a', 'b']);
    expect(fn.parameters.every((p) => p.typeName.name === 'INTEGER')).toBe(true);
    expect(fn.parameters.every((p) => p.kind === 'Parameter')).toBe(true);
  });

  it('parses a single grouped parameter list on a PROCEDURE', () => {
    const ast = parseOk(`
PROCEDURE P(x, y, z : STRING)
  OUTPUT x
ENDPROCEDURE
`);
    const proc = findRoutine(ast.body, 'P') as ProcedureDeclaration;
    expect(proc.parameters.map((p) => [p.name.name, p.typeName.name])).toEqual([
      ['x', 'STRING'],
      ['y', 'STRING'],
      ['z', 'STRING'],
    ]);
  });

  it('parses mixed grouped + single parameters', () => {
    const ast = parseOk(`
FUNCTION F(
  a, b : INTEGER,
  c : REAL,
  d, e, f : BOOLEAN
) RETURNS REAL
  RETURN c
ENDFUNCTION
`);
    const fn = findRoutine(ast.body, 'F') as FunctionDeclaration;
    expect(fn.parameters.map((p) => [p.name.name, p.typeName.name])).toEqual([
      ['a', 'INTEGER'],
      ['b', 'INTEGER'],
      ['c', 'REAL'],
      ['d', 'BOOLEAN'],
      ['e', 'BOOLEAN'],
      ['f', 'BOOLEAN'],
    ]);
  });

  it('still accepts the fully expanded form', () => {
    const ast = parseOk(`
FUNCTION F(a : INTEGER, b : INTEGER) RETURNS INTEGER
  RETURN a + b
ENDFUNCTION
`);
    const fn = findRoutine(ast.body, 'F') as FunctionDeclaration;
    expect(fn.parameters).toHaveLength(2);
  });

  it('parses grouped parameters on CLASS methods', () => {
    const ast = parseOk(`
CLASS Box
  PUBLIC PROCEDURE NEW(w, h : INTEGER)
  ENDPROCEDURE
  PUBLIC FUNCTION Area(scale, pad : INTEGER) RETURNS INTEGER
    RETURN scale + pad
  ENDFUNCTION
ENDCLASS
`);
    const cls = ast.body[0];
    expect(cls?.kind).toBe('ClassDeclaration');
    if (cls?.kind !== 'ClassDeclaration') return;
    const ctor = cls.members.find(
      (m) => m.kind === 'ClassProcedureDeclaration' && m.name.name === 'NEW',
    );
    expect(ctor?.kind).toBe('ClassProcedureDeclaration');
    if (ctor?.kind !== 'ClassProcedureDeclaration') return;
    expect(ctor.parameters.map((p) => p.name.name)).toEqual(['w', 'h']);
    expect(ctor.parameters.every((p) => p.typeName.name === 'INTEGER')).toBe(true);
  });

  it('rejects empty name after comma before colon: (a, : INTEGER)', () => {
    const result = parse(`
FUNCTION F(a, : INTEGER) RETURNS INTEGER
  RETURN a
ENDFUNCTION
`);
    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some((d) =>
        d.message.includes("Expected identifier after ','"),
      ),
    ).toBe(true);
  });

  it('rejects leading comma: (,a : INTEGER)', () => {
    const result = parse(`
FUNCTION F(,a : INTEGER) RETURNS INTEGER
  RETURN a
ENDFUNCTION
`);
    expect(result.ok).toBe(false);
  });

  it('rejects missing comma between names: (a b : INTEGER)', () => {
    const result = parse(`
FUNCTION F(a b : INTEGER) RETURNS INTEGER
  RETURN a
ENDFUNCTION
`);
    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some((d) =>
        d.message.includes("Expected ':' after parameter name"),
      ),
    ).toBe(true);
  });

  it('rejects double comma in a group: (a,, b : INTEGER)', () => {
    const result = parse(`
PROCEDURE P(a,, b : INTEGER)
  OUTPUT a
ENDPROCEDURE
`);
    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some((d) =>
        d.message.includes("Expected identifier after ','"),
      ),
    ).toBe(true);
  });
});
