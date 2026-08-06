# System overview

PseudoPilot is a **modular monorepo**. Deployables live under `apps/` and `services/`. Shared deterministic teaching engines live under `packages/`.

## Language pipeline

```
                    ┌──► Interpreter  (@pseudopilot/interpreter)
Lexer → Parser → AST ┤
                    ├──► Checker → Language Service  (@pseudopilot/language-service)
                    │         │         ▲
                    │         │    hover / refs / rename / completion
                    │         │    (no execute, no translate)
                    ├──► IncrementalCompiler (@pseudopilot/compiler-service)
                    │         │  document / AST / semantic caches
                    │         └── shared by language-service (future: translate / interpret)
                    └──► Checker → IR → Translator
         (@pseudopilot/language-core)   (@pseudopilot/checker)
                                        (@pseudopilot/translator)

apps/web RuntimeController ──► WorkerController ──► Web Worker
         (Run / Stop / Step)                              │
                                                          ▼
                                   WorkerDebuggerBridge + WorkerRuntimeHost
                                                          │
                                                   runPseudocode + VFS
         Translator stays independent (bidirectional live Pseudocode ↔ Python panes)
         Language service stays independent (IDE intelligence only)
         Compiler-service is the shared incremental frontend cache
         Monaco (apps/web CodeSurface) adapts language-service + origin-aware translate sync
```

Semantic rules live only in `@pseudopilot/checker` (`C_*` diagnostics).  
The interpreter executes the **validated AST** asynchronously (awaits `RuntimeHost` and debugger gates) **inside a dedicated Web Worker** so the UI thread stays responsive.  
The translator may add Python-target diagnostics (`T_*`) after checking.  
The language service **reuses** incremental compiler outputs for IDE features — it never invents a second type system.

**Worker ≠ sandbox:** the worker is for responsiveness / isolation from React, not security. A future sandbox can reuse the same message protocol.

## Package dependency rules

```
apps/* ──────────► packages/*     (allowed)
services/* ──────► packages/*     (allowed)
packages/A ──────► packages/B     (allowed if acyclic and documented)
packages/* ─╳───► apps/*          (FORBIDDEN)
language-core ─╳► ai-coach        (FORBIDDEN — AI never owns language truth)
checker ─────────► language-core  (AST + spans only)
compiler-service ► language-core + checker   (NOT language-service)
translator ──────► language-core + checker
interpreter ─────► language-core + checker   (NOT translator)
language-service ► compiler-service + language-core + checker
                   (NOT interpreter / translator)
conformance ─────► language-core + checker + translator + interpreter
                   + compiler-service + language-service
                   (test-only; must not be imported by production packages)
```

## Deployables

| Unit | Scales with | Notes |
|------|-------------|-------|
| `apps/web` | Static CDN + edge | Heavy client; ships language-core |
| `apps/teacher` | Same pattern as web | Can merge into web routes later if desired |
| `apps/api` | Horizontal pods | Stateless; Redis for sessions |
| `apps/worker` | Queue depth | AI + exports |
| `services/runtime-sandbox` | Execute queue / CPU | Isolated; never share process with API |

## Local mental model

Developer laptop ≈ 1 API + 1 worker + compose (Postgres/PgBouncer/Redis).  
Production ≈ N API + N workers + M sandboxes + managed Postgres/Redis + CDN.
