# Execution Worker (`apps/web/lib/worker`)

Moves Cambridge AST interpretation off the UI thread.

**Not a sandbox.** Same-origin Web Worker for responsiveness and clean ownership.
Security isolation is a future milestone that can reuse this protocol.

## Components

| Module | Role |
| --- | --- |
| `protocol.ts` | `WorkerCommand` / `WorkerEvent` structured messages |
| `WorkerController.ts` | Main-thread facade (queue until ready, recreate) |
| `port.ts` | Browser `Worker` or in-process port (Vitest) |
| `execution.worker.ts` | Dedicated worker entry |
| `workerSession.ts` | `WorkerSessionRunner` — AbortSignal + `runPseudocode` |
| `WorkerRuntimeHost.ts` | INPUT/OUTPUT bridge + in-worker VFS |
| `WorkerDebuggerBridge.ts` | DebuggerSession + serialized pause snapshots |
| `snapshot.ts` | Compact variable serialization |

## Protocol (summary)

**Main → Worker:** `run`, `stop`, `pause`, `continue`, `stepInto`, `stepOver`, `stepOut`, `input`, `setBreakpoints`, `ping`

**Worker → Main:** `ready`, `output`, `inputRequest`, `paused`, `resumed`, `progress`, `completed`, `runtimeError`, `semanticError`, `cancelled`, `workerError`

No shared mutable state — structured clone only. `sessionId` correlates a run.

## Future transports

The same commands/events can target:

- a sandboxed iframe / opaque worker
- a cloud runner over WebSocket
- collaborative remote execution

without changing `@pseudopilot/interpreter` APIs — only the port implementation changes.

## Testing

Vitest uses `createInProcessWorkerPort()` (same protocol, no real Worker).
Browser builds use `execution.worker.ts` via `new Worker(new URL(...), { type: 'module' })`.
