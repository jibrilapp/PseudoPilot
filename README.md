# PseudoPilot

AI-powered IDE, interpreter, debugger, visualizer, and bidirectional translator between
**Cambridge International Computer Science pseudocode** and **Python**.

> **Milestone 1 status:** project foundation only. No parser, IDE, auth, or AI features yet.

---

## Senior scale verdict (100,000+ users)

**Yes — if we keep the scale model below.** Folder trees do not scale; execution topology does.

| Traffic class | Target | Scale strategy |
|---------------|--------|----------------|
| Registered / monthly active users | 100k+ | Ordinary for Postgres + CDN + horizontal API |
| Concurrent editors in the IDE | Tens of thousands | **Client-local language-core** (parse/run in browser) — default path |
| Concurrent **server** sandboxed executes | Hundreds–low thousands | Separate `runtime-sandbox` fleet + queue + hard budgets |
| Concurrent AI coach jobs | Hundreds | Async `worker` + provider rate limits + org budgets |
| Auth / projects / saves | 100k users | Stateless API replicas + Redis + PgBouncer |

**What would fail us at 100k:** putting all interpretation on the API process, opening a DB connection per request without pooling, sticky in-memory sessions, or letting AI calls block HTTP workers.

Details: [`docs/architecture/scalability.md`](docs/architecture/scalability.md).

---

## How everything connects

```
┌──────────── apps/web (IDE) ────────────┐
│  Monaco + @pseudopilot/language-core   │  ← default: runs ON THE CLIENT
│  translator / interpreter (local)      │
└─────────────────┬──────────────────────┘
                  │ HTTPS / WSS (save, auth, AI, sandbox runs)
┌─────────────────▼──────────────────────┐
│              apps/api                   │  ← horizontally scalable (stateless)
│  workspace · identity · orchestration  │
└───────┬─────────────┬─────────┬────────┘
        │             │         │
   PostgreSQL     Redis      apps/worker (AI / exports)
   via PgBouncer              │
                              ▼
                    services/runtime-sandbox  ← scales independently
```

**Boundary rule:** `language-core`, `translator`, and `interpreter` never import from `apps/*` or `ai-coach`.

---

## Tech stack (locked for foundation)

| Layer | Choice | Why |
|-------|--------|-----|
| Language (core) | TypeScript (Node 22) | One core for browser + server; strong types for exam fidelity |
| Monorepo | pnpm workspaces + Turborepo | Shared packages without publish friction |
| API (planned) | NestJS or Fastify modular monolith | Single deploy until scale demands splits; sandbox already split |
| Web (planned) | Next.js App Router + Monaco | Student IDE + docs |
| DB | PostgreSQL 16 | Relational integrity for schools/orgs |
| Pooling | PgBouncer (transaction mode) | Survive many API replicas |
| Cache / queue | Redis 7 | Sessions, rate limits, BullMQ |
| Tests | Vitest (unit), Playwright later (e2e), k6 (load) | Corpus + load gates for scale |
| Observability | OpenTelemetry conventions in `@pseudopilot/observability` | Name metrics before the code exists |

---

## Repository map

```
pseudopilot/
├── apps/           # Deployable surfaces (web, api, teacher, worker)
├── packages/       # Shared libraries (language-core first among equals)
├── services/       # Extractable services (runtime-sandbox)
├── docs/           # Architecture + ADRs
├── infra/docker/   # Local Postgres + PgBouncer + Redis
├── tests/          # e2e, corpus, load
└── scripts/        # Developer automation
```

---

## Prerequisites

- **Node.js 22+** (see `.nvmrc`; nvm recommended)
- **pnpm 9+** (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- **Docker** (optional locally, required for DB/Redis)

```bash
# Load nvm if needed
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"

pnpm install
pnpm check          # typecheck + lint + test
docker compose -f infra/docker/docker-compose.yml up -d   # optional
```

Copy `.env.example` → `.env` when you start API work.

---

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm check` | Typecheck, lint, and unit tests across the monorepo |
| `pnpm build` | Build all packages/apps that define `build` |
| `pnpm test` | Unit tests |
| `pnpm format` | Prettier write |

---

## Git

Repository initialized on `main`. Commit when you are ready — foundation changes should land as a single clear Milestone 1 commit.

---

## What’s next

Milestone 2 (proposed): **`language-core` lexer + tokens** for a tiny Cambridge subset — still no IDE UI.
