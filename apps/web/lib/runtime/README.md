# IDE Runtime (`apps/web/lib/runtime`)

Owns Run / Stop / Restart / Console / Variables for the student IDE.

**Execution does not run on the UI thread.** `RuntimeController` sends commands to a
[`WorkerController`](../worker/README.md); the Web Worker runs `runPseudocode`.

## Architecture

```
React (useSyncExternalStore)
        │
        ▼
RuntimeController          ← UI state, console, breakpoints (main thread)
        │
        ▼
WorkerController           ← message bridge
        │
        ▼
Web Worker (or in-process test port)
        │
        ▼
WorkerSessionRunner
  ├─ WorkerRuntimeHost     ← INPUT / OUTPUT / VFS
  ├─ WorkerDebuggerBridge  ← DebuggerSession + pause gate
  └─ runPseudocode         ← @pseudopilot/interpreter
```

Translator remains independent (live translate pane only).

## Why a worker before a sandbox?

The worker isolates **CPU-heavy interpretation** and **async park** from React rendering
so the IDE stays responsive (Stop, typing, scrolling) during tight loops. It is **not**
a security boundary — the same-origin worker still shares the page's privileges.
A future sandbox can reuse the same message protocol over a stricter host.

## Ownership

| Concern | Thread |
| --- | --- |
| React / snapshots / `useSyncExternalStore` | Main |
| BreakpointStore (UI) | Main (synced to worker) |
| `runPseudocode` / parse / check | Worker |
| Debugger pause gate / step policy | Worker |
| VirtualFileSystem | Worker (per run) |
| Console rendering / INPUT draft | Main |

## Session generation

Stop / Restart bump `generation` so late `output` / `cancelled` / pause events from the
aborted session are ignored. `run()` returns a Promise settled when the worker reports a
terminal event **or** when Stop settles early.

## Limitations

- Client-local only (no security sandbox)
- Single concurrent run per IDE instance
- Variable snapshots sent on pause / finish only (not every step)
- Terminal states do not auto-return to `idle`
- Worker recreate on transport crash; VFS is ephemeral per run
