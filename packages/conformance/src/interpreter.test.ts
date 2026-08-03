import { describe, expect, it } from 'vitest';
import {
  runPseudocode,
  MemoryHost,
  SeededRandom,
} from '@pseudopilot/interpreter';
import { CORPUS } from './corpus/index.js';
import { runOk } from './helpers.js';

describe('conformance / interpreter', () => {
  it('runs every runnable corpus entry with expected output', async () => {
    for (const entry of CORPUS) {
      if (entry.skipRun || !entry.expectOutput) continue;
      const result = await runOk(entry.source, entry.inputs ?? []);
      expect(result.host.outputs, entry.id).toEqual([...entry.expectOutput]);
    }
  });

  it('stress: nested loops', async () => {
    const src = `
DECLARE I, J, C : INTEGER
C ← 0
FOR I ← 1 TO 20
  FOR J ← 1 TO 20
    C ← C + 1
  NEXT J
NEXT I
OUTPUT C
`;
    const r = await runOk(src);
    expect(r.host.outputs).toEqual(['400']);
  });

  it('stress: large array fill', async () => {
    const src = `
DECLARE A : ARRAY[1:100] OF INTEGER
DECLARE I, Sum : INTEGER
Sum ← 0
FOR I ← 1 TO 100
  A[I] ← I
  Sum ← Sum + A[I]
NEXT I
OUTPUT Sum
`;
    const r = await runOk(src);
    expect(r.host.outputs).toEqual(['5050']);
  });

  it('stress: large string concat', async () => {
    const src = `
DECLARE S : STRING
DECLARE I : INTEGER
S ← ""
FOR I ← 1 TO 50
  S ← S & "x"
NEXT I
OUTPUT LENGTH(S)
`;
    const r = await runOk(src);
    expect(r.host.outputs).toEqual(['50']);
  });

  it('stress: recursion depth within limit', async () => {
    const src = `
FUNCTION SumTo(N : INTEGER) RETURNS INTEGER
  IF N <= 0 THEN
    RETURN 0
  ELSE
    RETURN N + SumTo(N - 1)
  ENDIF
ENDFUNCTION
OUTPUT SumTo(50)
`;
    const r = await runOk(src, [], { maxCallDepth: 256 });
    expect(r.host.outputs).toEqual(['1275']);
  });

  it('enforces maxSteps', async () => {
    const host = new MemoryHost();
    const r = await runPseudocode(
      `
DECLARE I : INTEGER
I ← 0
WHILE TRUE
  I ← I + 1
ENDWHILE
`,
      { host, maxSteps: 100 },
    );
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => d.code === 'R_STEP_LIMIT')).toBe(true);
  });

  it('enforces maxCallDepth', async () => {
    const host = new MemoryHost();
    const r = await runPseudocode(
      `
FUNCTION Boom(N : INTEGER) RETURNS INTEGER
  RETURN Boom(N + 1)
ENDFUNCTION
OUTPUT Boom(1)
`,
      { host, maxCallDepth: 8 },
    );
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => d.code === 'R_STACK_OVERFLOW')).toBe(true);
  });

  it('handles INPUT exhaustion / runtime errors without crash', async () => {
    const host = new MemoryHost([]); // no inputs
    const r = await runPseudocode(
      `
DECLARE X : STRING
INPUT X
OUTPUT X
`,
      { host, random: new SeededRandom(1) },
    );
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => d.code === 'R_INPUT')).toBe(true);
  });

  it('file operations work with VFS', async () => {
    const entry = CORPUS.find((e) => e.id === 'file-io')!;
    const r = await runOk(entry.source);
    expect(r.host.outputs).toEqual(['line1']);
  });
});
