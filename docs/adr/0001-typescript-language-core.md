# ADR 0001 — TypeScript language core as source of truth

## Status

Accepted

## Context

We need one deterministic implementation of lexer/parser/AST/interpreter usable in the browser IDE and on the server (sandbox validation, teacher batch).

## Decision

Implement `packages/language-core` (and translator/interpreter) in **TypeScript**. Defer Rust/WASM until profiling proves a need.

## Consequences

- Single corpus of tests for exam fidelity.
- Bundle size and CPU on low-end school Chromebooks must stay in budget (SLO in scalability.md).
- No Python `eval`-based interpreter on the server control plane.
