# PseudoPilot Language — Official Source of Truth

This directory is the **canonical language specification** for PseudoPilot.

PseudoPilot targets the **Cambridge International AS & A Level Computer Science (9618)** pseudocode dialect, as published in the *Pseudocode Guide for Teachers* (examinations from 2024 onward; structure aligned to the 2026 / 2027–2029 guides).

| Document | Purpose |
| --- | --- |
| [SPECIFICATION.md](./SPECIFICATION.md) | Full language rules, ambiguities, and PseudoPilot resolutions |
| [EBNF.md](./EBNF.md) | Complete EBNF grammar for the dialect |
| [PARSER_COVERAGE.md](./PARSER_COVERAGE.md) | What `@pseudopilot/language-core` can parse today |
| [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md) | Parser + checker + translator + runtime progress |
| [SEMANTICS.md](./SEMANTICS.md) | Semantic checker: scopes, types, diagnostics (`C_*`) |
| [SPEC_REVIEW.md](./SPEC_REVIEW.md) | Production readiness review of this suite (errata + priorities) |
| [TRANSLATION.md](./TRANSLATION.md) | Translation engine architecture and V10 mapping |

## Status legend

| Mark | Meaning |
| --- | --- |
| ✅ | Implemented |
| 🟡 | Partially implemented |
| ❌ | Not implemented |

Parser vs product: **PARSER_COVERAGE** only reflects the lexer/parser/AST. **IMPLEMENTATION_CHECKLIST** also tracks translator and interpreter/runtime.

## Authority order

1. This specification (PseudoPilot decisions on ambiguities)
2. Cambridge 9618 Pseudocode Guide for Teachers
3. Exam paper inserts (temporary function tables for that paper only)

Do not invent syntax outside this document. If Cambridge and PseudoPilot diverge, the divergence must be listed under **Ambiguities** in `SPECIFICATION.md`.
