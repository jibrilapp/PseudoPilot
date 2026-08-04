import { describe, expect, it } from 'vitest';
import { parse } from '@pseudopilot/language-core';
import { check } from './check.js';

function checkSrc(src: string) {
  const parsed = parse(src);
  expect(parsed.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return check(parsed.ast!);
}

describe('TYPE / record semantic checking', () => {
  it('accepts simple records and field assign/read', () => {
    const result = checkSrc(`
TYPE Student
  DECLARE Name : STRING
  DECLARE Age : INTEGER
ENDTYPE
DECLARE S : Student
S.Name ← "Alice"
S.Age ← 16
OUTPUT S.Name
`);
    expect(result.ok).toBe(true);
    expect(result.symbols.some((s) => s.kind === 'type' && s.name === 'Student')).toBe(
      true,
    );
  });

  it('accepts nested records', () => {
    const result = checkSrc(`
TYPE Address
  DECLARE City : STRING
ENDTYPE
TYPE Student
  DECLARE Home : Address
ENDTYPE
DECLARE S : Student
S.Home.City ← "Cambridge"
OUTPUT S.Home.City
`);
    expect(result.ok).toBe(true);
  });

  it('diagnoses unknown field and unknown type', () => {
    const unknownField = checkSrc(`
TYPE Student
  DECLARE Name : STRING
ENDTYPE
DECLARE S : Student
S.Age ← 1
`);
    expect(unknownField.diagnostics.some((d) => d.code === 'C_UNKNOWN_FIELD')).toBe(
      true,
    );

    const parsed = parse(`DECLARE S : Ghost\n`);
    const unknownType = check(parsed.ast!);
    expect(unknownType.diagnostics.some((d) => d.code === 'C_UNKNOWN_TYPE')).toBe(
      true,
    );
  });

  it('diagnoses duplicate type and field', () => {
    const dupType = checkSrc(`
TYPE Student
  DECLARE Name : STRING
ENDTYPE
TYPE student
  DECLARE Age : INTEGER
ENDTYPE
`);
    expect(dupType.diagnostics.some((d) => d.code === 'C_DUP_TYPE')).toBe(true);

    const dupField = checkSrc(`
TYPE Student
  DECLARE Name : STRING
  DECLARE name : INTEGER
ENDTYPE
`);
    expect(dupField.diagnostics.some((d) => d.code === 'C_DUP_FIELD')).toBe(true);
  });

  it('diagnoses recursive types', () => {
    const result = checkSrc(`
TYPE Node
  DECLARE Child : Node
ENDTYPE
`);
    expect(result.diagnostics.some((d) => d.code === 'C_RECURSIVE_TYPE')).toBe(true);
  });

  it('accepts arrays of records and records containing arrays', () => {
    const result = checkSrc(`
TYPE Student
  DECLARE Marks : ARRAY[1:3] OF INTEGER
ENDTYPE
DECLARE Cohort : ARRAY[1:2] OF Student
Cohort[1].Marks[2] ← 90
OUTPUT Cohort[1].Marks[2]
`);
    expect(result.ok).toBe(true);
  });

  it('allows same field name on different TYPEs', () => {
    const result = checkSrc(`
TYPE Student
  DECLARE Name : STRING
ENDTYPE
TYPE Teacher
  DECLARE Name : STRING
ENDTYPE
DECLARE S : Student
DECLARE T : Teacher
S.Name ← "A"
T.Name ← "B"
`);
    expect(result.ok).toBe(true);
    expect(result.diagnostics.filter((d) => d.code === 'C_DUP_FIELD')).toEqual(
      [],
    );
  });

  it('allows a field named the same as its TYPE', () => {
    const result = checkSrc(`
TYPE Status
  DECLARE Status : INTEGER
ENDTYPE
DECLARE S : Status
S.Status ← 1
`);
    expect(result.ok).toBe(true);
  });

  it('does not clobber the first TYPE when a duplicate TYPE is declared', () => {
    const result = checkSrc(`
TYPE Student
  DECLARE Name : STRING
ENDTYPE
TYPE student
  DECLARE Age : INTEGER
ENDTYPE
DECLARE S : Student
OUTPUT S.Name
`);
    expect(result.diagnostics.some((d) => d.code === 'C_DUP_TYPE')).toBe(true);
    expect(result.diagnostics.some((d) => d.code === 'C_UNKNOWN_FIELD')).toBe(
      false,
    );
    // Only one C_DUP_TYPE (no Scope double-report).
    expect(result.diagnostics.filter((d) => d.code === 'C_DUP_TYPE')).toHaveLength(
      1,
    );
  });

  it('resolves forward-reference chains A→B→C for nested field assign', () => {
    const result = checkSrc(`
TYPE A
  DECLARE F1 : B
ENDTYPE
TYPE B
  DECLARE F2 : C
ENDTYPE
TYPE C
  DECLARE F3 : INTEGER
ENDTYPE
DECLARE X : A
X.F1.F2.F3 ← 1
`);
    expect(result.ok).toBe(true);
  });

  it('rejects comparing whole records or arrays', () => {
    const records = checkSrc(`
TYPE Student
  DECLARE Age : INTEGER
ENDTYPE
DECLARE A : Student
DECLARE B : Student
IF A = B THEN
  OUTPUT "eq"
ENDIF
`);
    expect(records.diagnostics.some((d) => d.code === 'C_COMPARE_TYPE')).toBe(
      true,
    );
    expect(records.ok).toBe(false);

    const ordered = checkSrc(`
TYPE Student
  DECLARE Age : INTEGER
ENDTYPE
DECLARE A : Student
DECLARE B : Student
IF A < B THEN
  OUTPUT "lt"
ENDIF
`);
    expect(ordered.diagnostics.some((d) => d.code === 'C_COMPARE_TYPE')).toBe(
      true,
    );
    expect(ordered.ok).toBe(false);
  });

  it('checks ARRAY bound types inside TYPE bodies', () => {
    const result = checkSrc(`
TYPE Student
  DECLARE Marks : ARRAY[1.5:3] OF INTEGER
ENDTYPE
`);
    expect(result.diagnostics.some((d) => d.code === 'C_ARRAY_BOUND_TYPE')).toBe(
      true,
    );
  });

  it('accepts empty TYPE bodies', () => {
    const result = checkSrc(`
TYPE Empty
ENDTYPE
DECLARE E : Empty
`);
    expect(result.ok).toBe(true);
  });
});
