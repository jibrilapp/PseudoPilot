import { describe, expect, it } from 'vitest';
import { MemoryHost, SeededRandom, runPseudocode } from './index.js';

async function run(
  source: string,
  inputs: string[] = [],
  opts: { maxSteps?: number; maxCallDepth?: number; seed?: number } = {},
) {
  const host = new MemoryHost(inputs);
  const result = await runPseudocode(source, {
    host,
    random: new SeededRandom(opts.seed ?? 1),
    ...(opts.maxSteps !== undefined ? { maxSteps: opts.maxSteps } : {}),
    ...(opts.maxCallDepth !== undefined
      ? { maxCallDepth: opts.maxCallDepth }
      : {}),
  });
  return { result, host };
}

describe('TYPE / ENDTYPE records', () => {
  it('assigns and outputs simple record fields', async () => {
    const { result, host } = await run(`
TYPE Student
  DECLARE Name : STRING
  DECLARE Age : INTEGER
ENDTYPE
DECLARE S : Student
S.Name ← "Alice"
S.Age ← 16
OUTPUT S.Name
OUTPUT S.Age
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['Alice', '16']);
  });

  it('supports nested records (Address inside Student)', async () => {
    const { result, host } = await run(`
TYPE Address
  DECLARE City : STRING
  DECLARE Zip : INTEGER
ENDTYPE
TYPE Student
  DECLARE Name : STRING
  DECLARE Home : Address
ENDTYPE
DECLARE S : Student
S.Name ← "Bob"
S.Home.City ← "Cambridge"
S.Home.Zip ← 12345
OUTPUT S.Home.City
OUTPUT S.Home.Zip
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['Cambridge', '12345']);
  });

  it('supports arrays of records with nested field access (Cohort[1].Home.City)', async () => {
    const { result, host } = await run(`
TYPE Address
  DECLARE City : STRING
ENDTYPE
TYPE Student
  DECLARE Name : STRING
  DECLARE Home : Address
ENDTYPE
DECLARE Cohort : ARRAY[1:2] OF Student
Cohort[1].Name ← "Ann"
Cohort[1].Home.City ← "London"
Cohort[2].Name ← "Zed"
Cohort[2].Home.City ← "Paris"
OUTPUT Cohort[1].Name
OUTPUT Cohort[1].Home.City
OUTPUT Cohort[2].Name
OUTPUT Cohort[2].Home.City
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['Ann', 'London', 'Zed', 'Paris']);
  });

  it('supports records containing arrays (Marks[2])', async () => {
    const { result, host } = await run(`
TYPE Student
  DECLARE Name : STRING
  DECLARE Marks : ARRAY[1:3] OF INTEGER
ENDTYPE
DECLARE S : Student
S.Marks[1] ← 70
S.Marks[2] ← 80
S.Marks[3] ← 90
OUTPUT S.Marks[2]
FOR I ← 1 TO 3
  OUTPUT S.Marks[I]
NEXT I
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['80', '70', '80', '90']);
  });

  it('does not alias arrays-of-records: each slot has its own Marks array', async () => {
    const { result, host } = await run(`
TYPE Student
  DECLARE Marks : ARRAY[1:2] OF INTEGER
ENDTYPE
DECLARE Cohort : ARRAY[1:2] OF Student
Cohort[1].Marks[1] ← 1
Cohort[2].Marks[1] ← 2
OUTPUT Cohort[1].Marks[1]
OUTPUT Cohort[2].Marks[1]
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['1', '2']);
  });

  it('passes records to PROCEDUREs by value (mutating the param does not mutate the caller)', async () => {
    const { result, host } = await run(`
TYPE Student
  DECLARE Age : INTEGER
ENDTYPE
PROCEDURE Birthday(S : Student)
  S.Age ← S.Age + 1
  OUTPUT S.Age
ENDPROCEDURE
DECLARE S : Student
S.Age ← 10
CALL Birthday(S)
OUTPUT S.Age
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['11', '10']);
  });

  it('supports FUNCTIONs returning a record', async () => {
    const { result, host } = await run(`
TYPE Point
  DECLARE X : INTEGER
  DECLARE Y : INTEGER
ENDTYPE
FUNCTION MakePoint(X : INTEGER, Y : INTEGER) RETURNS Point
  DECLARE P : Point
  P.X ← X
  P.Y ← Y
  RETURN P
ENDFUNCTION
DECLARE Origin : Point
Origin ← MakePoint(3, 4)
OUTPUT Origin.X
OUTPUT Origin.Y
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['3', '4']);
  });

  it('default-initialises fields (empty string, zero)', async () => {
    const { result, host } = await run(`
TYPE Student
  DECLARE Name : STRING
  DECLARE Age : INTEGER
  DECLARE Passed : BOOLEAN
ENDTYPE
DECLARE S : Student
OUTPUT "[" & S.Name & "]"
OUTPUT S.Age
OUTPUT S.Passed
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['[]', '0', 'FALSE']);
  });

  it('rejects INPUT on a whole record', async () => {
    const { result } = await run(
      `
TYPE Student
  DECLARE Name : STRING
ENDTYPE
DECLARE S : Student
INPUT S
`,
      ['Alice'],
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'R_INPUT')).toBe(true);
  });

  it('allows INPUT on a scalar record field', async () => {
    const { result, host } = await run(
      `
TYPE Student
  DECLARE Name : STRING
ENDTYPE
DECLARE S : Student
INPUT S.Name
OUTPUT S.Name
`,
      ['Alice'],
    );
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['Alice']);
  });

  it('assigns a whole record by value (copy, not alias)', async () => {
    const { result, host } = await run(`
TYPE Student
  DECLARE Age : INTEGER
ENDTYPE
DECLARE A, B : Student
A.Age ← 5
B ← A
B.Age ← 9
OUTPUT A.Age
OUTPUT B.Age
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['5', '9']);
  });

  it('deep-nests records and arrays without aliasing', async () => {
    const { result, host } = await run(`
TYPE Cell
  DECLARE V : INTEGER
ENDTYPE
TYPE Row
  DECLARE Cells : ARRAY[1:2] OF Cell
ENDTYPE
TYPE Grid
  DECLARE Rows : ARRAY[1:2] OF Row
ENDTYPE
DECLARE G, H : Grid
G.Rows[1].Cells[2].V ← 7
H ← G
H.Rows[1].Cells[2].V ← 9
OUTPUT G.Rows[1].Cells[2].V
OUTPUT H.Rows[1].Cells[2].V
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['7', '9']);
  });

  it('passes and returns large records by value', async () => {
    const { result, host } = await run(`
TYPE Big
  DECLARE A : INTEGER
  DECLARE B : INTEGER
  DECLARE C : INTEGER
  DECLARE D : INTEGER
  DECLARE E : INTEGER
ENDTYPE
PROCEDURE Bump(X : Big)
  X.A ← X.A + 1
ENDPROCEDURE
FUNCTION Clone(X : Big) RETURNS Big
  RETURN X
ENDFUNCTION
DECLARE S, T : Big
S.A ← 1
S.B ← 2
S.C ← 3
S.D ← 4
S.E ← 5
CALL Bump(S)
T ← Clone(S)
T.A ← 99
OUTPUT S.A
OUTPUT T.A
OUTPUT S.E
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['1', '99', '5']);
  });
});
