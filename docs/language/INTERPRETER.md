# Cambridge Interpreter

**Package:** `@pseudopilot/interpreter` `0.4.0`  
**Status:** Core AST execution + async RuntimeHost + AbortSignal + **text-file VFS** + debugger hooks (IDE wired)

---

## 1. Architecture decision: execute AST (not translator IR)

```
Lexer → Parser → AST → Semantic Checker → Interpreter
                         ↘
                          IR → Translator (independent)
```

| Option | Verdict |
| --- | --- |
| **AST tree-walk** | **Chosen** |
| Translator IR | Rejected for V1 runtime |

**Why AST**

1. Every AST node has a `SourceSpan` — required for breakpoints, stepping, and diagnostics. IR has none.
2. AST preserves Cambridge semantics (1-based arrays, `CHAR` vs `STRING`, `DIV`/`MOD`, `&`, `EOF`/`OPENFILE`).
3. IR lives inside `@pseudopilot/translator` and is Python-oriented; executing it would couple the runtime to translation.
4. Checker already validates the AST; the interpreter reuses that gate without re-deriving types.
5. ADRs require a single TypeScript language core usable in browser and server — AST walk fits both.

IR remains the **translation** IR only (ADR 0006). A future execution IR would need spans, array layout, and a clear semantic contract first.

---

## 2. Execution model

`runPseudocode(source, { host })`:

1. `parse(source)` → AST  
2. `check(ast)` (default on) → refuse run if not `ok`  
3. Tree-walk `Interpreter.interpret(ast)`

### Runtime components

| Component | Role |
| --- | --- |
| `RuntimeHost` | Pluggable `readInput` / `writeOutput` (web, tests, CLI) |
| `RuntimeValue` | INTEGER / REAL / BOOLEAN / STRING / CHAR / ARRAY |
| `Environment` | Case-insensitive bindings; parent chain for globals |
| `StackFrame` / `CallStack` | Global + procedure/function frames |
| `executeBuiltin` | Registry-driven Core builtins |
| `DebuggerHooks` | Optional `onBeforeStatement` / frame enter-exit (UI later) |

### Scope model

- **Global** frame owns top-level `DECLARE` / `CONSTANT`.
- **Routine** frames nest under global (`new Environment(global)`).
- Locals/parameters shadow globals; Cambridge case-insensitive keys via checker `identKey`.
- Control-flow blocks do **not** create scopes (matches checker).

### Call stack

- Procedures/functions push frames; `RETURN` uses `ReturnSignal`.
- Recursion supported; `maxCallDepth` (default 256) → `R_STACK_OVERFLOW`.
- Infinite loops → `maxSteps` (default 1e6) → `R_STEP_LIMIT`.

### Arrays

- Inclusive Cambridge bounds evaluated at `DECLARE`.
- Dense row-major storage; runtime bounds checks (`R_ARRAY_BOUNDS`).

### Builtins

Reuse `CORE_BUILTINS` from language-core. Runtime strategies in `builtins.ts` (not a call-site mega-switch). `RIGHT(..., 0)` → `""`. `MID` is 1-based. `RAND` uses injectable `RandomSource`.

### OUTPUT

Multi-value `OUTPUT a, b, c` joins with a **space** separator (SPEC §13.15).

### Boolean short-circuit

`AND` / `OR` evaluate the right-hand operand only when needed (side-effect safe).

---

## 3. INPUT / OUTPUT

```ts
interface RuntimeHost {
  readInput(prompt?: string): string | Promise<string>;
  writeOutput(line: string): void | Promise<void>;
}
```

V1+ interpreter **awaits** host I/O. Sync hosts (`MemoryHost`) still work. Browser INPUT should return a `Promise` resolved when the student submits a console line.

`INPUT` parses according to the target’s declared type (`R_INPUT` on failure, including exhausted `MemoryHost` buffers).

`AbortSignal` (`RunOptions.signal`) cooperatively cancels at statement ticks (`R_CANCELLED`).

Cancellation requires **macrotask** yields (every 256 steps via `setTimeout(0)`). Microtask-only yields (`Promise.resolve`) keep the event loop busy, so IDE Stop clicks and timer-based `abort()` never run until the step limit.

---

## 4. Debugger preparation

Already present:

- Statement-level async `onBeforeStatement({ span, frame, step, depth })` — may `await` a resume gate
- Frame enter/exit hooks (including `onExitFrame` after routine **errors**)
- `InterpretResult.callStack` + `globals` snapshots for a variables panel
- Per-iteration step accounting on `WHILE` / `REPEAT` / `FOR` (empty infinite loops cannot bypass `maxSteps`)
- IDE debugger (`apps/web/lib/debugger`) uses hooks for breakpoints + stepping

Legacy: returning `'pause'` **synchronously** still aborts with `R_DEBUG_PAUSE`. Prefer awaiting inside the hook.

Not yet: watch expressions, conditional breakpoints, pause/resume without Promise gates, Monaco binding.

Avoided anti-patterns: no source-less IR execution, no flattening spans away, no global mutable singleton interpreter.

---

## 5. Runtime diagnostics (`R_*`)

| Code | Meaning |
| --- | --- |
| `R_DIV_ZERO` | `/`, `DIV`, or `MOD` by zero |
| `R_ARRAY_BOUNDS` / `R_ARRAY_RANK` / `R_ARRAY_SIZE` | Index / shape / size limits |
| `R_UNDECL` / `R_UNDECL_ROUTINE` | Missing binding / routine |
| `R_STACK_OVERFLOW` | Call depth limit |
| `R_STEP_LIMIT` | Instruction budget |
| `R_INPUT` | Bad INPUT text for target type / exhausted host buffer |
| `R_CANCELLED` | AbortSignal / Stop |
| `R_FILE_*` | Virtual file I/O (`NOT_FOUND`, `ALREADY_OPEN`, `NOT_OPEN`, `MODE`, `EOF`, `PATH`) |
| `R_RETURN_OUTSIDE` / `R_NO_RETURN` | Invalid RETURN / missing FUNCTION return |
| `R_BUILTIN` / `R_BUILTIN_ARGS` | Builtin execution failure |
| `R_ASSIGN_CONSTANT` | Mutating CONSTANT |
| `R_TYPE` / `R_ARG_COUNT` / `R_PROC_AS_EXPR` | Dynamic type / call misuse |

Checker `C_*` diagnostics still gate the run when `semanticCheck: true`.

---

## 6. Known limitations

- Async `RuntimeHost` is supported (IDE INPUT); sync hosts still work
- Whole-array assignment requires identical element type **and** bounds
- No definite-assignment at runtime beyond undeclared reads
- Not a security sandbox (instruction/depth/array-size caps only — no memory/CPU isolation, no string-size cap, no untrusted-host isolation)
- `debugger.pause` aborts rather than suspending
- BYREF / DATE / OOP / RANDOM files unsupported
- Text files use VirtualFileSystem only (see `packages/interpreter/src/files/README.md`)
- JS `number` precision (INTEGER beyond `Number.MAX_SAFE_INTEGER` is not Cambridge-arbitrary-precision)

---

## 7. Usage

```ts
import { runPseudocode, MemoryHost } from '@pseudopilot/interpreter';

const host = new MemoryHost(['42']);
const result = runPseudocode(`
DECLARE N : INTEGER
INPUT N
OUTPUT N * 2
`, { host });

console.log(host.outputs); // ['84']
```

```bash
pnpm --filter @pseudopilot/interpreter test
```

---

## 8. Future sandbox review points

Before `services/runtime-sandbox`:

1. Keep AST (or a span-preserving bytecode) as the executed form — never `eval` Python.
2. Enforce tighter budgets (steps, call depth, array size, string size, wall clock).
3. Inject `RuntimeHost` with virtual FS; do not allow real disk by default.
4. Seed / lock `RandomSource`.
5. Consider serializable heap snapshots for teacher replay — design frames/values as plain data.
