# Cambridge Pseudocode Syntax

Student-facing **syntax reference** for Cambridge International AS & A Level Computer Science **9618** pseudocode, as used in PseudoPilot.

## Source of truth

| Source | Role |
| --- | --- |
| [Pseudocode Guide for Teachers (2027–2029)](https://www.cambridgeinternational.org/Images/721401-2027-2029-pseudocode-guide.pdf) | **Authoritative** syntax and rules |
| [Pseudocode Guide for Teachers (2026)](https://www.cambridgeinternational.org/Images/697401-2026-pseudocode-guide-for-teachers.pdf) | Same structure; CONFORMANCE audit edition |
| [June 2024 Paper 2 Insert](https://www.cambridgeinternational.org/Images/673618-june-2024-insert-paper-21.pdf) | Exam presentation of library functions (not new grammar) |

© Cambridge University Press & Assessment. PseudoPilot summarises rules in its own wording and keeps **exact syntax forms** where students must match exams. Do not treat this as a substitute for the official PDFs.

## How each entry is organised

1. **Exact Cambridge syntax**
2. Plain-English explanation
3. Small Cambridge-style example
4. Important Cambridge rules
5. Common exam mistake
6. Related links
7. **PseudoPilot support:** `SUPPORTED` | `PARTIALLY SUPPORTED` | `NOT YET SUPPORTED`

Support claims follow [`../CONFORMANCE.md`](../CONFORMANCE.md), [`../language/BUILTINS.md`](../language/BUILTINS.md), and [`../language/IMPLEMENTATION_CHECKLIST.md`](../language/IMPLEMENTATION_CHECKLIST.md) — not marketing guesses.

## Pages in this section

| Page | Cambridge guide |
| --- | --- |
| [Presentation](./presentation.md) | §1 |
| [Types, literals, DECLARE, assignment](./types-literals.md) | §2 |
| [Arrays](./arrays.md) | §3 |
| [User-defined types](./user-types.md) | §4 |
| [Input / output](./input-output.md) | §5.1 |
| [Operators](./operators.md) | §5.2–5.4 |
| [Selection](./selection.md) | §6 |
| [Iteration](./iteration.md) | §7 |
| [Procedures and functions](./procedures-functions.md) | §8 |
| [File handling](./files.md) | §9 |
| [Object-oriented programming](./oop.md) | §10 |

**Library functions** (`LENGTH`, `MID`, `RAND`, insert packs, …) live under [Library Routines](../library-routines/README.md).

## Status legend

| Status | Meaning |
| --- | --- |
| **SUPPORTED** | Parsed, checked, and runnable (and usually translated) in PseudoPilot |
| **PARTIALLY SUPPORTED** | Works with soft typing, presentation gaps, or incomplete stages |
| **NOT YET SUPPORTED** | Not implemented (rare for Guide grammar; mostly product stubs) |

Intentional PseudoPilot extensions (e.g. ASCII `<-`, optional `DO`, `ELSE IF`) are marked clearly and are **not** Cambridge Guide requirements.
