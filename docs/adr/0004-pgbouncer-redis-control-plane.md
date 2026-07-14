# ADR 0004 — PgBouncer + Redis for the 100k control plane

## Status

Accepted

## Context

Horizontal API replicas without pooling exhaust Postgres connections. In-memory sessions prevent rolling deploys and multi-instance auth.

## Decision

- PostgreSQL is the system of record.
- **All app DB traffic goes through PgBouncer** (transaction pooling) once more than one API instance exists; local compose includes PgBouncer on port 6432 from Milestone 1 so the habit forms early.
- **Redis** holds sessions, rate-limit counters, and job queues (BullMQ later).

## Consequences

- Developers use `localhost:6432` in `.env.example` as the default DB URL tip.
- Prepared-statement quirks of transaction pooling must be respected by the ORM (Drizzle/Prisma) when wired.
