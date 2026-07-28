# System overview

PseudoPilot is a **modular monorepo**. Deployables live under `apps/` and `services/`. Shared deterministic teaching engines live under `packages/`.

## Language pipeline

```
                    ┌──► Interpreter  (@pseudopilot/interpreter)
Lexer → Parser → AST ┤                      ▲
                    └──► Checker → IR → Translator
         (@pseudopilot/language-core)   (@pseudopilot/checker)
                                        (@pseudopilot/translator)

apps/web RuntimeController ──► Interpreter (via IdeRuntimeHost)
         (Run / Stop / INPUT)     Translator stays independent
```

Semantic rules live only in `@pseudopilot/checker` (`C_*` diagnostics).  
The interpreter executes the **validated AST** asynchronously (awaits `RuntimeHost`).  
The translator may add Python-target diagnostics (`T_*`) after checking.

## Package dependency rules

```
apps/* ──────────► packages/*     (allowed)
services/* ──────► packages/*     (allowed)
packages/A ──────► packages/B     (allowed if acyclic and documented)
packages/* ─╳───► apps/*          (FORBIDDEN)
language-core ─╳► ai-coach        (FORBIDDEN — AI never owns language truth)
checker ─────────► language-core  (AST + spans only)
translator ──────► language-core + checker
interpreter ─────► language-core + checker   (NOT translator)
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
