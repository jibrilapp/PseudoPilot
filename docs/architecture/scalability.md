# Scalability model — 100,000+ users

## Definitions (do not mix these up)

| Term | Meaning | Harder than it sounds? |
|------|---------|------------------------|
| **100k users** | Accounts that exist / monthly actives | No — commodity for Postgres |
| **100k DAU** | Daily actives with intermittent IDE use | Manageable with CDN + client-local core |
| **10k concurrent editors** | Open IDE tabs typing/running | Requires **ClientLocal** default |
| **1k concurrent server executes** | Sandbox runs at once | Requires **separate sandbox fleet** + queue |
| **Classroom spike** | 3,000 students hit “Run” in 60s at exam start | Worst case we design for |

PseudoPilot’s product shape helps us: most of the expensive work (parse, run, step-debug for homework) can happen **in the browser** using shared TypeScript packages. The control plane (auth, save, sharing, AI, teacher batch grade) is what must scale on the server.

## Capacity budget (V1 targets)

| Path | SLO / budget | Notes |
|------|--------------|-------|
| Client parse (typical exercise) | p95 < 50ms | language-core in browser |
| Client execute (≤1e6 instructions) | p95 < 300ms | instruction budget always on |
| API non-AI (save project, etc.) | p95 < 200ms | behind CDN/API gateway |
| API via PgBouncer | pool wait p95 < 20ms | metric: `pseudopilot.db.pool_wait_ms` |
| Sandbox queue wait (exam spike) | p95 < 5s or fail soft | never unbounded queue |
| AI explain | async; UX spinner ok | never on request thread |

## Topology that survives 100k

1. **Stateless `apps/api` replicas** behind a load balancer. No in-memory sessions.
2. **Redis** for sessions, rate limits, pub/sub fan-out hints, BullMQ.
3. **Postgres + PgBouncer** (transaction pooling). Apps talk to PgBouncer, not directly to Postgres, once replica count > 1.
4. **`services/runtime-sandbox`** scales on its own HPA (CPU / queue depth). API only enqueues jobs or opens short-lived execute sessions.
5. **`apps/worker`** owns AI and exports — isolate LLM tail latency from user-facing API.
6. **CDN** for `apps/web` static assets; Monaco code-split.
7. **Org-scoped data access** (`OrgId` on every multi-tenant query) — tenancy bugs are scale bugs (cross-school data leaks under load and audits).

## What we intentionally do *not* do at foundation

- Microservices for everything (premature) — **except** sandbox extraction, which is load-shaped.
- Sharding Postgres on day one — start with vertical + read replicas; document shard key as `org_id` if needed later.
- Running student Python via host `eval` — forever forbidden.

## Failure modes at 100k (and mitigations)

| Failure | Mitigation encoded in foundation |
|---------|----------------------------------|
| API CPU melted by interpreters | ClientLocal default; sandbox service separate |
| Postgres connection exhaustion | PgBouncer in `infra/docker` |
| Redis OOM from traces | Trace sampling + LRU maxmemory policy |
| LLM bill / latency cascade | Worker queue + org budgets (types for rate limits already) |
| Exam thundering herd | Rate limits per user/org/route; soft-fail when sandbox queue deep |
| Blind production | Observability metric/trace name contracts |

## Load testing

See `tests/load/README.md`. Gate releases that change execute/save paths with k6 scenarios for classroom spike and steady DAU — even before full product exists, scripts document the intent.

## Decision

**This architecture supports 100k+ users** when ClientLocal remains the default, the API stays stateless, and sandbox/AI scale on independent axes. It does **not** support 100k concurrent *server-side* full VM executes on a single box — and it should not try to.
