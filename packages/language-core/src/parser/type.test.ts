import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';

describe('TYPE / ENDTYPE records', () => {
  it('parses a simple record type and field access', () => {
    const src = `
TYPE Student
  DECLARE Name : STRING
  DECLARE Age : INTEGER
ENDTYPE
DECLARE S : Student
S.Name ← "Alice"
S.Age ← 16
OUTPUT S.Name
`;
    const result = parse(src);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const body = result.ast!.body;
    expect(body[0]?.kind).toBe('TypeDeclaration');
    if (body[0]?.kind === 'TypeDeclaration') {
      expect(body[0].name.name).toBe('Student');
      expect(body[0].fields).toHaveLength(2);
    }
    expect(body[2]?.kind).toBe('AssignmentStatement');
    if (body[2]?.kind === 'AssignmentStatement') {
      expect(body[2].target.kind).toBe('MemberExpression');
    }
  });

  it('parses nested records and arrays of records', () => {
    const src = `
TYPE Address
  DECLARE City : STRING
ENDTYPE
TYPE Student
  DECLARE Home : Address
  DECLARE Marks : ARRAY[1:3] OF INTEGER
ENDTYPE
DECLARE Roster : ARRAY[1:2] OF Student
Roster[1].Home.City ← "Cambridge"
Roster[1].Marks[2] ← 90
`;
    const result = parse(src);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const assign = result.ast!.body.find(
      (s) => s.kind === 'AssignmentStatement' && s.target.kind === 'MemberExpression',
    );
    expect(assign).toBeDefined();
  });

  it('rejects enum TYPE form with stable code', () => {
    const result = parse('TYPE Colour = (Red, Green)\n');
    expect(result.diagnostics.some((d) => d.code === 'E_UNSUPPORTED_TYPE_FORM')).toBe(
      true,
    );
  });

  it('does not hoist field DECLAREs when TYPE name is missing', () => {
    const result = parse(`
TYPE
  DECLARE Name : STRING
ENDTYPE
`);
    expect(result.ok).toBe(false);
    const declares = (result.ast?.body ?? []).filter(
      (s) => s.kind === 'DeclareStatement',
    );
    expect(declares).toHaveLength(0);
  });

  it('parses empty TYPE bodies', () => {
    const result = parse(`
TYPE Empty
ENDTYPE
`);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.ast!.body[0]?.kind).toBe('TypeDeclaration');
    if (result.ast!.body[0]?.kind === 'TypeDeclaration') {
      expect(result.ast!.body[0].fields).toHaveLength(0);
    }
  });
});
