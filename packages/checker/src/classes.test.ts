import { describe, expect, it } from 'vitest';
import { parse } from '@pseudopilot/language-core';
import { check } from './check.js';

function checkSrc(src: string) {
  const parsed = parse(src);
  expect(
    parsed.diagnostics.filter((d) => d.severity === 'error'),
    JSON.stringify(parsed.diagnostics, null, 2),
  ).toEqual([]);
  return check(parsed.ast!);
}

function codes(src: string): string[] {
  const parsed = parse(src);
  return check(parsed.ast!).diagnostics.map((d) => d.code);
}

describe('CLASS semantic checking', () => {
  it('accepts a simple class with a field, a constructor, NEW, and field access via a method', () => {
    const result = checkSrc(`
CLASS Pet
  PRIVATE Name : STRING
  PUBLIC PROCEDURE NEW(GivenName : STRING)
    Name ← GivenName
  ENDPROCEDURE
  PUBLIC FUNCTION GetName() RETURNS STRING
    RETURN Name
  ENDFUNCTION
ENDCLASS

DECLARE MyPet : Pet
MyPet ← NEW Pet("Rex")
OUTPUT MyPet.GetName()
`);
    expect(result.ok).toBe(true);
    expect(result.symbols.some((s) => s.kind === 'class' && s.name === 'Pet')).toBe(true);
    expect(
      result.symbols.some(
        (s) => s.kind === 'method' && s.name === 'GetName' && s.containerName === 'Pet',
      ),
    ).toBe(true);
  });

  it('rejects accessing a PRIVATE field from outside the class', () => {
    const result = checkSrc(`
CLASS Pet
  PRIVATE Name : STRING
  PUBLIC PROCEDURE NEW(GivenName : STRING)
    Name ← GivenName
  ENDPROCEDURE
ENDCLASS

DECLARE MyPet : Pet
MyPet ← NEW Pet("Rex")
OUTPUT MyPet.Name
`);
    expect(result.diagnostics.some((d) => d.code === 'C_PRIVATE_ACCESS')).toBe(true);
    expect(result.ok).toBe(false);
  });

  it('allows accessing a PRIVATE field from inside its own method (implicit this)', () => {
    const result = checkSrc(`
CLASS Counter
  PRIVATE Value : INTEGER
  PUBLIC PROCEDURE NEW()
    Value ← 0
  ENDPROCEDURE
  PUBLIC PROCEDURE Increment()
    Value ← Value + 1
  ENDPROCEDURE
  PUBLIC FUNCTION GetValue() RETURNS INTEGER
    RETURN Value
  ENDFUNCTION
ENDCLASS

DECLARE C : Counter
C ← NEW Counter()
CALL C.Increment()
OUTPUT C.GetValue()
`);
    expect(result.ok).toBe(true);
    expect(result.diagnostics.filter((d) => d.code === 'C_PRIVATE_ACCESS')).toEqual([]);
  });

  it('rejects PRIVATE access to an inherited field from the subclass (not visible even to subclass code)', () => {
    const result = checkSrc(`
CLASS Animal
  PRIVATE Name : STRING
  PUBLIC PROCEDURE NEW(GivenName : STRING)
    Name ← GivenName
  ENDPROCEDURE
ENDCLASS

CLASS Dog INHERITS Animal
  PUBLIC PROCEDURE NEW(GivenName : STRING)
    SUPER.NEW(GivenName)
  ENDPROCEDURE
  PUBLIC FUNCTION GetName() RETURNS STRING
    RETURN Name
  ENDFUNCTION
ENDCLASS
`);
    expect(result.diagnostics.some((d) => d.code === 'C_PRIVATE_ACCESS')).toBe(true);
  });

  it('supports inheritance, PUBLIC field access from subclass, and SUPER.NEW typing', () => {
    const result = checkSrc(`
CLASS Animal
  PUBLIC Name : STRING
  PUBLIC PROCEDURE NEW(GivenName : STRING)
    Name ← GivenName
  ENDPROCEDURE
  PUBLIC FUNCTION Speak() RETURNS STRING
    RETURN "..."
  ENDFUNCTION
ENDCLASS

CLASS Dog INHERITS Animal
  PUBLIC PROCEDURE NEW(GivenName : STRING)
    SUPER.NEW(GivenName)
  ENDPROCEDURE
  PUBLIC FUNCTION Speak() RETURNS STRING
    RETURN "Woof"
  ENDFUNCTION
ENDCLASS

DECLARE D : Dog
D ← NEW Dog("Rex")
OUTPUT D.Name
OUTPUT D.Speak()
`);
    expect(result.ok).toBe(true);
  });

  it('allows assigning a subclass instance to a variable declared with the parent type (covariance)', () => {
    const result = checkSrc(`
CLASS Animal
  PUBLIC PROCEDURE NEW()
  ENDPROCEDURE
ENDCLASS

CLASS Dog INHERITS Animal
  PUBLIC PROCEDURE NEW()
    SUPER.NEW()
  ENDPROCEDURE
ENDCLASS

DECLARE A : Animal
A ← NEW Dog()
`);
    expect(result.ok).toBe(true);
  });

  it('rejects assigning a parent instance to a variable declared with the subclass type', () => {
    const result = checkSrc(`
CLASS Animal
  PUBLIC PROCEDURE NEW()
  ENDPROCEDURE
ENDCLASS

CLASS Dog INHERITS Animal
  PUBLIC PROCEDURE NEW()
    SUPER.NEW()
  ENDPROCEDURE
ENDCLASS

DECLARE D : Dog
D ← NEW Animal()
`);
    expect(result.diagnostics.some((d) => d.code === 'C_ASSIGN_TYPE')).toBe(true);
  });

  it('diagnoses cyclic inheritance', () => {
    expect(
      codes(`
CLASS A INHERITS B
ENDCLASS
CLASS B INHERITS A
ENDCLASS
`),
    ).toContain('C_CYCLIC_INHERITANCE');

    expect(
      codes(`
CLASS Self INHERITS Self
ENDCLASS
`),
    ).toContain('C_CYCLIC_INHERITANCE');
  });

  it('diagnoses duplicate CLASS names (case-insensitive)', () => {
    expect(
      codes(`
CLASS Pet
ENDCLASS
CLASS pet
ENDCLASS
`),
    ).toContain('C_DUP_CLASS');
  });

  it('diagnoses a CLASS colliding with an existing TYPE name', () => {
    expect(
      codes(`
TYPE Student
  DECLARE Name : STRING
ENDTYPE
CLASS Student
ENDCLASS
`),
    ).toContain('C_DUP_TYPE');
  });

  it('diagnoses duplicate methods (including two NEW constructors)', () => {
    expect(
      codes(`
CLASS Pet
  PUBLIC PROCEDURE NEW()
  ENDPROCEDURE
  PUBLIC PROCEDURE NEW(Name : STRING)
  ENDPROCEDURE
ENDCLASS
`),
    ).toContain('C_DUP_METHOD');

    expect(
      codes(`
CLASS Pet
  PUBLIC PROCEDURE Speak()
  ENDPROCEDURE
  PUBLIC FUNCTION Speak() RETURNS STRING
    RETURN "hi"
  ENDFUNCTION
ENDCLASS
`),
    ).toContain('C_DUP_METHOD');
  });

  it('diagnoses duplicate members (fields)', () => {
    expect(
      codes(`
CLASS Pet
  PRIVATE Name : STRING
  PRIVATE name : STRING
ENDCLASS
`),
    ).toContain('C_DUP_MEMBER');
  });

  it('diagnoses NEW on an unknown CLASS', () => {
    expect(codes(`DECLARE X : INTEGER\nX ← 1\nOUTPUT NEW Ghost()\n`)).toContain(
      'C_INVALID_NEW',
    );
  });

  it('diagnoses method call arity mismatches', () => {
    const result = checkSrc(`
CLASS Pet
  PUBLIC PROCEDURE NEW()
  ENDPROCEDURE
  PUBLIC PROCEDURE SetAttempts(N : INTEGER)
  ENDPROCEDURE
ENDCLASS

DECLARE P : Pet
P ← NEW Pet()
CALL P.SetAttempts(1, 2)
`);
    expect(result.diagnostics.some((d) => d.code === 'C_ARG_COUNT')).toBe(true);
  });

  it('diagnoses unknown methods and unknown properties', () => {
    const result = checkSrc(`
CLASS Pet
  PUBLIC PROCEDURE NEW()
  ENDPROCEDURE
ENDCLASS

DECLARE P : Pet
P ← NEW Pet()
CALL P.Bark()
OUTPUT P.Age
`);
    expect(result.diagnostics.some((d) => d.code === 'C_UNKNOWN_METHOD')).toBe(true);
    expect(result.diagnostics.some((d) => d.code === 'C_UNKNOWN_FIELD')).toBe(true);
  });

  it('diagnoses SUPER used outside a class method, and outside a subclass', () => {
    expect(codes(`OUTPUT SUPER\n`)).toContain('C_SUPER_OUTSIDE');

    expect(
      codes(`
CLASS Base
  PUBLIC PROCEDURE NEW()
    SUPER.NEW()
  ENDPROCEDURE
ENDCLASS
`),
    ).toContain('C_SUPER_OUTSIDE');
  });

  it('diagnoses unknown CLASS in INHERITS and inheriting from a TYPE', () => {
    expect(
      codes(`
CLASS Dog INHERITS Ghost
ENDCLASS
`),
    ).toContain('C_UNKNOWN_CLASS');

    expect(
      codes(`
TYPE Student
  DECLARE Name : STRING
ENDTYPE
CLASS Dog INHERITS Student
ENDCLASS
`),
    ).toContain('C_INVALID_INHERITS');
  });

  it('accepts CLASS-typed parameters, PROCEDURE calling methods without CALL keyword, and OUTPUT of a FUNCTION method', () => {
    const result = checkSrc(`
CLASS Player
  PRIVATE Attempts : INTEGER
  PUBLIC PROCEDURE NEW()
    Attempts ← 0
  ENDPROCEDURE
  PUBLIC PROCEDURE SetAttempts(N : INTEGER)
    Attempts ← N
  ENDPROCEDURE
  PUBLIC FUNCTION GetAttempts() RETURNS INTEGER
    RETURN Attempts
  ENDFUNCTION
ENDCLASS

DECLARE P : Player
P ← NEW Player()
P.SetAttempts(5)
OUTPUT P.GetAttempts()
`);
    expect(result.ok).toBe(true);
  });

  it('rejects comparing whole CLASS instances', () => {
    const result = checkSrc(`
CLASS Pet
  PUBLIC PROCEDURE NEW()
  ENDPROCEDURE
ENDCLASS

DECLARE A : Pet
DECLARE B : Pet
A ← NEW Pet()
B ← NEW Pet()
IF A = B THEN
  OUTPUT "eq"
ENDIF
`);
    expect(result.diagnostics.some((d) => d.code === 'C_COMPARE_TYPE')).toBe(true);
  });

  it('warns on override signature mismatches', () => {
    const result = checkSrc(`
CLASS Animal
  PUBLIC FUNCTION Speak() RETURNS STRING
    RETURN "..."
  ENDFUNCTION
ENDCLASS

CLASS Dog INHERITS Animal
  PUBLIC PROCEDURE NEW()
  ENDPROCEDURE
  PUBLIC FUNCTION Speak(Volume : INTEGER) RETURNS STRING
    RETURN "Woof"
  ENDFUNCTION
ENDCLASS
`);
    expect(result.diagnostics.some((d) => d.code === 'C_OVERRIDE_MISMATCH')).toBe(true);
  });

  it('accepts an empty class and DECLARE of a class type with no constructor', () => {
    const result = checkSrc(`
CLASS Empty
ENDCLASS
DECLARE E : Empty
E ← NEW Empty()
`);
    expect(result.ok).toBe(true);
  });

  it('checks ARRAY bound types inside CLASS bodies', () => {
    const result = checkSrc(`
CLASS Widget
  PRIVATE Sizes : ARRAY[1.5:3] OF INTEGER
ENDCLASS
`);
    expect(result.diagnostics.some((d) => d.code === 'C_ARRAY_BOUND_TYPE')).toBe(true);
  });
});
