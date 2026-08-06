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

describe('enum / pointer / SET TYPE runtime', () => {
  it('declares, assigns, and outputs an enum member', async () => {
    const { result, host } = await run(`
TYPE Season = (Spring, Summer, Autumn, Winter)
DECLARE ThisSeason : Season
ThisSeason ← Spring
OUTPUT ThisSeason
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['Spring']);
  });

  it('writes through a pointer to update the pointee', async () => {
    const { result, host } = await run(`
TYPE TIntPointer = ^INTEGER
DECLARE X : INTEGER
DECLARE P : TIntPointer
X ← 10
P ← ^X
P^ ← 20
OUTPUT X
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['20']);
  });

  it('builds a SET via DEFINE and outputs elements', async () => {
    const { result, host } = await run(`
TYPE LetterSet = SET OF CHAR
DEFINE Vowels ('A','E','I','O','U'): LetterSet
OUTPUT Vowels
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual([`{'A', 'E', 'I', 'O', 'U'}`]);
  });

  it('supports enum ordinal +1 via pointer deref', async () => {
    const { result, host } = await run(`
TYPE Season = (Spring, Summer, Autumn, Winter)
TYPE TSeasonPointer = ^Season
DECLARE ThisSeason : Season
DECLARE NextSeason : Season
DECLARE MyPointer : TSeasonPointer
ThisSeason ← Spring
MyPointer ← ^ThisSeason
NextSeason ← MyPointer^ + 1
OUTPUT NextSeason
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['Summer']);
  });

  it('defaults enum to first member, pointer to NIL, set to empty', async () => {
    const { result, host } = await run(`
TYPE Colour = (Red, Green, Blue)
TYPE TIntPtr = ^INTEGER
TYPE Digits = SET OF INTEGER
DECLARE C : Colour
DECLARE P : TIntPtr
DECLARE S : Digits
OUTPUT C
OUTPUT P
OUTPUT S
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['Red', 'NIL', '{}']);
  });

  it('compares enums by ordinal', async () => {
    const { result, host } = await run(`
TYPE Colour = (Red, Green, Blue)
OUTPUT Red < Green
OUTPUT Blue = Blue
OUTPUT Green <> Red
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['TRUE', 'TRUE', 'TRUE']);
  });

  it('errors on nil deref and enum ordinal out of range', async () => {
    const nil = await run(`
TYPE TIntPtr = ^INTEGER
DECLARE P : TIntPtr
OUTPUT P^
`);
    expect(nil.result.ok).toBe(false);
    expect(nil.result.diagnostics[0]?.code).toBe('R_NULL_POINTER');

    const range = await run(`
TYPE Season = (Spring, Summer)
DECLARE S : Season
S ← Summer + 1
`);
    expect(range.result.ok).toBe(false);
    expect(range.result.diagnostics[0]?.code).toBe('R_ENUM_RANGE');
  });

  it('still runs FOR with NEXT binder (nextVariable ignored at runtime)', async () => {
    const { result, host } = await run(`
DECLARE Sum : INTEGER
Sum ← 0
FOR I ← 1 TO 3
  Sum ← Sum + I
NEXT I
OUTPUT Sum
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['6']);
  });
});
