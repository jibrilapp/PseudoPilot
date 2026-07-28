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

function run(
  source: string,
  inputs: string[] = [],
  opts: { maxSteps?: number; maxCallDepth?: number; seed?: number } = {},
) {
  const host = new MemoryHost(inputs);
  const result = runPseudocode(source, {
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
    expect(PACKAGE_VERSION).toBe('0.1.0');
  });

  it('implements every CORE_BUILTIN', () => {
    const names = new Set(builtinImplNames());
    for (const b of CORE_BUILTINS) {
      expect(names.has(b.name)).toBe(true);
    }
  });
});

describe('assignments, DECLARE, CONSTANT', () => {
  it('assigns and outputs scalars', () => {
    const { result, host } = run(`
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

  it('supports CONSTANT and rejects mutation', () => {
    const ok = run(`
CONSTANT Max = 5
OUTPUT Max
`);
    expect(ok.result.ok).toBe(true);
    expect(ok.host.outputs).toEqual(['5']);

    const bad = run(`
CONSTANT Max = 5
Max ← 6
`);
    expect(bad.result.ok).toBe(false);
    expect(bad.result.diagnostics.some((d) => d.code === 'C_ASSIGN_TO_CONSTANT' || d.code === 'R_ASSIGN_CONSTANT')).toBe(true);
  });
});

describe('arithmetic and logic', () => {
  it('evaluates arithmetic, DIV, MOD, /', () => {
    const { result, host } = run(`
OUTPUT 7 + 3
OUTPUT 7 DIV 2
OUTPUT 7 MOD 2
OUTPUT 7 / 2
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['10', '3', '1', '3.5']);
  });

  it('errors on division by zero', () => {
    const { result } = run(`OUTPUT 1 / 0`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('R_DIV_ZERO');
  });

  it('evaluates boolean and comparisons', () => {
    const { host } = run(`
OUTPUT TRUE AND FALSE
OUTPUT TRUE OR FALSE
OUTPUT NOT FALSE
OUTPUT 3 < 5
OUTPUT "a" = "a"
`);
    expect(host.outputs).toEqual(['FALSE', 'TRUE', 'TRUE', 'TRUE', 'TRUE']);
  });

  it('concatenates with &', () => {
    const { host } = run(`OUTPUT "Hello" & " " & "World"`);
    expect(host.outputs).toEqual(['Hello World']);
  });
});

describe('INPUT / OUTPUT', () => {
  it('reads typed INPUT', () => {
    const { result, host } = run(
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

  it('rejects invalid INTEGER INPUT', () => {
    const { result } = run(
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
  it('runs IF / ELSE IF / ELSE', () => {
    const { host } = run(`
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

  it('runs WHILE', () => {
    const { host } = run(`
DECLARE I : INTEGER
I ← 1
WHILE I <= 3
  OUTPUT I
  I ← I + 1
ENDWHILE
`);
    expect(host.outputs).toEqual(['1', '2', '3']);
  });

  it('runs REPEAT UNTIL', () => {
    const { host } = run(`
DECLARE I : INTEGER
I ← 1
REPEAT
  OUTPUT I
  I ← I + 1
UNTIL I > 3
`);
    expect(host.outputs).toEqual(['1', '2', '3']);
  });

  it('runs FOR with STEP', () => {
    const { host } = run(`
FOR I ← 1 TO 5 STEP 2
  OUTPUT I
NEXT I
`);
    expect(host.outputs).toEqual(['1', '3', '5']);
  });

  it('runs nested FOR', () => {
    const { host } = run(`
FOR I ← 1 TO 2
  FOR J ← 1 TO 2
    OUTPUT I * 10 + J
  NEXT J
NEXT I
`);
    expect(host.outputs).toEqual(['11', '12', '21', '22']);
  });

  it('runs CASE with OTHERWISE', () => {
    const { host } = run(`
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

  it('runs CASE ranges', () => {
    const { host } = run(`
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
  it('allocates 1-based arrays and indexes', () => {
    const { host } = run(`
DECLARE A : ARRAY[1:3] OF INTEGER
A[1] ← 10
A[2] ← 20
A[3] ← 30
OUTPUT A[1] + A[2] + A[3]
`);
    expect(host.outputs).toEqual(['60']);
  });

  it('supports 2D arrays', () => {
    const { host } = run(`
DECLARE G : ARRAY[1:2, 1:2] OF INTEGER
G[1,1] ← 1
G[1,2] ← 2
G[2,1] ← 3
G[2,2] ← 4
OUTPUT G[2,1]
`);
    expect(host.outputs).toEqual(['3']);
  });

  it('errors on out-of-bounds index', () => {
    const { result } = run(`
DECLARE A : ARRAY[1:2] OF INTEGER
OUTPUT A[3]
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('R_ARRAY_BOUNDS');
  });
});

describe('procedures and functions', () => {
  it('calls PROCEDURE with parameters', () => {
    const { host } = run(`
PROCEDURE Greet(Name : STRING)
  OUTPUT "Hi " & Name
ENDPROCEDURE
CALL Greet("Ada")
`);
    expect(host.outputs).toEqual(['Hi Ada']);
  });

  it('calls FUNCTION and returns', () => {
    const { host } = run(`
FUNCTION Add(A : INTEGER, B : INTEGER) RETURNS INTEGER
  RETURN A + B
ENDFUNCTION
OUTPUT Add(2, 3)
`);
    expect(host.outputs).toEqual(['5']);
  });

  it('supports recursion', () => {
    const { host } = run(`
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

  it('reads globals from routines', () => {
    const { host } = run(`
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

  it('guards stack overflow', () => {
    const { result } = run(
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
  it('executes string and numeric builtins', () => {
    const { host } = run(`
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

  it('RIGHT with 0 yields empty string', () => {
    const { host } = run(`OUTPUT RIGHT("abc", 0)`);
    expect(host.outputs).toEqual(['']);
  });

  it('RAND returns REAL in [0, x)', () => {
    const { host } = run(`OUTPUT RAND(10)`, [], { seed: 42 });
    expect(host.outputs).toHaveLength(1);
    const v = Number(host.outputs[0]);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(10);
  });
});

describe('runtime limits and errors', () => {
  it('stops infinite WHILE via step limit', () => {
    const { result } = run(
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

  it('rejects missing routine at runtime when check skipped', () => {
    const host = new MemoryHost();
    const result = runPseudocode(`CALL Missing()`, {
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
  it('joins multi-value OUTPUT with spaces (SPEC §13.15)', () => {
    const { host } = run(`OUTPUT 1, 2, 3`);
    expect(host.outputs).toEqual(['1 2 3']);
  });

  it('enforces step limit on empty WHILE TRUE', () => {
    const { result } = run(
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

  it('short-circuits AND / OR side effects', () => {
    const andCase = run(`
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

    const orCase = run(`
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

  it('indexes arrays with non-1 lower bounds', () => {
    const { host } = run(`
DECLARE A : ARRAY[0:2] OF INTEGER
A[0] ← 7
A[2] ← 9
OUTPUT A[0]
OUTPUT A[2]
`);
    expect(host.outputs).toEqual(['7', '9']);
  });

  it('rejects whole-array assign when bounds differ but length matches', () => {
    const { result } = run(`
DECLARE A : ARRAY[1:3] OF INTEGER
DECLARE B : ARRAY[0:2] OF INTEGER
A[1] ← 1
B ← A
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'R_TYPE')).toBe(true);
  });

  it('maps exhausted MemoryHost INPUT to R_INPUT', () => {
    const { result } = run(
      `
DECLARE N : INTEGER
INPUT N
`,
      [],
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('R_INPUT');
  });

  it('calls onExitFrame when a routine errors', () => {
    const exits: string[] = [];
    const host = new MemoryHost();
    const result = runPseudocode(
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

  it('isolates recursive locals across frames', () => {
    const { host } = run(`
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
  it('sums array with FOR', () => {
    const { host } = run(`
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

  it('validates password loop with INPUT', () => {
    const { host } = run(
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

  it('exposes globals for variables panel', () => {
    const { result } = run(`
DECLARE Count : INTEGER
Count ← 7
`);
    expect(result.ok).toBe(true);
    const count = result.globals.find((g) => g.name === 'Count');
    expect(count?.value).toBe('7');
  });
});
