# ADR 0003 — Modular monolith API + extractable sandbox

## Status

Accepted

## Context

Microservices for identity/workspace/curriculum too early slows a small team. But putting sandboxes inside the API process couples scaling axes badly.

## Decision

- Ship **`apps/api` as a modular monolith** (identity, workspace, curriculum, orchestration modules).
- Create **`services/runtime-sandbox` as a separate deployable from day one** (even as a stub), so horizontal scaling of executes never requires an emergency rewrite.

## Consequences

- Slightly more deploy wiring early.
- Clear queue/API contract later; no “god process” running student code beside JWT verification.
