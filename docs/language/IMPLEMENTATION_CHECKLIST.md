# Implementation checklist

Tracks PseudoPilot delivery for each language feature across the stack.

| Column | Meaning |
| --- | --- |
| **Parse** | `@pseudopilot/language-core` accepts and builds AST |
| **Check** | Type / binding / control-flow diagnostics |
| **Run** | `@pseudopilot/interpreter` executes |
| **Py→** | Translate Python → Cambridge pseudocode |
| **→Py** | Translate Cambridge → Python |

Legend: ✅ Implemented · 🟡 Partial · ❌ Not implemented

Spec authority: [SPECIFICATION.md](./SPECIFICATION.md) · Runtime: [INTERPRETER.md](./INTERPRETER.md)

---

## A. Lexical & presentation

| Feature | Parse | Check | Run | Py→ | →Py |
| --- | --- | --- | --- | --- | --- |
| `//` comments | ✅ | — | — | ✅ | ✅ |
| Keywords case-insensitive | ✅ | — | ✅ | ✅ | ✅ |
| Identifiers + underscore rules | ✅ | 🟡 | ✅ | ✅ | ✅ |
| Indentation ignored structurally | ✅ | — | — | ✅ | ✅ |

---

## B. Literals & types

| Feature | Parse | Check | Run | Py→ | →Py |
| --- | --- | --- | --- | --- | --- |
| INTEGER literal | ✅ | ✅ | ✅ | ✅ | ✅ |
| REAL literal | ✅ | ✅ | ✅ | ✅ | ✅ |
| STRING literal | ✅ | ✅ | ✅ | ✅ | ✅ |
| CHAR literal `'x'` | ✅ | ✅ | ✅ | ✅ | ✅ |
| BOOLEAN `TRUE`/`FALSE` | ✅ | ✅ | ✅ | ✅ | ✅ |
| DATE type + literal | ✅ | ✅ | ✅ | ✅ | ✅ |
| Type names in DECLARE / params | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## C. Operators & expressions

| Feature | Parse | Check | Run | Py→ | →Py |
| --- | --- | --- | --- | --- | --- |
| Assignment `←` / `<-` | ✅ | ✅ | ✅ | ✅ | ✅ |
| Arithmetic `+ - * / DIV MOD` | ✅ | 🟡 | ✅ | ✅ | ✅ |
| Relational | ✅ | 🟡 | ✅ | ✅ | ✅ |
| Logical `AND OR NOT` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `&` concatenation | ✅ | ✅ | ✅ | ✅ | ✅ |
| Precedence / parentheses | ✅ | — | ✅ | ✅ | ✅ |
| Index expressions | ✅ | ✅ | ✅ | ✅ | ✅ |
| Function call expressions | ✅ | ✅ | ✅ | ✅ | ✅ |
| Member `.` / pointer `^` | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## D. Declarations

| Feature | Parse | Check | Run | Py→ | →Py |
| --- | --- | --- | --- | --- | --- |
| `DECLARE` scalars | ✅ | ✅ | ✅ | ✅ | ✅ |
| `DECLARE` arrays | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-name DECLARE | ✅ | ✅ | ✅ | ✅ | ✅ |
| `CONSTANT` | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## E. I/O

| Feature | Parse | Check | Run | Py→ | →Py |
| --- | --- | --- | --- | --- | --- |
| `INPUT` | ✅ | 🟡 | ✅ | ✅ | ✅ |
| `OUTPUT` multi-value | ✅ | 🟡 | ✅ | ✅ | ✅ |

---

## F. Selection

| Feature | Parse | Check | Run | Py→ | →Py |
| --- | --- | --- | --- | --- | --- |
| `IF` / `THEN` / `ENDIF` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `ELSE` | ✅ | ✅ | ✅ | ✅ | ✅ |
| Nested IF | ✅ | ✅ | ✅ | ✅ | ✅ |
| `ELSE IF` extension | ✅ | ✅ | ✅ | ✅ | ✅ |
| `CASE OF` / `OTHERWISE` / `ENDCASE` | ✅ | ✅ | ✅ | ✅ | ✅ |
| CASE `TO` ranges | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## G. Iteration

| Feature | Parse | Check | Run | Py→ | →Py |
| --- | --- | --- | --- | --- | --- |
| `FOR` / `TO` / `NEXT` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `FOR` … `STEP` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `WHILE` / `DO` / `ENDWHILE` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `REPEAT` / `UNTIL` | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## H. Procedures & functions

| Feature | Parse | Check | Run | Py→ | →Py |
| --- | --- | --- | --- | --- | --- |
| PROCEDURE definition | ✅ | ✅ | ✅ | ✅ | ✅ |
| FUNCTION + RETURNS | ✅ | ✅ | ✅ | ✅ | ✅ |
| Typed parameters (incl. grouped `a, b : T`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `BYVAL` / `BYREF` | ❌ | ❌ | ❌ | ❌ | ❌ |
| `CALL` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `RETURN` | ✅ | ✅ | ✅ | ✅ | ✅ |
| Recursion (runtime stack) | ✅ | ✅ | ✅ | 🟡 | 🟡 |
| Nested routines rejected | ✅ | — | — | — | — |

---

## I. Arrays

| Feature | Parse | Check | Run | Py→ | →Py |
| --- | --- | --- | --- | --- | --- |
| 1D / 2D (+ N-D) declare | ✅ | ✅ | ✅ | ✅ | ✅ |
| Element read/write | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bounds checking | — | ❌ | ✅ | — | — |
| Whole-array assign | 🟡 | ❌ | 🟡 | ❌ | ❌ |

---

## J. Built-in functions

| Feature | Parse | Check | Run | Py→ | →Py |
| --- | --- | --- | --- | --- | --- |
| `EOF` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `LENGTH` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `LEFT` | ✅ | ✅ | ✅ | ✅ | ✅ | PseudoPilot Core (exam-insert style) |
| `RIGHT` / `MID` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `LCASE` / `UCASE` | ✅ | ✅ | ✅ | ✅ | ✅ | CHAR or STRING |
| `INT` / `RAND` | ✅ | ✅ | ✅ | ✅ | ✅ | RAND → REAL |
| Exam-insert packs | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## K. Text files

| Feature | Parse | Check | Run | Py→ | →Py |
| --- | --- | --- | --- | --- | --- |
| `OPENFILE` READ/WRITE/APPEND | ✅ | ✅ | ✅ | ✅ | ✅ |
| `READFILE` / `WRITEFILE` / `CLOSEFILE` | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sandboxed filesystem | — | — | ❌ | — | — |

---

## L. Extended (A Level)

| Feature | Parse | Check | Run | Py→ | →Py |
| --- | --- | --- | --- | --- | --- |
| Enum / pointer / set `TYPE` | ❌ | ❌ | ❌ | ❌ | ❌ |
| Record `TYPE` … `ENDTYPE` | ✅ | ✅ | ✅ | ✅ | ✅ |
| Random files SEEK/GET/PUT | ❌ | ❌ | ❌ | ❌ | ❌ |
| OOP CLASS / INHERITS / NEW | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## M. Product surfaces (non-grammar)

| Feature | Status |
| --- | --- |
| Pseudocode ↔ Python translator | 🟢 | Control flow + routines + DECLARE/CONSTANT + check + builtins/`&` + text files + **TYPE** + **CLASS** (bidirectional for PseudoPilot emit shapes); no BYREF / general Python |
| **Cambridge interpreter** | ✅ | AST execution via `@pseudopilot/interpreter` — see [`INTERPRETER.md`](./INTERPRETER.md) |
| **Web IDE Run integration** | ✅ | `apps/web/lib/runtime` — Run/Stop/Restart, Console INPUT, Variables |
| **Web IDE Debugger** | ✅ | `apps/web/lib/debugger` — breakpoints, pause/continue, step into/over/out |
| **Language service** | ✅ | `@pseudopilot/language-service` — see [`LANGUAGE_SERVICE.md`](./LANGUAGE_SERVICE.md) |
| **Incremental compilation** | ✅ | `@pseudopilot/compiler-service` — see [`INCREMENTAL_COMPILATION.md`](./INCREMENTAL_COMPILATION.md) |
| **Conformance / reliability suite** | ✅ | `@pseudopilot/conformance` — see [`../TESTING.md`](../TESTING.md) |
| Official language specification docs | ✅ |
| Complete EBNF document | ✅ |
| Parser coverage checklist | ✅ |
| **Semantics document** | ✅ | [`SEMANTICS.md`](./SEMANTICS.md) |
| IDE Monaco / CodeSurface binding to language service | ✅ | Monaco + LS providers — see [`../ide/MONACO.md`](../ide/MONACO.md) |
| Debugger UI (breakpoints / step) | ✅ | See [`apps/web/lib/debugger/README.md`](../../apps/web/lib/debugger/README.md) |
| LSP server process | ❌ | Protocol types aligned; adapter TBD |
| AI coach grounded on this dialect | ❌ |

---

## Recommended implementation order

1. ✅ Iteration: `WHILE` ✅, `REPEAT` ✅, `FOR` ✅ (+ `STEP`)
2. ✅ String `&` + builtins `LENGTH` / `LEFT` / `RIGHT` / `MID` / `LCASE` / `UCASE`
3. ✅ Numeric builtins `INT` / `RAND`
4. ✅ `CONSTANT` (literal values); ✅ `DATE`
5. ✅ `CASE OF`
6. ❌ `BYVAL` / `BYREF`
7. ✅ Semantic checker (scopes, types, calls, builtins) — see [`SEMANTICS.md`](./SEMANTICS.md)
8. ✅ Interpreter (Core AST execution) — see [`INTERPRETER.md`](./INTERPRETER.md)
9. 🟡 Translator (V12 subset ↔ Python; Core incomplete — no BYREF)
10. ✅ Language service (IDE intelligence) — see [`LANGUAGE_SERVICE.md`](./LANGUAGE_SERVICE.md)
11. ✅ Incremental compilation / document cache — see [`INCREMENTAL_COMPILATION.md`](./INCREMENTAL_COMPILATION.md)
12. ✅ Conformance & reliability suite — see [`../TESTING.md`](../TESTING.md)
13. ✅ Monaco IDE editor — see [`../ide/MONACO.md`](../ide/MONACO.md)
14. ✅ Record TYPE … ENDTYPE — see [`TYPE_SYSTEM.md`](./TYPE_SYSTEM.md)
15. ✅ OOP CLASS / INHERITS / NEW — see [`OBJECT_ORIENTED_PROGRAMMING.md`](./OBJECT_ORIENTED_PROGRAMMING.md)
16. ❌ Extended enum/pointer/SET TYPE / RANDOM files / OS sandbox

**Gate for “run in IDE” milestone:** ✅ `RuntimeController` + Run/Stop/INPUT wired in `apps/web`.  
**Gate for “worker execution” milestone:** ✅ Web Worker + message protocol (`apps/web/lib/worker`) — UI thread does not execute pseudocode.
**Gate for “debugger” milestone:** ✅ `DebuggerSession` + breakpoints / stepping wired in `apps/web`.
**Gate for “language service” milestone:** ✅ `@pseudopilot/language-service` (hover / definition / refs / rename / completion / signature help).
**Gate for “Monaco IDE” milestone:** ✅ Monaco editor + LS providers + debugger decorations (`docs/ide/MONACO.md`).
**Gate for “incremental compilation” milestone:** ✅ `@pseudopilot/compiler-service` staged caches (hash / AST / semantics / invalidation).
**Gate for “conformance suite” milestone:** ✅ `@pseudopilot/conformance` corpus + round-trip / stress / fuzz / benches (`docs/TESTING.md`).
**Gate for “TYPE / ENDTYPE records” milestone:** ✅ see [`TYPE_SYSTEM.md`](./TYPE_SYSTEM.md).
