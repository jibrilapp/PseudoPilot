import { describe, expect, it } from 'vitest';
import { CORE_BUILTINS } from '@pseudopilot/language-core';
import {
  PACKAGE_NAME,
  PACKAGE_VERSION,
  MemoryHost,
  SeededRandom,
  runPseudocode,
  builtinImplNames,
} from './index.js';

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

describe('interpreter package', () => {
  it('exports identity', () => {
    expect(PACKAGE_NAME).toBe('@pseudopilot/interpreter');
    expect(PACKAGE_VERSION).toBe('1.0.0-beta.0');
  });

  it('implements every CORE_BUILTIN', () => {
    const names = new Set(builtinImplNames());
    for (const b of CORE_BUILTINS) {
      expect(names.has(b.name)).toBe(true);
    }
  });
});

describe('assignments, DECLARE, CONSTANT', () => {
  it('assigns and outputs scalars', async () => {    const { result, host } = await run(`
DECLARE A : INTEGER
DECLARE B : REAL
DECLARE S : STRING
DECLARE F : BOOLEAN
A ← 10
B ← 2.5
S ← "hi"
F ← TRUE
OUTPUT A
OUTPUT B
OUTPUT S
OUTPUT F
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['10', '2.5', 'hi', 'TRUE']);
  });

  it('supports CONSTANT and rejects mutation', async () => {    const ok = await run(`
CONSTANT Max = 5
OUTPUT Max
`);
    expect(ok.result.ok).toBe(true);
    expect(ok.host.outputs).toEqual(['5']);

    const bad = await run(`
CONSTANT Max = 5
Max ← 6
`);
    expect(bad.result.ok).toBe(false);
    expect(bad.result.diagnostics.some((d) => d.code === 'C_ASSIGN_TO_CONSTANT' || d.code === 'R_ASSIGN_CONSTANT')).toBe(true);
  });
});

describe('arithmetic and logic', () => {
  it('evaluates arithmetic, DIV, MOD, /', async () => {    const { result, host } = await run(`
OUTPUT 7 + 3
OUTPUT 7 DIV 2
OUTPUT 7 MOD 2
OUTPUT 7 / 2
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['10', '3', '1', '3.5']);
  });

  it('DIV/MOD on negatives truncates toward zero (D4)', async () => {
    // PseudoPilot policy: trunc toward zero (JS Math.trunc), not Python floor.
    // (-7) DIV 3 → -2; (-7) MOD 3 → -1. Translator Python // / % differ.
    const { result, host } = await run(`
OUTPUT (-7) DIV 3
OUTPUT (-7) MOD 3
OUTPUT 7 DIV (-3)
OUTPUT 7 MOD (-3)
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['-2', '-1', '-2', '1']);
  });

  it('errors on division by zero', async () => {    const { result } = await run(`OUTPUT 1 / 0`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('R_DIV_ZERO');
  });

  it('evaluates boolean and comparisons', async () => {    const { host } = await run(`
OUTPUT TRUE AND FALSE
OUTPUT TRUE OR FALSE
OUTPUT NOT FALSE
OUTPUT 3 < 5
OUTPUT "a" = "a"
`);
    expect(host.outputs).toEqual(['FALSE', 'TRUE', 'TRUE', 'TRUE', 'TRUE']);
  });

  it('concatenates with &', async () => {    const { host } = await run(`OUTPUT "Hello" & " " & "World"`);
    expect(host.outputs).toEqual(['Hello World']);
  });
});

describe('INPUT / OUTPUT', () => {
  it('reads typed INPUT', async () => {    const { result, host } = await run(
      `
DECLARE N : INTEGER
DECLARE S : STRING
INPUT N
INPUT S
OUTPUT N
OUTPUT S
`,
      ['42', 'Cambridge'],
    );
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['42', 'Cambridge']);
  });

  it('rejects invalid INTEGER INPUT', async () => {    const { result } = await run(
      `
DECLARE N : INTEGER
INPUT N
`,
      ['abc'],
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('R_INPUT');
  });
});

describe('control flow', () => {
  it('runs IF / ELSE IF / ELSE', async () => {    const { host } = await run(`
DECLARE X : INTEGER
X ← 2
IF X = 1 THEN
  OUTPUT "one"
ELSE IF X = 2 THEN
  OUTPUT "two"
ELSE
  OUTPUT "other"
ENDIF
`);
    expect(host.outputs).toEqual(['two']);
  });

  it('runs WHILE', async () => {    const { host } = await run(`
DECLARE I : INTEGER
I ← 1
WHILE I <= 3
  OUTPUT I
  I ← I + 1
ENDWHILE
`);
    expect(host.outputs).toEqual(['1', '2', '3']);
  });

  it('runs REPEAT UNTIL', async () => {    const { host } = await run(`
DECLARE I : INTEGER
I ← 1
REPEAT
  OUTPUT I
  I ← I + 1
UNTIL I > 3
`);
    expect(host.outputs).toEqual(['1', '2', '3']);
  });

  it('runs FOR with STEP', async () => {    const { host } = await run(`
FOR I ← 1 TO 5 STEP 2
  OUTPUT I
NEXT I
`);
    expect(host.outputs).toEqual(['1', '3', '5']);
  });

  it('runs nested FOR', async () => {    const { host } = await run(`
FOR I ← 1 TO 2
  FOR J ← 1 TO 2
    OUTPUT I * 10 + J
  NEXT J
NEXT I
`);
    expect(host.outputs).toEqual(['11', '12', '21', '22']);
  });

  it('runs CASE with OTHERWISE', async () => {    const { host } = await run(`
DECLARE G : CHAR
G ← 'B'
CASE OF G
  'A': OUTPUT "Distinction"
  'B': OUTPUT "Merit"
  OTHERWISE OUTPUT "Pass"
ENDCASE
`);
    expect(host.outputs).toEqual(['Merit']);
  });

  it('runs CASE ranges', async () => {    const { host } = await run(`
DECLARE N : INTEGER
N ← 15
CASE OF N
  1 TO 10: OUTPUT "low"
  11 TO 20: OUTPUT "mid"
  OTHERWISE OUTPUT "high"
ENDCASE
`);
    expect(host.outputs).toEqual(['mid']);
  });
});

describe('arrays', () => {
  it('allocates 1-based arrays and indexes', async () => {    const { host } = await run(`
DECLARE A : ARRAY[1:3] OF INTEGER
A[1] ← 10
A[2] ← 20
A[3] ← 30
OUTPUT A[1] + A[2] + A[3]
`);
    expect(host.outputs).toEqual(['60']);
  });

  it('supports 2D arrays', async () => {    const { host } = await run(`
DECLARE G : ARRAY[1:2, 1:2] OF INTEGER
G[1,1] ← 1
G[1,2] ← 2
G[2,1] ← 3
G[2,2] ← 4
OUTPUT G[2,1]
`);
    expect(host.outputs).toEqual(['3']);
  });

  it('errors on out-of-bounds index', async () => {    const { result } = await run(`
DECLARE A : ARRAY[1:2] OF INTEGER
OUTPUT A[3]
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('R_ARRAY_BOUNDS');
  });
});

describe('procedures and functions', () => {
  it('calls PROCEDURE with parameters', async () => {    const { host } = await run(`
PROCEDURE Greet(Name : STRING)
  OUTPUT "Hi " & Name
ENDPROCEDURE
CALL Greet("Ada")
`);
    expect(host.outputs).toEqual(['Hi Ada']);
  });

  it('calls FUNCTION and returns', async () => {    const { host } = await run(`
FUNCTION Add(A : INTEGER, B : INTEGER) RETURNS INTEGER
  RETURN A + B
ENDFUNCTION
OUTPUT Add(2, 3)
`);
    expect(host.outputs).toEqual(['5']);
  });

  it('executes FUNCTIONS with Cambridge grouped parameters', async () => {
    const { host } = await run(`
FUNCTION Mix(a, b : INTEGER, c : INTEGER) RETURNS INTEGER
  RETURN a + b + c
ENDFUNCTION
OUTPUT Mix(1, 2, 3)
`);
    expect(host.outputs).toEqual(['6']);
  });

  it('executes PROCEDURES with grouped STRING parameters', async () => {
    const { host } = await run(`
PROCEDURE Show(x, y : STRING)
  OUTPUT x & y
ENDPROCEDURE
CALL Show("Hi", "there")
`);
    expect(host.outputs).toEqual(['Hithere']);
  });

  it('supports recursion', async () => {    const { host } = await run(`
FUNCTION Fact(N : INTEGER) RETURNS INTEGER
  IF N <= 1 THEN
    RETURN 1
  ENDIF
  RETURN N * Fact(N - 1)
ENDFUNCTION
OUTPUT Fact(5)
`);
    expect(host.outputs).toEqual(['120']);
  });

  it('reads globals from routines', async () => {    const { host } = await run(`
DECLARE Total : INTEGER
PROCEDURE Inc()
  Total ← Total + 1
ENDPROCEDURE
Total ← 0
CALL Inc()
CALL Inc()
OUTPUT Total
`);
    expect(host.outputs).toEqual(['2']);
  });

  it('guards stack overflow', async () => {    const { result } = await run(
      `
FUNCTION Boom(N : INTEGER) RETURNS INTEGER
  RETURN Boom(N + 1)
ENDFUNCTION
OUTPUT Boom(1)
`,
      [],
      { maxCallDepth: 8 },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('R_STACK_OVERFLOW');
  });
});

describe('builtins', () => {
  it('executes string and numeric builtins', async () => {    const { host } = await run(`
OUTPUT LENGTH("abc")
OUTPUT LEFT("abcdef", 3)
OUTPUT RIGHT("abcdef", 2)
OUTPUT MID("abcdef", 2, 3)
OUTPUT LCASE("AbC")
OUTPUT UCASE("AbC")
OUTPUT INT(4.9)
`);
    expect(host.outputs).toEqual([
      '3',
      'abc',
      'ef',
      'bcd',
      'abc',
      'ABC',
      '4',
    ]);
  });

  it('RIGHT with 0 yields empty string', async () => {    const { host } = await run(`OUTPUT RIGHT("abc", 0)`);
    expect(host.outputs).toEqual(['']);
  });

  it('RAND returns REAL in [0, x)', async () => {    const { host } = await run(`OUTPUT RAND(10)`, [], { seed: 42 });
    expect(host.outputs).toHaveLength(1);
    const v = Number(host.outputs[0]);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(10);
  });

  it('executes ASC / CHR / IS_NUM (Paper 2 insert)', async () => {
    const { host } = await run(`
OUTPUT ASC('A')
OUTPUT CHR(66)
OUTPUT IS_NUM("-12.36")
OUTPUT IS_NUM("abc")
OUTPUT IS_NUM("")
`);
    expect(host.outputs).toEqual(['65', 'B', 'TRUE', 'FALSE', 'FALSE']);
  });

  it('rejects CHR outside Unicode range', async () => {
    const { result } = await run(`OUTPUT CHR(-1)`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'R_BUILTIN')).toBe(true);
  });
});

describe('runtime limits and errors', () => {
  it('stops infinite WHILE via step limit', async () => {    const { result } = await run(
      `
DECLARE I : INTEGER
I ← 1
WHILE TRUE
  I ← I + 1
ENDWHILE
`,
      [],
      { maxSteps: 50 },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('R_STEP_LIMIT');
  });

  it('rejects missing routine at runtime when check skipped', async () => {    const host = new MemoryHost();
    const result = await runPseudocode(`CALL Missing()`, {
      host,
      semanticCheck: false,
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'R_UNDECL_ROUTINE')).toBe(
      true,
    );
  });
});

describe('review regressions', () => {
  it('joins multi-value OUTPUT with spaces (SPEC §13.15)', async () => {    const { host } = await run(`OUTPUT 1, 2, 3`);
    expect(host.outputs).toEqual(['1 2 3']);
  });

  it('enforces step limit on empty WHILE TRUE', async () => {    const { result } = await run(
      `
WHILE TRUE
ENDWHILE
`,
      [],
      { maxSteps: 20 },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('R_STEP_LIMIT');
  });

  it('short-circuits AND / OR side effects', async () => {    const andCase = await run(`
DECLARE N : INTEGER
N ← 0
FUNCTION Boom() RETURNS BOOLEAN
  N ← N + 1
  RETURN TRUE
ENDFUNCTION
OUTPUT FALSE AND Boom()
OUTPUT N
`);
    expect(andCase.host.outputs).toEqual(['FALSE', '0']);

    const orCase = await run(`
DECLARE N : INTEGER
N ← 0
FUNCTION Boom() RETURNS BOOLEAN
  N ← N + 1
  RETURN FALSE
ENDFUNCTION
OUTPUT TRUE OR Boom()
OUTPUT N
`);
    expect(orCase.host.outputs).toEqual(['TRUE', '0']);
  });

  it('indexes arrays with non-1 lower bounds', async () => {    const { host } = await run(`
DECLARE A : ARRAY[0:2] OF INTEGER
A[0] ← 7
A[2] ← 9
OUTPUT A[0]
OUTPUT A[2]
`);
    expect(host.outputs).toEqual(['7', '9']);
  });

  it('rejects whole-array assign when bounds differ but length matches', async () => {
    // D5: checker rejects mismatched literal bounds (`C_ASSIGN_TYPE`); runtime
    // still enforces shape via `R_TYPE` if semanticCheck is skipped.
    const { result } = await run(`
DECLARE A : ARRAY[1:3] OF INTEGER
DECLARE B : ARRAY[0:2] OF INTEGER
A[1] ← 1
B ← A
`);
    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some(
        (d) => d.code === 'C_ASSIGN_TYPE' || d.code === 'R_TYPE',
      ),
    ).toBe(true);
  });

  it('maps exhausted MemoryHost INPUT to R_INPUT', async () => {    const { result } = await run(
      `
DECLARE N : INTEGER
INPUT N
`,
      [],
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('R_INPUT');
  });

  it('calls onExitFrame when a routine errors', async () => {    const exits: string[] = [];
    const host = new MemoryHost();
    const result = await runPseudocode(
      `
PROCEDURE Bad()
  OUTPUT 1 / 0
ENDPROCEDURE
CALL Bad()
`,
      {
        host,
        debugger: {
          onExitFrame: (frame) => {
            exits.push(frame.name);
          },
        },
      },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('R_DIV_ZERO');
    expect(exits).toContain('Bad');
  });

  it('isolates recursive locals across frames', async () => {    const { host } = await run(`
FUNCTION Weave(N : INTEGER) RETURNS INTEGER
  DECLARE Local : INTEGER
  Local ← N
  IF N = 0 THEN
    RETURN Local
  ENDIF
  RETURN Local + Weave(N - 1)
ENDFUNCTION
OUTPUT Weave(3)
`);
    expect(host.outputs).toEqual(['6']);
  });
});

describe('realistic Cambridge-style programs', () => {
  it('sums array with FOR', async () => {    const { host } = await run(`
DECLARE Scores : ARRAY[1:5] OF INTEGER
DECLARE Sum : INTEGER
DECLARE I : INTEGER
Scores[1] ← 10
Scores[2] ← 20
Scores[3] ← 30
Scores[4] ← 40
Scores[5] ← 50
Sum ← 0
FOR I ← 1 TO 5
  Sum ← Sum + Scores[I]
NEXT I
OUTPUT Sum
`);
    expect(host.outputs).toEqual(['150']);
  });

  it('validates password loop with INPUT', async () => {    const { host } = await run(
      `
DECLARE Attempt : STRING
DECLARE Ok : BOOLEAN
CONSTANT Password = "secret"
Ok ← FALSE
REPEAT
  INPUT Attempt
  IF Attempt = Password THEN
    Ok ← TRUE
  ELSE
    OUTPUT "Wrong"
  ENDIF
UNTIL Ok = TRUE
OUTPUT "Welcome"
`,
      ['nope', 'secret'],
    );
    expect(host.outputs).toEqual(['Wrong', 'Welcome']);
  });

  it('exposes globals for variables panel', async () => {
    const { result } = await run(`
DECLARE Count : INTEGER
Count ← 7
`);
    expect(result.ok).toBe(true);
    const count = result.globals.find((g) => g.name === 'Count');
    expect(count?.value).toBe('7');
  });

  it('cancels via AbortSignal', async () => {
    const host = new MemoryHost();
    const abort = new AbortController();
    const pending = runPseudocode(
      `
WHILE TRUE
ENDWHILE
`,
      { host, signal: abort.signal, maxSteps: 1_000_000 },
    );
    await new Promise((r) => setTimeout(r, 5));
    abort.abort();
    const result = await pending;
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'R_CANCELLED')).toBe(true);
  });

  it('awaits async onBeforeStatement suspend/resume', async () => {
    const host = new MemoryHost();
    let resolvePause: (() => void) | null = null;
    let paused = false;
    const pending = runPseudocode(
      `
OUTPUT 1
OUTPUT 2
`,
      {
        host,
        debugger: {
          onBeforeStatement: async ({ step }) => {
            if (step === 1) {
              paused = true;
              await new Promise<void>((r) => {
                resolvePause = r;
              });
            }
          },
        },
      },
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(paused).toBe(true);
    expect(host.outputs).toEqual([]);
    resolvePause!();
    const result = await pending;
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['1', '2']);
  });

  it('awaits async RuntimeHost INPUT', async () => {
    let resolveInput: ((v: string) => void) | null = null;
    const host = {
      outputs: [] as string[],
      writeOutput(line: string) {
        this.outputs.push(line);
      },
      readInput() {
        return new Promise<string>((resolve) => {
          resolveInput = resolve;
        });
      },
    };
    const pending = runPseudocode(
      `
DECLARE N : INTEGER
INPUT N
OUTPUT N
`,
      { host },
    );
    await new Promise((r) => setTimeout(r, 5));
    expect(resolveInput).not.toBeNull();
    resolveInput!('9');
    const result = await pending;
    expect(result.ok).toBe(true);
    expect(host.outputs).toContain('9');
  });
});

describe('DATE runtime', () => {
  it('formats DATE and runs Cambridge date builtins', async () => {
    const { host } = await run(`
DECLARE D : DATE
D ← SETDATE(9, 5, 2023)
OUTPUT D
OUTPUT DAY(D)
OUTPUT MONTH(D)
OUTPUT YEAR(D)
OUTPUT DAYINDEX(D)
`);
    expect(host.outputs).toEqual(['09/05/2023', '9', '5', '2023', '3']);
  });

  it('compares DATE chronologically', async () => {
    const { host } = await run(`
IF 01/01/2000 < 02/01/2000 THEN
  OUTPUT "date-ok"
ENDIF
`);
    expect(host.outputs).toEqual(['date-ok']);
  });

  it('exposes readable DATE values to debugger snapshots', async () => {
    const { formatValue, dateValue } = await import('./value.js');
    expect(formatValue(dateValue(4, 10, 2003))).toBe('04/10/2003');
  });
});
