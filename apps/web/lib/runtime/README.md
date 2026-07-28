# IDE Runtime Integration

**App:** `apps/web`  
**Controller:** `apps/web/lib/runtime`  
**Engine:** `@pseudopilot/interpreter` (Cambridge AST — **not** Python)

---

## Architecture

```
IdeShell / Toolbar / Console / Variables
              │ subscribe (useSyncExternalStore)
              ▼
        RuntimeController   ← session lifecycle, state machine
              │
        IdeRuntimeHost      ← OUTPUT → console; INPUT → Promise
              │
        runPseudocode()     ← parse → check → async interpret
              │
     @pseudopilot/interpreter
```

Translator remains independent (live Python pane). Run never executes translated Python.

React must never call the interpreter directly. `usePseudocodeRuntime` only reads a cached snapshot.

---

## Execution states

| State | Meaning |
| --- | --- |
| `idle` | No active session |
| `running` | Interpreter advancing |
| `waitingForInput` | `INPUT` paused; console accepts a line |
| `completed` | Finished successfully |
| `runtimeError` | `R_*` diagnostic |
| `semanticError` | Checker/parse `C_*` / `E_*` before or instead of run |
| `cancelled` | Stop / AbortSignal |

Invalid transitions are rejected (`canTransition`); terminal teardown may force `cancelled` / error states.

---

## Session model

- One `RuntimeController` singleton per IDE tab (`getRuntimeController`).
- **Generation id:** every `run()` and every `stop()` / mid-run `restart()` **invalidates** the session by bumping `generation` *before* aborting. Late OUTPUT, INPUT callbacks, and `runPseudocode` results from the old generation are ignored — this prevents Stop/Restart races that would otherwise re-apply `R_CANCELLED` diagnostics or stale console lines.
- `AbortController` is passed as `signal` into the interpreter (`R_CANCELLED`).
- The interpreter yields to the **macrotask** queue every 256 steps so Stop can interrupt tight loops (microtask-only yields are insufficient and starve the event loop).
- Pending INPUT promises are rejected on Stop via `IdeRuntimeHost.cancelInput` (`AbortError`).
- Concurrent Run while busy is ignored (no overlapping sessions).
- Console lines are soft-capped (`MAX_CONSOLE_LINES = 2000`) so infinite OUTPUT cannot unbounded-grow the store.

---

## Snapshot / React binding

`getSnapshot()` returns a **stable object reference** until the next `emit()`.

`useSyncExternalStore` compares snapshots with `Object.is`. Returning a fresh object on every `getSnapshot()` call causes an infinite re-render loop — the controller always rebuilds the snapshot only inside `emit()`.

`submitInput` reads the draft via a ref so the callback identity does not churn on every keystroke.

---

## RuntimeHost (browser)

```ts
writeOutput(line) → console line (kind: out)
readInput() → Promise<string>  // resolves on submitInput()
```

Designed for async from day one; the interpreter awaits host I/O.

Overlapping `readInput()` rejects the previous waiter (Cambridge programs are single-threaded; a second wait would otherwise deadlock the UI).

---

## Variables panel

Snapshots come from interpreter bindings (`formatValue`), not the AST:

- Globals from the global environment
- Locals / parameters / constants from the current stack frame
- Throttled live updates via `onBeforeStatement` while running

---

## Future debugger (not in this milestone)

Review before implementing:

1. Replace abort-on-`pause` with a true suspend/resume continuation.
2. Breakpoints keyed by statement `SourceSpan` (already on AST).
3. Step-over / step-into using the existing `DebuggerHooks` surface.
4. Watch expressions evaluated in the current frame environment.
5. Keep React out of the interpreter — extend `RuntimeController` only.
6. Debugger pause must participate in the same generation / invalidate protocol as Stop.

---

## Limitations

- Client-local only (no sandbox / worker isolation yet)
- Single concurrent run per IDE instance (page singleton)
- Variable refresh is throttled (not every statement)
- No breakpoints / stepping / watches
- File I/O still unsupported in the interpreter
- Aborted interpreters may burn CPU until the next macrotask yield (~256 steps)
- Console auto-open effects in `IdeShell` can re-open panels the student closed while busy
- Terminal states (`completed` / `cancelled` / errors) do not auto-return to `idle`
