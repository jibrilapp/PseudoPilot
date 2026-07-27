# Parser coverage checklist

**Package:** `@pseudopilot/language-core`  
**Spec:** [SPECIFICATION.md](./SPECIFICATION.md)  
**Legend:** ✅ Implemented · 🟡 Partially implemented · ❌ Not implemented

This checklist is about **lexer + parser + AST** only (not interpreter or translator).

---

## 1. Reserved keywords

| Feature | Status | Notes |
| --- | --- | --- |
| Keyword table (core set) | 🟡 | Core control-flow / routines present; Extended / OOP / many builtins missing |
| Case-insensitive keywords | ✅ | |
| Reject keywords as identifiers | 🟡 | Lexed as keywords; edge cases TBD |

### Keyword inventory

| Keyword | Status |
| --- | --- |
| `DECLARE` | ✅ |
| `CONSTANT` | ✅ |
| `INTEGER` `REAL` `CHAR` `STRING` `BOOLEAN` | ✅ |
| `DATE` | ❌ |
| `ARRAY` `OF` | ✅ |
| `TRUE` `FALSE` | ✅ |
| `INPUT` `OUTPUT` | ✅ |
| `IF` `THEN` `ELSE` `ENDIF` | ✅ |
| `CASE` `OTHERWISE` `ENDCASE` | ✅ |
| `FOR` (loop) | ✅ |
| `FOR` (file mode connector) | ✅ |
| `TO` `NEXT` | ✅ | Used by FOR loop |
| `STEP` | ✅ | Used by FOR loop |
| `DO` | ✅ | Optional after WHILE condition |
| `WHILE` `ENDWHILE` | ✅ | Optional `DO` accepted |
| `REPEAT` `UNTIL` | ✅ | Post-condition loop parsed |
| `PROCEDURE` `ENDPROCEDURE` | ✅ |
| `FUNCTION` `ENDFUNCTION` `RETURNS` `RETURN` | ✅ |
| `CALL` | ✅ |
| `BYVAL` `BYREF` | ❌ |
| `DIV` `MOD` `AND` `OR` `NOT` | ✅ |
| `OPENFILE` `READFILE` `WRITEFILE` `CLOSEFILE` | ✅ |
| `READ` `WRITE` `APPEND` | ✅ |
| `EOF` | ✅ |
| `RANDOM` `SEEK` `GETRECORD` `PUTRECORD` | ❌ |
| `TYPE` `ENDTYPE` `SET` `DEFINE` | ❌ |
| `CLASS` `ENDCLASS` `PUBLIC` `PRIVATE` `INHERITS` `SUPER` `NEW` | ❌ |
| Builtin names as reserved calls | 🟡 | Only `EOF` special-cased |

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
| `.` member | ❌ |
| `^` pointer | ❌ |

---

## 3. Data types

| Feature | Status |
| --- | --- |
| Scalar type names in DECLARE / params / RETURNS | ✅ |
| `DATE` type name | ❌ |
| `ARRAY[l:u] OF T` | ✅ |
| Multi-dimensional arrays | ✅ |
| User type names | ❌ |
| Enum / pointer / record / set | ❌ |
| Class types | ❌ |

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
| `OPENFILE … FOR RANDOM` | ❌ |
| `SEEK` / `GETRECORD` / `PUTRECORD` | ❌ |

---

## 6. Array syntax

| Feature | Status |
| --- | --- |
| Declare 1D / multi-D | ✅ |
| Multi-ident declare with array type | ✅ |
| Index expression `A[i]` / `A[i,j]` | ✅ |
| Assign / INPUT / READFILE to index | ✅ |
| Reject `A[1 TO n]` sugar | ✅ | (not part of grammar; would fail parse) |
| Whole-array assign AST special-case | 🟡 | Identifier target OK; no shape check |

---

## 7. Procedures and functions

| Feature | Status |
| --- | --- |
| `PROCEDURE` / `ENDPROCEDURE` | ✅ |
| `FUNCTION` / `RETURNS` / `ENDFUNCTION` | ✅ |
| Typed parameters | ✅ |
| `CALL` with/without args | ✅ |
| `RETURN` in function | ✅ |
| Reject `RETURN` in procedure / top-level | ✅ |
| Reject nested routines | ✅ |
| Function `CallExpression` | ✅ |
| `BYVAL` / `BYREF` | ❌ |
| Empty `()` vs omitted params | 🟡 | Verify both forms in tests |

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
| `FOR` / `TO` / `NEXT` | ✅ |
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
| Member / pointer expressions | ❌ |

---

## 11. Literals

| Feature | Status |
| --- | --- |
| Integer | ✅ |
| Real | 🟡 | Strict digit-both-sides not fully enforced |
| String `"…"` | ✅ |
| Boolean | ✅ |
| Char `'…'` | ✅ |
| Date literal | ❌ |

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
| Full grammar per EBNF.md | 🟡 | Core subset matches except Extended / routines depth |

---

## 13. Ambiguity resolutions (parser behaviour)

| Resolution | Status |
| --- | --- |
| `ELSE IF` vs nested IF (newline rule) | ✅ |
| `FOR` file vs loop | 🟡 | File path ✅; loop ❌ |
| `←` / `<-` | ✅ |
| Case-insensitive keywords | ✅ |
| Optional `DO` on WHILE | ✅ | Accepted when present; not required |
| Require `NEXT` binder match | ❌ | Not implemented yet |

---

## Headline coverage

| Area | Status |
| --- | --- |
| Core declarations, I/O, expressions | ✅ |
| IF selection | ✅ |
| Routines | ✅ |
| Arrays + text files | ✅ |
| Loops | 🟡 |
| CASE | ✅ |
| String/numeric builtins (except EOF) | ✅ |
| CONSTANT (literal) | ✅ |
| BYREF / DATE | ❌ |
| Extended TYPE / OOP / random files | ❌ |

**Estimate:** Core Paper 2 surface covers selection, iteration, PROCEDURE/CALL, FUNCTION/RETURN, DECLARE/CONSTANT, Core builtins + `&`. Semantic analysis is **not** parser coverage — see [`SEMANTICS.md`](./SEMANTICS.md) / `@pseudopilot/checker`. Still blocked on BYREF, file I/O runtime, and exam-insert packs.
