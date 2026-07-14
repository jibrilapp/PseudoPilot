# System overview

PseudoPilot is a **modular monorepo**. Deployables live under `apps/` and `services/`. Shared deterministic teaching engines live under `packages/`.

## Package dependency rules

```
apps/* ──────────► packages/*     (allowed)
services/* ──────► packages/*     (allowed)
packages/A ──────► packages/B     (allowed if acyclic and documented)
packages/* ─╳───► apps/*          (FORBIDDEN)
language-core ─╳► ai-coach        (FORBIDDEN — AI never owns language truth)
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
