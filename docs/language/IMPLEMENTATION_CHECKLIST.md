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
| DATE type + literal | ❌ | ❌ | ❌ | ❌ | ❌ |
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
| Typed parameters | ✅ | ✅ | ✅ | ✅ | ✅ |
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
| `EOF` | ✅ | ❌ | ❌ | ❌ | ❌ |
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
| `OPENFILE` READ/WRITE/APPEND | ✅ | ❌ | ❌ | ❌ | ❌ |
| `READFILE` / `WRITEFILE` / `CLOSEFILE` | ✅ | ❌ | ❌ | ❌ | ❌ |
| Sandboxed filesystem | — | — | ❌ | — | — |

---

## L. Extended (A Level)

| Feature | Parse | Check | Run | Py→ | →Py |
| --- | --- | --- | --- | --- | --- |
| Enum / pointer / record / set `TYPE` | ❌ | ❌ | ❌ | ❌ | ❌ |
| Random files SEEK/GET/PUT | ❌ | ❌ | ❌ | ❌ | ❌ |
| OOP CLASS / INHERITS / NEW | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## M. Product surfaces (non-grammar)

| Feature | Status |
| --- | --- |
| Pseudocode ↔ Python translator | 🟡 | Control flow + routines + DECLARE/CONSTANT + check + **builtins/`&`**; no BYREF/files |
| **Cambridge interpreter** | ✅ | AST execution via `@pseudopilot/interpreter` — see [`INTERPRETER.md`](./INTERPRETER.md) |
| Official language specification docs | ✅ |
| Complete EBNF document | ✅ |
| Parser coverage checklist | ✅ |
| **Semantics document** | ✅ | [`SEMANTICS.md`](./SEMANTICS.md) |
| IDE Monaco binding to parser | ❌ |
| Debugger UI (breakpoints / step) | ❌ | Hooks prepared in interpreter |
| AI coach grounded on this dialect | ❌ |

---

## Recommended implementation order

1. ✅ Iteration: `WHILE` ✅, `REPEAT` ✅, `FOR` ✅ (+ `STEP`)
2. ✅ String `&` + builtins `LENGTH` / `LEFT` / `RIGHT` / `MID` / `LCASE` / `UCASE`
3. ✅ Numeric builtins `INT` / `RAND`
4. ✅ `CONSTANT` (literal values); DATE still ❌
5. ✅ `CASE OF`
6. ❌ `BYVAL` / `BYREF`
7. ✅ Semantic checker (scopes, types, calls, builtins) — see [`SEMANTICS.md`](./SEMANTICS.md)
8. ✅ Interpreter (Core AST execution) — see [`INTERPRETER.md`](./INTERPRETER.md)
9. 🟡 Translator (V11 subset ↔ Python; Core incomplete — no BYREF/files)
10. ❌ Extended TYPE / files / OOP / sandbox

**Gate for “run in IDE” milestone:** wire `@pseudopilot/interpreter` + `RuntimeHost` into `apps/web` (separate from translation).
