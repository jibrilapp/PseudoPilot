# Implementation checklist

Tracks PseudoPilot delivery for each language feature across the stack.

| Column | Meaning |
| --- | --- |
| **Parse** | `@pseudopilot/language-core` accepts and builds AST |
| **Check** | Type / binding / control-flow diagnostics |
| **Run** | Interpreter / runtime executes |
| **Py→** | Translate Python → Cambridge pseudocode |
| **→Py** | Translate Cambridge → Python |

Legend: ✅ Implemented · 🟡 Partial · ❌ Not implemented

Spec authority: [SPECIFICATION.md](./SPECIFICATION.md)

---

## A. Lexical & presentation

| Feature | Parse | Check | Run | Py→ | →Py |
| --- | --- | --- | --- | --- | --- |
| `//` comments | ✅ | — | ✅ | ❌ | ❌ |
| Keywords case-insensitive | ✅ | ❌ | ❌ | ❌ | ❌ |
| Identifiers + underscore rules | ✅ | ❌ | ❌ | ❌ | ❌ |
| Indentation ignored structurally | ✅ | — | — | ❌ | ❌ |

---

## B. Literals & types

| Feature | Parse | Check | Run | Py→ | →Py |
| --- | --- | --- | --- | --- | --- |
| INTEGER literal | ✅ | ❌ | ❌ | 🟡 | 🟡 |
| REAL literal | 🟡 | ❌ | ❌ | 🟡 | 🟡 |
| STRING literal | ✅ | ❌ | ❌ | 🟡 | 🟡 |
| CHAR literal `'x'` | ✅ | ❌ | ❌ | 🟡 | 🟡 |
| BOOLEAN `TRUE`/`FALSE` | ✅ | ❌ | ❌ | 🟡 | 🟡 |
| DATE type + literal | ❌ | ❌ | ❌ | ❌ | ❌ |
| Type names in DECLARE / params | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## C. Operators & expressions

| Feature | Parse | Check | Run | Py→ | →Py |
| --- | --- | --- | --- | --- | --- |
| Assignment `←` / `<-` | ✅ | ❌ | ❌ | 🟡 | 🟡 |
| Arithmetic `+ - * / DIV MOD` | ✅ | ❌ | ❌ | 🟡 | 🟡 |
| Relational | ✅ | ❌ | ❌ | 🟡 | 🟡 |
| Logical `AND OR NOT` | ✅ | ❌ | ❌ | 🟡 | 🟡 |
| `&` concatenation | ❌ | ❌ | ❌ | ❌ | ❌ |
| Precedence / parentheses | ✅ | — | ❌ | ❌ | ❌ |
| Index expressions | ✅ | ❌ | ❌ | 🟡 | 🟡 |
| Function call expressions | ✅ | ❌ | ❌ | ❌ | ❌ |
| Member `.` / pointer `^` | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## D. Declarations

| Feature | Parse | Check | Run | Py→ | →Py |
| --- | --- | --- | --- | --- | --- |
| `DECLARE` scalars | ✅ | ❌ | ❌ | ❌ | ❌ |
| `DECLARE` arrays | ✅ | ❌ | ❌ | ❌ | ❌ |
| Multi-name DECLARE | ✅ | ❌ | ❌ | ❌ | ❌ |
| `CONSTANT` | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## E. I/O

| Feature | Parse | Check | Run | Py→ | →Py |
| --- | --- | --- | --- | --- | --- |
| `INPUT` | ✅ | ❌ | ❌ | 🟡 | 🟡 |
| `OUTPUT` multi-value | ✅ | ❌ | ❌ | 🟡 | 🟡 |

---

## F. Selection

| Feature | Parse | Check | Run | Py→ | →Py |
| --- | --- | --- | --- | --- | --- |
| `IF` / `THEN` / `ENDIF` | ✅ | ❌ | ❌ | ✅ | ✅ |
| `ELSE` | ✅ | ❌ | ❌ | ✅ | ✅ |
| Nested IF | ✅ | ❌ | ❌ | ✅ | ✅ |
| `ELSE IF` extension | ✅ | ❌ | ❌ | ✅ | ✅ |
| `CASE OF` / `OTHERWISE` / `ENDCASE` | ✅ | ✅ | ✅ | ✅ | ✅ |
| CASE `TO` ranges | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## G. Iteration

| Feature | Parse | Check | Run | Py→ | →Py |
| --- | --- | --- | --- | --- | --- |
| `FOR` / `TO` / `NEXT` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `FOR` … `STEP` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `WHILE` / `DO` / `ENDWHILE` | ✅ | ❌ | ❌ | ✅ | ✅ |
| `REPEAT` / `UNTIL` | ✅ | ❌ | ❌ | ✅ | ✅ |

---

## H. Procedures & functions

| Feature | Parse | Check | Run | Py→ | →Py |
| --- | --- | --- | --- | --- | --- |
| PROCEDURE definition | ✅ | ❌ | ❌ | ✅ | ✅ |
| FUNCTION + RETURNS | ✅ | ❌ | ❌ | ❌ | ❌ |
| Typed parameters | ✅ | ❌ | ❌ | ✅ | ✅ |
| `BYVAL` / `BYREF` | ❌ | ❌ | ❌ | ❌ | ❌ |
| `CALL` | ✅ | ❌ | ❌ | ✅ | ✅ |
| `RETURN` | ✅ | ❌ | ❌ | ❌ | ❌ |
| Recursion (runtime stack) | 🟡 | ❌ | ❌ | ❌ | ❌ | parse OK |
| Nested routines rejected | ✅ | — | — | — | — |

---

## I. Arrays

| Feature | Parse | Check | Run | Py→ | →Py |
| --- | --- | --- | --- | --- | --- |
| 1D / 2D (+ N-D) declare | ✅ | ❌ | ❌ | ❌ | ❌ |
| Element read/write | ✅ | ❌ | ❌ | 🟡 | 🟡 |
| Bounds checking | — | ❌ | ❌ | — | — |
| Whole-array assign | 🟡 | ❌ | ❌ | ❌ | ❌ |

---

## J. Built-in functions

| Feature | Parse | Check | Run | Py→ | →Py |
| --- | --- | --- | --- | --- | --- |
| `EOF` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `LENGTH` | ❌ | ❌ | ❌ | ❌ | ❌ |
| `RIGHT` / `MID` | ❌ | ❌ | ❌ | ❌ | ❌ |
| `LCASE` / `UCASE` | ❌ | ❌ | ❌ | ❌ | ❌ |
| `INT` / `RAND` | ❌ | ❌ | ❌ | ❌ | ❌ |
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
| Official language specification docs | ✅ |
| Complete EBNF document | ✅ |
| Parser coverage checklist | ✅ |
| IDE Monaco binding to parser | ❌ |
| Interpreter / debugger | ❌ |
| Pseudocode ↔ Python translator | 🟡 | Assign/I/O/expr/IF/WHILE/REPEAT/FOR/CASE/**PROCEDURE+CALL**; no FUNCTION/DECLARE |
| AI coach grounded on this dialect | ❌ |

---

## Recommended implementation order (pre-translator)

1. ✅ Iteration: `WHILE` ✅, `REPEAT` ✅, `FOR` ✅ (+ `STEP`)
2. ❌ String `&` + builtins `LENGTH` / `RIGHT` / `MID` / `LCASE` / `UCASE`
3. ❌ Numeric builtins `INT` / `RAND`
4. ❌ `CONSTANT`, CHAR literals, strict REAL literals
5. ✅ `CASE OF`
6. ❌ `BYVAL` / `BYREF`
7. 🟡 Semantic checker (types, scopes, NEXT binder match)
8. ❌ Interpreter (Core)
9. ❌ Translator (Core ↔ Python)
10. ❌ Extended TYPE / files / OOP

**Gate for “translation engine” milestone:** items **1–3** should be at least **Parse ✅**; ideally **Run ✅** for Core Paper 2 constructs used in taught examples.
