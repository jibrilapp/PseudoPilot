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

describe('BYVAL / BYREF parameter modes (Cambridge §8.3)', () => {
  it('defaults omitted modes to BYVAL', () => {
    const ast = parseOk(`
PROCEDURE P(A : INTEGER, B : INTEGER)
ENDPROCEDURE
`);
    const proc = findRoutine(ast.body, 'P') as ProcedureDeclaration;
    expect(proc.parameters.map((p) => p.mode)).toEqual(['BYVAL', 'BYVAL']);
  });

  it('parses explicit BYVAL', () => {
    const ast = parseOk(`
PROCEDURE P(BYVAL A : INTEGER)
ENDPROCEDURE
`);
    const proc = findRoutine(ast.body, 'P') as ProcedureDeclaration;
    expect(proc.parameters[0]).toMatchObject({
      name: { name: 'A' },
      mode: 'BYVAL',
    });
  });

  it('parses Cambridge SWAP sticky BYREF across groups', () => {
    const ast = parseOk(`
PROCEDURE SWAP(BYREF X : INTEGER, Y : INTEGER)
    DECLARE Temp : INTEGER
    Temp ← X
    X ← Y
    Y ← Temp
ENDPROCEDURE
`);
    const proc = findRoutine(ast.body, 'SWAP') as ProcedureDeclaration;
    expect(proc.parameters.map((p) => [p.name.name, p.mode])).toEqual([
      ['X', 'BYREF'],
      ['Y', 'BYREF'],
    ]);
  });

  it('applies BYREF to a grouped name list', () => {
    const ast = parseOk(`
PROCEDURE SWAP(BYREF X, Y : INTEGER)
ENDPROCEDURE
`);
    const proc = findRoutine(ast.body, 'SWAP') as ProcedureDeclaration;
    expect(proc.parameters.map((p) => p.mode)).toEqual(['BYREF', 'BYREF']);
  });

  it('allows mixed BYREF then BYVAL when mode is restated', () => {
    const ast = parseOk(`
PROCEDURE P(BYREF A : INTEGER, BYVAL B : INTEGER)
ENDPROCEDURE
`);
    const proc = findRoutine(ast.body, 'P') as ProcedureDeclaration;
    expect(proc.parameters.map((p) => [p.name.name, p.mode])).toEqual([
      ['A', 'BYREF'],
      ['B', 'BYVAL'],
    ]);
  });

  it('parses BYREF on CLASS method parameters', () => {
    const ast = parseOk(`
CLASS C
    PUBLIC PROCEDURE Set(BYREF N : INTEGER)
        N ← 1
    ENDPROCEDURE
ENDCLASS
`);
    const cls = ast.body[0]!;
    expect(cls.kind).toBe('ClassDeclaration');
    if (cls.kind !== 'ClassDeclaration') return;
    const method = cls.members.find((m) => m.kind === 'ClassProcedureDeclaration');
    expect(method).toBeDefined();
    if (method?.kind !== 'ClassProcedureDeclaration') return;
    expect(method.parameters[0]!.mode).toBe('BYREF');
  });

  it('parses BYVAL on FUNCTION parameters (BYREF rejected later by checker)', () => {
    const ast = parseOk(`
FUNCTION F(BYVAL A : INTEGER) RETURNS INTEGER
    RETURN A
ENDFUNCTION
`);
    const fn = findRoutine(ast.body, 'F') as FunctionDeclaration;
    expect(fn.parameters[0]!.mode).toBe('BYVAL');
  });

  it('parses BYREF on FUNCTION parameters (semantic error later)', () => {
    const ast = parseOk(`
FUNCTION F(BYREF A : INTEGER) RETURNS INTEGER
    RETURN A
ENDFUNCTION
`);
    const fn = findRoutine(ast.body, 'F') as FunctionDeclaration;
    expect(fn.parameters[0]!.mode).toBe('BYREF');
  });

  it('accepts lowercase byref/byval keywords', () => {
    const ast = parseOk(`
PROCEDURE P(byref A : INTEGER, byval B : INTEGER)
ENDPROCEDURE
`);
    const proc = findRoutine(ast.body, 'P') as ProcedureDeclaration;
    expect(proc.parameters.map((p) => p.mode)).toEqual(['BYREF', 'BYVAL']);
  });
});
