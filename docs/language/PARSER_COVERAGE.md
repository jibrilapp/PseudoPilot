# Parser coverage checklist

**Package:** `@pseudopilot/language-core`  
**Spec:** [SPECIFICATION.md](./SPECIFICATION.md)  
**Legend:** ✅ Implemented · 🟡 Partially implemented · ❌ Not implemented

This checklist is about **lexer + parser + AST** only (not interpreter or translator).  
For full-stack Cambridge status, prefer [`../CONFORMANCE.md`](../CONFORMANCE.md) (authoritative).

---

## 1. Reserved keywords

| Feature | Status | Notes |
| --- | --- | --- |
| Keyword table (core + Extended) | ✅ | Control-flow, routines, files, TYPE forms, OOP |
| Case-insensitive keywords | ✅ | |
| Reject keywords as identifiers | 🟡 | Lexed as keywords; edge cases TBD |

### Keyword inventory

| Keyword | Status |
| --- | --- |
| `DECLARE` | ✅ |
| `CONSTANT` | ✅ |
| `INTEGER` `REAL` `CHAR` `STRING` `BOOLEAN` `DATE` | ✅ |
| `ARRAY` `OF` | ✅ |
| `TRUE` `FALSE` | ✅ |
| `INPUT` `OUTPUT` | ✅ |
| `IF` `THEN` `ELSE` `ENDIF` | ✅ |
| `CASE` `OTHERWISE` `ENDCASE` | ✅ |
| `FOR` (loop) | ✅ |
| `FOR` (file mode connector) | ✅ |
| `TO` `NEXT` | ✅ | Bare `NEXT` allowed; optional binder |
| `STEP` | ✅ | Used by FOR loop |
| `DO` | ✅ | Optional after WHILE condition |
| `WHILE` `ENDWHILE` | ✅ | Optional `DO` accepted |
| `REPEAT` `UNTIL` | ✅ | Post-condition loop parsed |
| `PROCEDURE` `ENDPROCEDURE` | ✅ |
| `FUNCTION` `ENDFUNCTION` `RETURNS` `RETURN` | ✅ |
| `CALL` | ✅ |
| `BYVAL` `BYREF` | ✅ |
| `DIV` `MOD` `AND` `OR` `NOT` | ✅ |
| `OPENFILE` `READFILE` `WRITEFILE` `CLOSEFILE` | ✅ |
| `READ` `WRITE` `APPEND` | ✅ |
| `EOF` | ✅ |
| `RANDOM` `SEEK` `GETRECORD` `PUTRECORD` | ✅ |
| `TYPE` `ENDTYPE` (records) | ✅ |
| `SET` `DEFINE` / enum / pointer TYPE | ✅ |
| `CLASS` `ENDCLASS` `PUBLIC` `PRIVATE` `INHERITS` `SUPER` `NEW` | ✅ |
| Builtin names as soft calls | ✅ | Registry + soft CallExpression; `EOF` primary |

---

## 2. Operators

| Feature | Status |
| --- | --- |
| `←` assignment | ✅ |
| `<-` ASCII assignment | ✅ |
| `+` `-` `*` `/` | ✅ |
| `DIV` `MOD` | ✅ |
| Unary `+` `-` | ✅ |
| `=` `<>` `<` `<=` `>` `>=` | ✅ |
| `AND` `OR` `NOT` | ✅ |
| Parentheses | ✅ |
| `&` concatenation | ✅ |
| `.` member | ✅ |
| `^` pointer (type / address-of / deref) | ✅ |

---

## 3. Data types

| Feature | Status |
| --- | --- |
| Scalar type names in DECLARE / params / RETURNS | ✅ |
| `DATE` type name + `dd/mm/yyyy` literal | ✅ |
| `ARRAY[l:u] OF T` | ✅ |
| Multi-dimensional arrays | ✅ |
| User type names | ✅ |
| Record TYPE … ENDTYPE | ✅ |
| Enum / pointer / set TYPE | ✅ |
| Class types | ✅ |

---

## 4. Built-in functions

| Feature | Status |
| --- | --- |
| `EOF(file)` | ✅ |
| `LENGTH` | ✅ | soft CallExpression |
| `LEFT` | ✅ | PseudoPilot Core |
| `RIGHT` | ✅ |
| `MID` | ✅ |
| `LCASE` / `UCASE` | ✅ |
| `INT` / `RAND` | ✅ |
| DATE helpers (`DAY`/`MONTH`/`YEAR`/`DAYINDEX`/`SETDATE`/`TODAY`) | ✅ |
| Exam-insert registry | 🟡 | Core registry shipped; packs later |

---

## 5. File handling

| Feature | Status |
| --- | --- |
| `OPENFILE … FOR READ\|WRITE\|APPEND` | ✅ |
| `READFILE` | ✅ |
| `WRITEFILE` (WRITE and APPEND opens) | ✅ |
| `CLOSEFILE` | ✅ |
| `EOF(…)` expression | ✅ |
| `OPENFILE … FOR RANDOM` | ✅ |
| `SEEK` / `GETRECORD` / `PUTRECORD` | ✅ |

---

## 6. Array syntax

| Feature | Status |
| --- | --- |
| Declare 1D / multi-D | ✅ |
| Multi-ident declare with array type | ✅ |
| Index expression `A[i]` / `A[i,j]` | ✅ |
| Assign / INPUT / READFILE to index | ✅ |
| Reject `A[1 TO n]` sugar | ✅ | (not part of grammar; would fail parse) |
| Whole-array assign AST | ✅ | Identifier target; shape checked in checker/runtime |

---

## 7. Procedures and functions

| Feature | Status |
| --- | --- |
| `PROCEDURE` / `ENDPROCEDURE` | ✅ |
| `FUNCTION` / `RETURNS` / `ENDFUNCTION` | ✅ |
| Typed parameters (incl. Cambridge grouped `a, b : T`) | ✅ |
| `CALL` with/without args | ✅ |
| `RETURN` in function | ✅ |
| Reject `RETURN` in procedure / top-level | ✅ |
| Reject nested routines | ✅ |
| Function `CallExpression` | ✅ |
| `BYVAL` / `BYREF` | ✅ |
| Empty `()` vs omitted params | ✅ |

---

## 8. Selection

| Feature | Status |
| --- | --- |
| `IF` / `THEN` / `ENDIF` | ✅ |
| `ELSE` | ✅ |
| Nested `IF` | ✅ |
| `ELSE IF` (same-line rule) | ✅ |
| Newlines/comments before `THEN` | ✅ |
| `CASE OF` / `OTHERWISE` / `ENDCASE` | ✅ |
| CASE ranges `a TO b` | ✅ |

---

## 9. Iteration

| Feature | Status |
| --- | --- |
| `FOR` / `TO` / `NEXT` | ✅ | Bare `NEXT` OK |
| `STEP` | ✅ |
| `WHILE` / `DO` / `ENDWHILE` | ✅ |
| `REPEAT` / `UNTIL` | ✅ |

---

## 10. Expressions

| Feature | Status |
| --- | --- |
| Arithmetic / relational / logical | ✅ |
| Identifier primary | ✅ |
| Call primary / postfix | ✅ |
| Index postfix | ✅ |
| Precedence (Pratt) | ✅ |
| `&` concat | ✅ |
| Member / pointer expressions | ✅ |

---

## 11. Literals

| Feature | Status |
| --- | --- |
| Integer | ✅ |
| Real | ✅ | `.5`/`5.` → `W_REAL_LITERAL`; `strictCambridge` → `E_REAL_LITERAL` |
| String `"…"` | ✅ |
| Boolean | ✅ |
| Char `'…'` | ✅ |
| Date literal | ✅ |

---

## 12. Grammar / parser infrastructure

| Feature | Status |
| --- | --- |
| Recursive descent statements | ✅ |
| Pratt expressions | ✅ |
| Line-oriented `expectStatementEnd` | ✅ |
| Diagnostics with codes/spans | ✅ |
| Comments `//` | ✅ |
| Trailing-comma / glue-token hardening | ✅ |
| Full grammar per EBNF.md | ✅ | Core + Extended TYPE/CLASS/files |

---

## 13. Ambiguity resolutions (parser behaviour)

| Resolution | Status |
| --- | --- |
| `ELSE IF` vs nested IF (newline rule) | ✅ |
| `FOR` file vs loop | ✅ |
| `←` / `<-` | ✅ |
| Case-insensitive keywords | ✅ |
| Optional `DO` on WHILE | ✅ | Accepted when present; not required |
| `NEXT` binder | ✅ | Optional; mismatch → `E_FOR_NEXT_MISMATCH` |

---

## Headline coverage

| Area | Status |
| --- | --- |
| Core declarations, I/O, expressions | ✅ |
| IF selection | ✅ |
| Routines | ✅ |
| Arrays + text files | ✅ |
| Loops | ✅ |
| CASE | ✅ |
| String/numeric builtins | ✅ |
| CONSTANT (literal) | ✅ |
| BYREF | ✅ |
| DATE | ✅ |
| CHAR literals | ✅ |
| TYPE enum / pointer / SET / records | ✅ |
| OOP / random files | ✅ |

**Estimate:** Parser covers Core Paper 2 + Extended TYPE forms + OOP + random files. Semantic analysis is **not** parser coverage — see [`SEMANTICS.md`](./SEMANTICS.md) / `@pseudopilot/checker`. Full-stack conformance: [`../CONFORMANCE.md`](../CONFORMANCE.md).
