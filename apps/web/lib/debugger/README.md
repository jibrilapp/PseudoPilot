# IDE Debugger

**Location:** `apps/web/lib/debugger`  
**Engine:** `@pseudopilot/interpreter` via `DebuggerHooks`  
**Execution:** Web Worker (`apps/web/lib/worker`) — pause gate runs **with** the interpreter  
**UI consumer:** `RuntimeController` → React (`usePseudocodeRuntime`)

The debugger debugs **Cambridge pseudocode AST** — never translated Python.

---

## Architecture

```
Toolbar / CodeSurface / DebugSidebar / Variables
              │ useSyncExternalStore
              ▼
        RuntimeController (main)
              │ WorkerCommand / WorkerEvent
              ▼
        WorkerController → Web Worker
              │
     BreakpointStore (mirrored) + DebuggerSession
              │ builds DebuggerHooks
              ▼
        runPseudocode({ debugger, signal, host })
              │
        Interpreter.tick → await onBeforeStatement
```

React never talks to the interpreter. Breakpoint toggles live on the main thread and are
synced to the worker via `setBreakpoints`.

---

## Breakpoint model

| Field | Meaning |
| --- | --- |
| `line` | 1-based source line (`span.start.line`) |
| `enabled` | Disabled BPs are kept but skipped |
| `condition` | Reserved for future conditional BPs |

`BreakpointStore` is React-free. Toggle cycle: **none → enabled → disabled → removed**.

Multiple breakpoints are supported. They persist across runs until cleared.

---

## Stepping algorithm

`DebuggerSession` uses statement hooks + call-stack **depth** (no interpreter rewrite):

| Command | Pause when |
| --- | --- |
| Continue | Enabled breakpoint on `span.start.line` |
| Step Into | Next statement tick |
| Step Over | Next tick with `depth <= pauseDepth` **or** enabled BP |
| Step Out | Next tick with `depth < pauseDepth` **or** enabled BP |
| Pause | Flag → next statement boundary |

Suspend is an **async gate** inside `onBeforeStatement` (Promise). The worker posts a
serialized `paused` event (location, call stack, variables) — no `StackFrame` crosses the boundary.

---

## Call stack model

Mirrored via `onEnterFrame` / `onExitFrame`. On pause, UI receives top-first frames with:

- name / kind
- line (current span for top; `callSpan` for callers)
- parameter arguments (`kind === 'parameter'`)

---

## Execution states

Extends the runtime machine with **`paused`**:

`idle → running ⇄ paused ⇄ waitingForInput → completed | runtimeError | semanticError | cancelled`

`paused` is busy (Stop/Restart apply). Continue/Step only from `paused`.

---

## Future (not implemented)

- Watch expressions / conditional breakpoints
- Click stack frame to inspect non-top locals
- Expression-level stepping
- Security sandbox (protocol-ready; see worker README)

---

## Limitations

- Line breakpoints only
- Loop headers re-tick each iteration
- Editor is custom `CodeSurface` (not Monaco)
- Variable snapshots only on pause / program end (not every running step)
