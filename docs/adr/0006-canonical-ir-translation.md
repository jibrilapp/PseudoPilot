# ADR 0006 — Canonical IR for bidirectional translation

## Status

Accepted

## Context

PseudoPilot must translate Cambridge 9618 pseudocode ↔ Python (and later more languages) deterministically. String-templating or AI rewrite cannot be the source of truth (see ADR 0005).

## Decision

Introduce a **canonical intermediate representation (IR)** inside `@pseudopilot/translator`:

1. Frontends lower language-specific trees/source into IR.
2. Backends print IR to concrete syntax.
3. Operator/literal/I/O mappings live in shared rule tables.
4. Comments/blank lines attach as **trivia** on IR statements/programs.

Cambridge parsing remains in `@pseudopilot/language-core`. The translator depends on it for the Cambridge frontend only.

## Consequences

- Adding a language ≈ parse + print adapters.
- Round-trip tests assert IR equivalence and/or normalized text.
- Layout is normalized in V1; semantic fidelity is mandatory.
- Unsupported constructs emit diagnostics and fail the translation (`ok: false`).
