# ADR 0005 — AI coach is never authoritative for runtime

## Status

Accepted

## Context

LLMs hallucinate syntax and “fix” programs incorrectly. At school scale, wrong runtime advice destroys trust faster than missing features.

## Decision

Parser, translator, and interpreter are deterministic packages. AI may explain, hint, or review — never invent execution results or replace the translator’s canonical path. AI work runs on `apps/worker`, not on the request thread.

## Consequences

- Product works offline for parse/run/translate without API keys.
- Grounding (AST + diagnostics + citations) is mandatory in later AI milestones.
