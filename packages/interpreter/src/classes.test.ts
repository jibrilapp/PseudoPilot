import { describe, expect, it } from 'vitest';
import { MemoryHost, SeededRandom, runPseudocode } from './index.js';

async function run(
  source: string,
  inputs: string[] = [],
  opts: {
    maxSteps?: number;
    maxCallDepth?: number;
    seed?: number;
    semanticCheck?: boolean;
  } = {},
) {
  const host = new MemoryHost(inputs);
  const result = await runPseudocode(source, {
    host,
    random: new SeededRandom(opts.seed ?? 1),
    ...(opts.maxSteps !== undefined ? { maxSteps: opts.maxSteps } : {}),
    ...(opts.maxCallDepth !== undefined
      ? { maxCallDepth: opts.maxCallDepth }
      : {}),
    ...(opts.semanticCheck !== undefined
      ? { semanticCheck: opts.semanticCheck }
      : {}),
  });
  return { result, host };
}

describe('CLASS / ENDCLASS — Cambridge 9618 OOP runtime', () => {
  it('runs NEW with a constructor argument and a FUNCTION getter method', async () => {
    const { result, host } = await run(`
CLASS Counter
  PRIVATE Value : INTEGER
  PUBLIC PROCEDURE NEW(Start : INTEGER)
    Value ← Start
  ENDPROCEDURE
  PUBLIC FUNCTION GetValue() RETURNS INTEGER
    RETURN Value
  ENDFUNCTION
ENDCLASS
DECLARE C : Counter
C ← NEW Counter(5)
OUTPUT C.GetValue()
`);
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
    expect(host.outputs).toEqual(['5']);
  });

  it('does not enforce PRIVATE access at runtime (checker enforces it statically)', async () => {
    const { result, host } = await run(
      `
CLASS Pet
  PRIVATE Name : STRING
  PUBLIC PROCEDURE NEW(GivenName : STRING)
    Name ← GivenName
  ENDPROCEDURE
ENDCLASS
DECLARE P : Pet
P ← NEW Pet("Rex")
OUTPUT P.Name
`,
      [],
      { semanticCheck: false },
    );
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
    expect(host.outputs).toEqual(['Rex']);
  });

  it('supports INHERITS with SUPER.NEW(...) and a child-only field', async () => {
    const { result, host } = await run(`
CLASS Animal
  PRIVATE Name : STRING
  PUBLIC PROCEDURE NEW(GivenName : STRING)
    Name ← GivenName
  ENDPROCEDURE
  PUBLIC FUNCTION GetName() RETURNS STRING
    RETURN Name
  ENDFUNCTION
ENDCLASS
CLASS Dog INHERITS Animal
  PRIVATE Breed : STRING
  PUBLIC PROCEDURE NEW(GivenName : STRING, GivenBreed : STRING)
    SUPER.NEW(GivenName)
    Breed ← GivenBreed
  ENDPROCEDURE
  PUBLIC FUNCTION GetBreed() RETURNS STRING
    RETURN Breed
  ENDFUNCTION
ENDCLASS
DECLARE D : Dog
D ← NEW Dog("Rex", "Labrador")
OUTPUT D.GetName()
OUTPUT D.GetBreed()
`);
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
    expect(host.outputs).toEqual(['Rex', 'Labrador']);
  });

  it('aliases objects on assignment: mutating B mutates A (reference semantics)', async () => {
    const { result, host } = await run(`
CLASS Box
  PUBLIC Value : INTEGER
  PUBLIC PROCEDURE NEW(V : INTEGER)
    Value ← V
  ENDPROCEDURE
ENDCLASS
DECLARE A, B : Box
A ← NEW Box(1)
B ← A
B.Value ← 99
OUTPUT A.Value
OUTPUT B.Value
`);
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
    expect(host.outputs).toEqual(['99', '99']);
  });

  it('still copies TYPE records by value (regression against object aliasing)', async () => {
    const { result, host } = await run(`
TYPE Point
  DECLARE X : INTEGER
ENDTYPE
DECLARE A, B : Point
A.X ← 1
B ← A
B.X ← 99
OUTPUT A.X
OUTPUT B.X
`);
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
    expect(host.outputs).toEqual(['1', '99']);
  });

  it('calls a method as a bare ExpressionStatement (no CALL keyword)', async () => {
    const { result, host } = await run(`
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
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
    expect(host.outputs).toEqual(['5']);
  });

  it('dispatches to the overriding method on a parent-typed variable holding a subclass instance (polymorphism)', async () => {
    const { result, host } = await run(`
CLASS Animal
  PUBLIC PROCEDURE NEW()
  ENDPROCEDURE
  PUBLIC FUNCTION Speak() RETURNS STRING
    RETURN "..."
  ENDFUNCTION
ENDCLASS
CLASS Dog INHERITS Animal
  PUBLIC PROCEDURE NEW()
    SUPER.NEW()
  ENDPROCEDURE
  PUBLIC FUNCTION Speak() RETURNS STRING
    RETURN "Woof"
  ENDFUNCTION
ENDCLASS
DECLARE A : Animal
A ← NEW Dog()
OUTPUT A.Speak()
`);
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
    expect(host.outputs).toEqual(['Woof']);
  });

  it('supports arrays of objects, each NEW-allocated independently', async () => {
    const { result, host } = await run(`
CLASS Point
  PUBLIC X : INTEGER
  PUBLIC PROCEDURE NEW(GivenX : INTEGER)
    X ← GivenX
  ENDPROCEDURE
ENDCLASS
DECLARE Points : ARRAY[1:3] OF Point
FOR I ← 1 TO 3
  Points[I] ← NEW Point(I * 10)
NEXT I
FOR I ← 1 TO 3
  OUTPUT Points[I].X
NEXT I
`);
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
    expect(host.outputs).toEqual(['10', '20', '30']);
  });

  it('supports nested object fields (object containing another object)', async () => {
    const { result, host } = await run(`
CLASS Engine
  PUBLIC Horsepower : INTEGER
  PUBLIC PROCEDURE NEW(HP : INTEGER)
    Horsepower ← HP
  ENDPROCEDURE
ENDCLASS
CLASS Car
  PUBLIC CarEngine : Engine
  PUBLIC PROCEDURE NEW(HP : INTEGER)
    CarEngine ← NEW Engine(HP)
  ENDPROCEDURE
ENDCLASS
DECLARE C : Car
C ← NEW Car(300)
OUTPUT C.CarEngine.Horsepower
`);
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
    expect(host.outputs).toEqual(['300']);
  });

  it('formats OBJECT values as ClassName{Field: value, ...} (debugger / OUTPUT display)', async () => {
    const { result, host } = await run(`
CLASS Point
  PUBLIC X : INTEGER
  PUBLIC Y : INTEGER
  PUBLIC PROCEDURE NEW(GivenX : INTEGER, GivenY : INTEGER)
    X ← GivenX
    Y ← GivenY
  ENDPROCEDURE
ENDCLASS
DECLARE P : Point
P ← NEW Point(3, 4)
OUTPUT P
`);
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
    expect(host.outputs).toEqual(['Point{X: 3, Y: 4}']);
  });

  it('default-initialises a DECLAREd object without invoking the constructor', async () => {
    const { result, host } = await run(`
CLASS Empty
ENDCLASS
DECLARE E : Empty
E ← NEW Empty()
OUTPUT "ok"
`);
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
    expect(host.outputs).toEqual(['ok']);
  });

  it('passes objects to PROCEDUREs by reference (mutating the param mutates the caller)', async () => {
    const { result, host } = await run(`
CLASS Box
  PUBLIC Value : INTEGER
  PUBLIC PROCEDURE NEW(V : INTEGER)
    Value ← V
  ENDPROCEDURE
ENDCLASS
PROCEDURE Bump(B : Box)
  B.Value ← B.Value + 1
ENDPROCEDURE
DECLARE Original : Box
Original ← NEW Box(10)
CALL Bump(Original)
OUTPUT Original.Value
`);
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
    expect(host.outputs).toEqual(['11']);
  });
});
