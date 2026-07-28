# IDE Debugger

**Location:** `apps/web/lib/debugger`  
**Engine:** `@pseudopilot/interpreter` via `DebuggerHooks`  
**UI consumer:** `RuntimeController` → React (`usePseudocodeRuntime`)

The debugger debugs **Cambridge pseudocode AST** — never translated Python.

---

## Architecture

```
Toolbar / CodeSurface / DebugSidebar / Variables
              │ useSyncExternalStore
              ▼
        RuntimeController
              │ owns
              ▼
     BreakpointStore  +  DebuggerSession
              │ builds DebuggerHooks
              ▼
        runPseudocode({ debugger, signal, host })
              │
        Interpreter.tick → await onBeforeStatement
```

React never talks to the interpreter or owns breakpoint storage.

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
| Step Over | Next tick with `depth <= pauseDepth` |
| Step Out | Next tick with `depth < pauseDepth` |
| Pause | Flag → next statement boundary |

Suspend is an **async gate** inside `onBeforeStatement` (Promise). Legacy sync return `'pause'` still aborts with `R_DEBUG_PAUSE`.

---

## Call stack model

Mirrored via `onEnterFrame` / `onExitFrame`. On pause, UI receives top-first frames with:

- name / kind
- line (current span for top; `callSpan` for callers)
- parameter arguments (`kind === 'parameter'`)

Frame click-to-select is reserved for a future milestone.

---

## Execution states

Extends the runtime machine with **`paused`**:

`idle → running ⇄ paused ⇄ waitingForInput → completed | runtimeError | semanticError | cancelled`

`paused` is busy (Stop/Restart apply). Continue/Step only from `paused`.

---

## Future (not implemented)

- Watch expressions (evaluate in current frame env)
- Conditional breakpoints (`Breakpoint.condition`)
- Click stack frame to inspect non-top locals
- Expression-level stepping
- Timeline / reverse debugging

---

## Limitations

- Line breakpoints only (not column / statement-id)
- Loop headers re-tick each iteration (usually desired)
- No worker isolation — pause holds the interpreter Promise on the main thread
- Editor is custom `CodeSurface` (not Monaco)
- Disabled debugger path still installs a thin hook for variable throttle when running
