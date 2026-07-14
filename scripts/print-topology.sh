#!/usr/bin/env bash
# Prints how foundation pieces map to 100k-user scale. No product features.
set -euo pipefail
cat <<'EOF'
PseudoPilot — connection map (foundation)

  Browser IDE (apps/web)
      │  ships packages/language-core|translator|interpreter  → ClientLocal scale path
      ▼
  apps/api  (horizontal, stateless)
      ├─► PgBouncer :6432 ─► PostgreSQL
      ├─► Redis :6379 (sessions, rate limits, queues)
      ├─► apps/worker (AI / exports) ─► Redis queue
      └─► services/runtime-sandbox (independent HPA)

Boundary: packages/* never import apps/*.
AI never owns parse/run truth (ADR 0005).
EOF
