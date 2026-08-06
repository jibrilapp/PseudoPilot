import { describe, expect, it } from 'vitest';
import { MemoryHost, runPseudocode } from './index.js';

async function run(source: string, inputs: string[] = []) {
  const host = new MemoryHost(inputs);
  const result = await runPseudocode(source, { host });
  return { result, host };
}

describe('BYVAL / BYREF runtime (Cambridge §8.3)', () => {
  it('SWAP mutates caller variables via sticky BYREF', async () => {
    const { result, host } = await run(`
PROCEDURE SWAP(BYREF X : INTEGER, Y : INTEGER)
    DECLARE Temp : INTEGER
    Temp ← X
    X ← Y
    Y ← Temp
ENDPROCEDURE
DECLARE A, B : INTEGER
A ← 1
B ← 2
CALL SWAP(A, B)
OUTPUT A
OUTPUT B
`);
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
    expect(host.outputs).toEqual(['2', '1']);
  });

  it('BYVAL does not mutate caller', async () => {
    const { result, host } = await run(`
PROCEDURE Inc(BYVAL N : INTEGER)
    N ← N + 1
ENDPROCEDURE
DECLARE A : INTEGER
A ← 5
CALL Inc(A)
OUTPUT A
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['5']);
  });

  it('default (omitted) mode is BYVAL', async () => {
    const { result, host } = await run(`
PROCEDURE Inc(N : INTEGER)
    N ← N + 1
ENDPROCEDURE
DECLARE A : INTEGER
A ← 5
CALL Inc(A)
OUTPUT A
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['5']);
  });

  it('BYREF updates array elements and record fields', async () => {
    const { result, host } = await run(`
TYPE Point
    DECLARE X : INTEGER
ENDTYPE
DECLARE Scores : ARRAY[1:2] OF INTEGER
DECLARE P : Point
PROCEDURE Inc(BYREF N : INTEGER)
    N ← N + 1
ENDPROCEDURE
Scores[1] ← 10
P.X ← 20
CALL Inc(Scores[1])
CALL Inc(P.X)
OUTPUT Scores[1]
OUTPUT P.X
`);
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
    expect(host.outputs).toEqual(['11', '21']);
  });

  it('BYREF TYPE record aliases caller record', async () => {
    const { result, host } = await run(`
TYPE Point
    DECLARE X : INTEGER
ENDTYPE
PROCEDURE Move(BYREF P : Point)
    P.X ← P.X + 5
ENDPROCEDURE
DECLARE A : Point
A.X ← 1
CALL Move(A)
OUTPUT A.X
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['6']);
  });

  it('BYVAL TYPE record does not mutate caller', async () => {
    const { result, host } = await run(`
TYPE Point
    DECLARE X : INTEGER
ENDTYPE
PROCEDURE Move(BYVAL P : Point)
    P.X ← P.X + 5
ENDPROCEDURE
DECLARE A : Point
A.X ← 1
CALL Move(A)
OUTPUT A.X
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['1']);
  });

  it('nested BYREF calls and recursion update aliases', async () => {
    const { result, host } = await run(`
PROCEDURE AddOne(BYREF N : INTEGER)
    N ← N + 1
ENDPROCEDURE
PROCEDURE AddTwo(BYREF N : INTEGER)
    CALL AddOne(N)
    CALL AddOne(N)
ENDPROCEDURE
FUNCTION Fact(N : INTEGER) RETURNS INTEGER
    IF N <= 1 THEN
        RETURN 1
    ELSE
        RETURN N * Fact(N - 1)
    ENDIF
ENDFUNCTION
DECLARE A : INTEGER
A ← 0
CALL AddTwo(A)
OUTPUT A
OUTPUT Fact(4)
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['2', '24']);
  });

  it('debugger snapshot marks BYREF parameters', async () => {
    const frames: { name: string; byRef?: boolean }[] = [];
    const result = await runPseudocode(
      `
PROCEDURE Inc(BYREF N : INTEGER)
    N ← N + 1
ENDPROCEDURE
DECLARE A : INTEGER
A ← 1
CALL Inc(A)
`,
      {
        host: {
          output() {},
          async input() {
            return '';
          },
        },
        debugger: {
          onEnterFrame: (frame) => {
            if (frame.name === 'Inc') {
              for (const b of frame.env.snapshot().values()) {
                if (b.kind === 'parameter') {
                  frames.push({ name: b.name, byRef: b.byRef });
                }
              }
            }
          },
        },
      },
    );
    expect(result.ok).toBe(true);
    expect(frames).toContainEqual({ name: 'N', byRef: true });
  });
});
