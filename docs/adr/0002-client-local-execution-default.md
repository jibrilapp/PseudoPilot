# ADR 0002 — Client-local execution as the scale default

## Status

Accepted

## Context

100,000 users opening an IDE would melt a naive “POST /run on every keystroke/run” architecture.

## Decision

Default `ExecutionMode` is **`ClientLocal`**: parse/run/debug using packages shipped to `apps/web`.  
`ServerSandbox` is reserved for untrusted long jobs, file I/O, and teacher batch grading.  
`HybridDebug` is optional later for sensitive ops.

Encoded in `@pseudopilot/shared-types` as `CapacityHint.preferClientLocal: true`.

## Consequences

- Bandwidth and CDN matter more than sandbox CPU for DAU scale.
- Security review still required for anything that leaves the browser.
- Classroom spikes on **server** execute must be queued and rate-limited, not assumed equal to editor concurrency.
