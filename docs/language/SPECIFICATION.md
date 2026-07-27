# PseudoPilot Official Language Specification

**Dialect:** Cambridge International Computer Science (9618) pseudocode  
**Status:** Source of truth for parser and bidirectional translator  
**Version:** 1.0 (pre-translation engine)  
**Aligned to:** Cambridge *Pseudocode Guide for Teachers* (9618), 2026 / 2027–2029 editions

---

## 0. Scope and dialect profile

### 0.1 Goal

Define exactly what PseudoPilot accepts as Cambridge-style pseudocode: keywords, operators, types, builtins, file I/O, arrays, routines, selection, iteration, expressions, literals, grammar, and how PseudoPilot resolves Cambridge ambiguities.

### 0.2 Feature tiers

| Tier | Contents | Product intent |
| --- | --- | --- |
| **Core (Paper 2)** | Declarations, constants, arrays, I/O, expressions, IF, CASE, FOR/WHILE/REPEAT, PROCEDURE/FUNCTION, text files, string/numeric builtins | Primary student IDE path |
| **Extended (A Level)** | `TYPE` / `ENDTYPE` (record, enum, pointer, set), random files, OOP (`CLASS` / `INHERITS` / `NEW`) | Supported in the language document; implement after Core |
| **Exam-insert only** | Extra functions printed on a paper insert (e.g. `ASC`, `CHR`, `TO_UPPER`) | Accepted when registered as library stubs; not part of fixed dialect |

### 0.3 Presentation conventions (Cambridge §1)

| Rule | Cambridge | PseudoPilot |
| --- | --- | --- |
| Keywords | Upper-case in exams | Lexer is **case-insensitive** for keywords; IDE may auto-format to upper-case |
| Identifiers | Mixed case; letters, digits, `_`; start with letter | Same; compared **case-insensitive** |
| Indentation | Significant for readability only | **Not** semantically significant |
| Comments | `//` to end of line | Same; multi-line = multiple `//` lines |
| Assignment | `←` | Accepts `←` and ASCII `<-` (compatibility) |

---

## 1. Reserved keywords

Keywords must not be used as identifiers. All are case-insensitive in PseudoPilot.

### 1.1 Declarations and types

| Keyword | Role | Parser | Notes |
| --- | --- | --- | --- |
| `DECLARE` | Variable declaration | ✅ | Scalars + arrays |
| `CONSTANT` | Named constant | ❌ | Value must be a literal |
| `INTEGER` | Type name | ✅ | |
| `REAL` | Type name | ✅ | |
| `CHAR` | Type name | ✅ | |
| `STRING` | Type name | ✅ | |
| `BOOLEAN` | Type name | ✅ | |
| `DATE` | Type name | ❌ | |
| `ARRAY` | Array type constructor | ✅ | |
| `OF` | Part of `ARRAY[…] OF Type` and `CASE OF` | ✅ | |
| `TYPE` | User-defined type | ❌ | Extended |
| `ENDTYPE` | End of composite type | ❌ | Extended |
| `SET` | Set type | ❌ | Extended |
| `DEFINE` | Set instance | ❌ | Extended |

### 1.2 Literals / booleans

| Keyword | Role | Parser |
| --- | --- | --- |
| `TRUE` | Boolean literal | ✅ |
| `FALSE` | Boolean literal | ✅ |

### 1.3 Input / output

| Keyword | Role | Parser |
| --- | --- | --- |
| `INPUT` | Read into variable / array element | ✅ |
| `OUTPUT` | Write values | ✅ |

### 1.4 Selection

| Keyword | Role | Parser |
| --- | --- | --- |
| `IF` | Conditional | ✅ |
| `THEN` | Then-branch | ✅ |
| `ELSE` | Else-branch / start of `ELSE IF` | ✅ |
| `ENDIF` | End IF | ✅ |
| `CASE` | Multi-way selection | ✅ |
| `OF` | `CASE OF` / `ARRAY … OF` | ✅ |
| `OTHERWISE` | Default CASE arm | ✅ |
| `ENDCASE` | End CASE | ✅ |

### 1.5 Iteration

| Keyword | Role | Parser |
| --- | --- | --- |
| `FOR` | Count-controlled loop **or** file open mode connector | ✅ | Loop ✅; file `FOR` ✅ |
| `TO` | FOR upper bound | ✅ | |
| `STEP` | FOR increment | ✅ | |
| `NEXT` | End FOR | ✅ | |
| `WHILE` | Pre-condition loop | ✅ |
| `DO` | Optional after WHILE condition | ✅ |
| `ENDWHILE` | End WHILE | ✅ |
| `REPEAT` | Post-condition loop | ✅ |
| `UNTIL` | REPEAT terminator | ✅ |

### 1.6 Procedures and functions

| Keyword | Role | Parser |
| --- | --- | --- |
| `PROCEDURE` | Procedure declaration | ✅ |
| `ENDPROCEDURE` | End procedure | ✅ |
| `FUNCTION` | Function declaration | ✅ |
| `ENDFUNCTION` | End function | ✅ |
| `RETURNS` | Function return type | ✅ |
| `RETURN` | Return value (functions only) | ✅ |
| `CALL` | Call a procedure | ✅ |
| `BYVAL` | Pass by value | ❌ |
| `BYREF` | Pass by reference | ❌ |

### 1.7 File handling

| Keyword | Role | Parser |
| --- | --- | --- |
| `OPENFILE` | Open file | ✅ |
| `CLOSEFILE` | Close file | ✅ |
| `READFILE` | Read line | ✅ |
| `WRITEFILE` | Write line | ✅ |
| `READ` | Open mode | ✅ |
| `WRITE` | Open mode | ✅ |
| `APPEND` | Open mode | ✅ |
| `EOF` | End-of-file test | ✅ |
| `RANDOM` | Random-file open mode | ❌ |
| `SEEK` | Move file pointer | ❌ |
| `GETRECORD` | Read record | ❌ |
| `PUTRECORD` | Write record | ❌ |

### 1.8 Operators as keywords

| Keyword | Role | Parser |
| --- | --- | --- |
| `DIV` | Integer division | ✅ |
| `MOD` | Remainder | ✅ |
| `AND` | Logical and | ✅ |
| `OR` | Logical or | ✅ |
| `NOT` | Logical not | ✅ |

### 1.9 Built-in function names (reserved as library)

These are identifiers with special semantics; PseudoPilot treats them as **builtin callables**, not user redefinition targets.

| Name | Parser |
| --- | --- |
| `LENGTH` | ❌ |
| `RIGHT` | ❌ |
| `MID` | ❌ |
| `LCASE` | ❌ |
| `UCASE` | ❌ |
| `INT` | ❌ |
| `RAND` | ❌ |
| `EOF` | ✅ |

### 1.10 Object-oriented / A Level (Extended)

| Keyword | Role | Parser |
| --- | --- | --- |
| `CLASS` | Class definition | ❌ |
| `ENDCLASS` | End class | ❌ |
| `PUBLIC` | Access | ❌ |
| `PRIVATE` | Access | ❌ |
| `INHERITS` | Inheritance | ❌ |
| `SUPER` | Parent call | ❌ |
| `NEW` | Constructor / instantiation | ❌ |

### 1.11 Complete reserved word index (alphabetical)

```
AND, APPEND, ARRAY, BOOLEAN, BYREF, BYVAL, CALL, CASE, CHAR, CLASS,
CLOSEFILE, CONSTANT, DATE, DECLARE, DEFINE, DIV, DO, ELSE, ENDCASE,
ENDCLASS, ENDFUNCTION, ENDIF, ENDPROCEDURE, ENDTYPE, ENDWHILE, EOF,
FALSE, FOR, FUNCTION, GETRECORD, IF, INHERITS, INPUT, INT, INTEGER,
LCASE, LENGTH, MID, MOD, NEXT, NEW, NOT, OF, OPENFILE, OR, OTHERWISE,
OUTPUT, PRIVATE, PROCEDURE, PUBLIC, PUTRECORD, RAND, RANDOM, READ,
READFILE, REAL, REPEAT, RETURN, RETURNS, RIGHT, SEEK, SET, STEP,
STRING, SUPER, THEN, TO, TRUE, TYPE, UCASE, UNTIL, WHILE, WRITE,
WRITEFILE
```

*(Plus symbols that are not words: see §2.)*

---

## 2. Operators

### 2.1 Assignment

| Operator | Meaning | Parser |
| --- | --- | --- |
| `←` | Assign | ✅ |
| `<-` | Assign (ASCII alias) | ✅ |

`=` is **never** assignment.

### 2.2 Arithmetic

| Operator | Meaning | Result | Parser |
| --- | --- | --- | --- |
| `+` | Addition / unary plus | Numeric | ✅ |
| `-` | Subtraction / unary minus | Numeric | ✅ |
| `*` | Multiplication | Numeric | ✅ |
| `/` | Division | Always **REAL** (Cambridge) | ✅ |
| `DIV` | Integer quotient | INTEGER | ✅ |
| `MOD` | Remainder | INTEGER | ✅ |

Exponentiation is **not** a Cambridge arithmetic operator in the guide. The caret `^` is reserved for **pointer type syntax** (`TYPE P = ^INTEGER`), not power.

### 2.3 Relational (result always BOOLEAN)

| Operator | Meaning | Parser |
| --- | --- | --- |
| `=` | Equal | ✅ |
| `<>` | Not equal | ✅ |
| `<` | Less than | ✅ |
| `<=` | Less than or equal | ✅ |
| `>` | Greater than | ✅ |
| `>=` | Greater than or equal | ✅ |

### 2.4 Logical

| Operator | Meaning | Parser |
| --- | --- | --- |
| `AND` | Conjunction | ✅ |
| `OR` | Disjunction | ✅ |
| `NOT` | Negation (prefix) | ✅ |

### 2.5 String

| Operator | Meaning | Parser |
| --- | --- | --- |
| `&` | Concatenation | ❌ |

### 2.6 Member / pointer (Extended)

| Operator | Meaning | Parser |
| --- | --- | --- |
| `.` | Record / object field or method | ❌ |
| `^` | Pointer type / dereference (context-dependent) | ❌ |

### 2.7 Precedence and associativity

From highest to lowest (PseudoPilot Pratt table):

| Level | Operators | Associativity |
| --- | --- | --- |
| 1 | `(…)` grouping; calls `F(…)`; indexing `A[…]` | — |
| 2 | Unary `+` `-` `NOT` | Right |
| 3 | `*` `/` `DIV` `MOD` | Left |
| 4 | `+` `-` `&` | Left |
| 5 | `<` `<=` `>` `>=` `=` `<>` | Left (non-chain preferred) |
| 6 | `AND` | Left |
| 7 | `OR` | Left |

**Ambiguity resolution:** Cambridge advises parentheses for complex expressions. PseudoPilot will **not** allow chained comparisons like `1 < x < 10` as a single Boolean of range membership; each relational combines two operands only. Prefer `x > 1 AND x < 10`.

---

## 3. Data types

### 3.1 Built-in scalar types

| Type | Meaning | Parser (as type name) |
| --- | --- | --- |
| `INTEGER` | Whole number | ✅ |
| `REAL` | Fractional number | ✅ |
| `CHAR` | Single character | ✅ |
| `STRING` | Character sequence | ✅ |
| `BOOLEAN` | `TRUE` / `FALSE` | ✅ |
| `DATE` | Calendar date | ❌ |

### 3.2 Array types

See §6. Fixed-length, homogeneous elements, consecutive integer indices.

### 3.3 User-defined types (Extended)

| Form | Purpose | Parser |
| --- | --- | --- |
| Enumerated `TYPE Name = (A, B, C)` | Named enum values | ❌ |
| Pointer `TYPE Name = ^BaseType` | Address of BaseType | ❌ |
| Record `TYPE Name` … `ENDTYPE` | Composite fields | ❌ |
| Set `TYPE Name = SET OF T` + `DEFINE` | Set values | ❌ |

### 3.4 Class types (Extended / OOP)

`CLASS` … `ENDCLASS` with `PUBLIC` / `PRIVATE` members — ❌

---

## 4. Built-in functions

### 4.1 Fixed dialect builtins (Cambridge §5.5–5.6, §9.1)

| Signature | Description | Parser | Runtime |
| --- | --- | --- | --- |
| `LENGTH(ThisString : STRING) RETURNS INTEGER` | Character count | ❌ | ❌ |
| `RIGHT(ThisString : STRING, x : INTEGER) RETURNS STRING` | Rightmost `x` chars | ❌ | ❌ |
| `MID(ThisString : STRING, x : INTEGER, y : INTEGER) RETURNS STRING` | Substring length `y` from position `x` (1-based) | ❌ | ❌ |
| `LCASE(ThisChar : CHAR) RETURNS CHAR` | Lower-case letter | ❌ | ❌ |
| `UCASE(ThisChar : CHAR) RETURNS CHAR` | Upper-case letter | ❌ | ❌ |
| `INT(x : REAL) RETURNS INTEGER` | Truncate toward zero (integer part) | ❌ | ❌ |
| `RAND(x : INTEGER) RETURNS REAL` | Random in `[0, x)` | ❌ | ❌ |
| `EOF(FileId) RETURNS BOOLEAN` | No more lines to read | ✅ | ❌ |

**Notes**

- String positions are **1-based** (Cambridge `MID` examples).
- `LCASE` / `UCASE` in the teacher guide take **CHAR**; exams sometimes allow STRING via insert — see §13.
- There is **no** standard `LEFT` in the teacher guide index; if an exam provides it, treat as insert.

### 4.2 Exam-insert builtins

Paper 2 inserts may define additional functions (`ASC`, `CHR`, `IS_NUM`, `TO_UPPER`, …). PseudoPilot will:

1. Ship a **builtin registry** for the fixed dialect (§4.1).
2. Allow an exam/library pack to register extra names with signatures.
3. Never invent undocumented builtins in generated translation by default.

---

## 5. File handling

### 5.1 Text files (Core)

| Statement | Form | Parser |
| --- | --- | --- |
| Open | `OPENFILE <file> FOR READ \| WRITE \| APPEND` | ✅ |
| Read line | `READFILE <file>, <assignTarget>` | ✅ |
| Write line | `WRITEFILE <file>, <expression>` | ✅ |
| Close | `CLOSEFILE <file>` | ✅ |
| EOF test | `EOF(<file>)` | ✅ |

**Semantics (Cambridge)**

- `READ` — sequential read; required before `READFILE`.
- `WRITE` — create/truncate; then `WRITEFILE`.
- `APPEND` — write after existing data; still uses `WRITEFILE` (no separate append statement).
- One mode at a time per open.
- `READFILE` assigns one line (`STRING`) to the target.
- `EOF` is `TRUE` when no more lines (including empty file in `READ` mode).

**PseudoPilot file identifiers:** expression evaluating to `STRING` (literal or variable). Paths are opaque strings to the language; sandboxing is a runtime concern.

### 5.2 Random files (Extended)

| Statement | Form | Parser |
| --- | --- | --- |
| Open | `OPENFILE <file> FOR RANDOM` | ❌ |
| Seek | `SEEK <file>, <address>` | ❌ |
| Get | `GETRECORD <file>, <variable>` | ❌ |
| Put | `PUTRECORD <file>, <expression>` | ❌ |

---

## 6. Array syntax rules

### 6.1 Declaration

```
DECLARE <Ident> ("," <Ident>)* ":" ARRAY "[" <dim> ("," <dim>)* "]" OF <TypeName>
dim = <expression> ":" <expression>   // lower : upper inclusive
```

| Rule | Cambridge / PseudoPilot |
| --- | --- |
| Dimensions | 1D and 2D required by syllabus; PseudoPilot allows **N-D** with comma-separated bounds |
| Bounds | Explicit lower and upper; inclusive; typically `1:n` |
| Element type | Scalar type name (or later user-defined type) |
| Multiple names | `DECLARE A, B : ARRAY[1:10] OF INTEGER` — same type for all | ✅ |

Parser status: ✅

### 6.2 Element access

```
<Ident> "[" <expression> ("," <expression>)* "]"
```

- Index expressions must evaluate to `INTEGER`.
- Valid as **r-value** and **assign target** (`INPUT`, `READFILE`, `←`).
- Array **whole-value** assignment (`A ← B` when same shape/type) is Cambridge-allowed — ❌ not yet modelled as assign of ArrayRef.

### 6.3 Forbidden sugar

Cambridge forbids range assignment such as `Names[1 TO 30] ← ""`. PseudoPilot **rejects** `TO` inside index lists.

### 6.4 Nested arrays of arrays

Not in Cambridge style. Use multi-dimensional `ARRAY[1:n, 1:m] OF T`.

---

## 7. Procedure and function rules

### 7.1 Procedures

```
PROCEDURE <Name> "(" <paramList>? ")"
    <statements>
ENDPROCEDURE

CALL <Name> "(" <args>? ")"
CALL <Name>                    // empty args — Cambridge allows CALL Name()
```

| Rule | PseudoPilot |
| --- | --- |
| Parameters typed `Name : Type` | ✅ |
| Nested procedure declarations | ❌ Rejected (`E_NESTED_ROUTINE`) |
| `RETURN` inside procedure | ❌ Rejected |
| Default parameter mode | By value (Cambridge) |
| Explicit `BYVAL` / `BYREF` | ❌ Not parsed yet |
| `BYREF` only on procedures | Cambridge: not on functions |

### 7.2 Functions

```
FUNCTION <Name> "(" <paramList>? ")" RETURNS <TypeName>
    <statements>
ENDFUNCTION
```

| Rule | PseudoPilot |
| --- | --- |
| Must use `RETURN <expr>` | ✅ (syntax); semantic “all paths return” → typechecker later |
| Called as **expression** `F(args)` not `CALL F` | ✅ `CallExpression` |
| Recursion | ✅ (AST allows self-call; runtime later) |
| Nested function declarations | ❌ Rejected |

### 7.3 Parameters

```
paramList = param ("," param)*
param     = ["BYVAL" | "BYREF"] Ident ":" TypeName
```

Today: only `Ident ":" TypeName` ✅  
`BYVAL`/`BYREF` ❌

### 7.4 DECLARE scope

- Global `DECLARE` at program top level — ✅
- Local `DECLARE` inside routine bodies — ✅ (parse)
- Shadowing / redefinition — diagnostic later (❌ semantic)

---

## 8. Selection statements

### 8.1 IF

Cambridge forms:

```
IF <condition> THEN
    <statements>
ENDIF

IF <condition> THEN
    <statements>
ELSE
    <statements>
ENDIF
```

PseudoPilot additionally accepts **ELSE IF** (same `ENDIF`):

```
IF <c1> THEN
    …
ELSE IF <c2> THEN
    …
ELSE
    …
ENDIF
```

| Rule | Detail | Parser |
| --- | --- | --- |
| Condition | Boolean expression | ✅ |
| Nested IF | Own `ENDIF` each | ✅ |
| `ELSE IF` | `IF` must follow `ELSE` with **no newline** between | ✅ |
| Newline after `ELSE` then `IF` | Nested IF inside else block | ✅ |
| No `ELSEIF` single keyword | Use `ELSE IF` two words | ✅ |

Cambridge guide encourages nested IF or CASE rather than a dedicated elseif keyword. PseudoPilot’s `ELSE IF` is a **compatibility extension** (§13.1).

### 8.2 CASE

```
CASE OF <expression>
    <label> : <statement>
    …
    <low> TO <high> : <statement>
    OTHERWISE : <statement>
ENDCASE
```

| Rule | Detail | Parser |
| --- | --- | --- |
| Arms tested in order | First match wins; then exit CASE | ✅ |
| Ranges | `low TO high` | ✅ |
| `OTHERWISE` | Must be last if present | ✅ |
| Body per arm | Typically one statement; PseudoPilot will allow a block until next label | ✅ |

---

## 9. Iteration statements

### 9.1 FOR (count-controlled)

```
FOR <Ident> ← <start> TO <end> [STEP <increment>]
    <statements>
NEXT <Ident>
```

| Rule | Detail | Parser |
| --- | --- | --- |
| Control variable | `INTEGER` | ❌ |
| Inclusive range | Runs if `start <= end` with positive step; empty if `start > end` (default step +1) | ❌ |
| `STEP` | May be negative | ✅ |
| `NEXT` identifier | Required in PseudoPilot (Cambridge: good practice) | ✅ |

### 9.2 REPEAT … UNTIL (post-condition)

```
REPEAT
    <statements>
UNTIL <condition>
```

Body runs at least once; exit when condition is `TRUE`. Parser ✅

### 9.3 WHILE … [DO] … ENDWHILE (pre-condition)

```
WHILE <condition>
    <statements>
ENDWHILE

WHILE <condition> DO
    <statements>
ENDWHILE
```

| Rule | Detail | Parser |
| --- | --- | --- |
| Condition tested before body | Skip body if initially false | ✅ |
| `DO` keyword | **Optional** (Teacher Guide omits; exams often include) | ✅ |

> PseudoPilot accepts both forms. The Cambridge printer emits `DO` for a stable exam-style surface.

---

## 10. Expression rules

### 10.1 Forms

An expression is one of:

| Form | Example | Parser |
| --- | --- | --- |
| Literal | `3`, `2.5`, `"hi"`, `'A'`, `TRUE` | 🟡 CHAR literal ❌ |
| Identifier | `Count` | ✅ |
| Unary | `-x`, `NOT Flag` | ✅ |
| Binary | `a + b`, `x DIV y`, `p AND q` | ✅ |
| Grouping | `(a + b) * c` | ✅ |
| Call | `Max(a, b)`, `LENGTH(s)` | 🟡 user funcs ✅; builtins mostly ❌ |
| Index | `Grid[i, j]` | ✅ |
| Member | `Pupil.LastName` | ❌ |
| Pointer | `MyPtr^`, `^Var` | ❌ |
| Concat | `a & b` | ❌ |
| EOF | `EOF(path)` | ✅ |

### 10.2 Typing (semantic; mostly future)

- Operands of `DIV`/`MOD` should be integers.
- `/` yields `REAL`.
- Relational operands: same “comparable” type; INT/REAL may mix; CHAR/STRING may mix per Cambridge notes.
- Logical operands: `BOOLEAN`.
- Function call arity/types checked later.

### 10.3 Statement vs expression

| Construct | Kind |
| --- | --- |
| `CALL P(…)` | Statement only |
| `F(…)` | Expression (and thus may appear in `OUTPUT`, assignment, conditions) |
| Assignment | Statement |

---

## 11. Literal types

| Kind | Syntax | Parser | Notes |
| --- | --- | --- | --- |
| Integer | Optional `-`, digits | ✅ | Unary minus separate for expressions |
| Real | Digits on **both** sides of `.` per Cambridge (`4.7`, `0.3`, `-4.0`) | 🟡 | Lexer may accept variants; enforce on harden |
| String | `"…"` double quotes; `""` empty | ✅ | Escape policy: minimal (`\\`, `\"`) TBD |
| Char | `'x'` single quotes | ❌ | Not yet distinct from identifiers/strings |
| Boolean | `TRUE`, `FALSE` | ✅ | |
| Date | typically `dd/mm/yyyy` | ❌ | Prefer `DECLARE d : DATE` + explicit format comments |

---

## 12. Grammar rules (narrative)

### 12.1 Program

A **program** is a sequence of top-level statements and declarations (including routine declarations). No mandatory `PROGRAM` keyword.

```
program = { statement | routineDecl }
```

### 12.2 Statements (Core)

```
statement =
    declareStmt
  | constantStmt          (* future *)
  | assignStmt
  | inputStmt
  | outputStmt
  | ifStmt
  | caseStmt              (* future *)
  | forStmt               (* future *)
  | whileStmt
  | repeatStmt
  | callStmt
  | returnStmt
  | openFileStmt
  | readFileStmt
  | writeFileStmt
  | closeFileStmt
  | typeDecl              (* Extended *)
  | classDecl             (* Extended *)
```

### 12.3 Line orientation

PseudoPilot is **line-oriented**:

- A statement ends at newline (or EOF), except where a construct continues (`THEN` body, `ELSE`, loop bodies).
- Blank lines and `//` comments are ignorable between structural tokens where documented (e.g. skip newlines before `THEN`).

### 12.4 Blocks

A **block** is zero or more statements until a terminator keyword (`ENDIF`, `ENDWHILE`, `NEXT`, `UNTIL`, `ENDPROCEDURE`, `ENDFUNCTION`, `ENDCASE`, …).

### 12.5 Full EBNF

See [EBNF.md](./EBNF.md).

---

## 13. Ambiguities and PseudoPilot resolutions

Cambridge’s guide is a **style guide for exams**, not a formal grammar. Ambiguities are resolved here so the parser and translator stay deterministic.

### 13.1 `ELSE IF` vs nested `IF`

| Source | Stance |
| --- | --- |
| Cambridge | Shows nested `IF`/`ENDIF`; no dedicated `ELSEIF` |
| Exams / teaching | Often write `ELSE IF` on one line |

**PseudoPilot:** Accept `ELSE IF` as elseif when `IF` is on the **same line** as `ELSE`. A newline after `ELSE` starts a nested statement list (which may contain `IF`).

### 13.2 `WHILE` and `DO`

| Source | Stance |
| --- | --- |
| Teacher Guide examples | Often `WHILE <cond>` … `ENDWHILE` (no `DO`) |
| Exam practice | Frequently `WHILE <cond> DO` … `ENDWHILE` |

**PseudoPilot:** `DO` is **optional** on input. Printers emit `DO`.

### 13.3 `NEXT` identifier

| Source | Stance |
| --- | --- |
| Cambridge | “Good practice” to repeat the variable |

**PseudoPilot:** **Required** — `NEXT i` must match the `FOR i` binder (diagnostic if mismatch).

### 13.4 Keyword `FOR` dual use

`FOR` begins a loop **or** appears in `OPENFILE … FOR READ`.

**PseudoPilot:** After `OPENFILE <expr>`, `FOR` starts a file mode. Elsewhere, `FOR` begins a count loop. Never `OPENFILE … FOR TO`.

### 13.5 Assignment arrows

Exams use `←`. Keyboards often lack it.

**PseudoPilot:** `←` and `<-` are equivalent. `=` remains comparison only.

### 13.6 Case sensitivity

Cambridge: identifiers should be treated as case-insensitive; keywords upper-case in print.

**PseudoPilot:** Keywords and identifiers are case-insensitive. Binding uses a canonical casing from first declaration when reporting errors.

### 13.7 Parameters without `BYVAL`/`BYREF`

Unspecified → **by value**. Functions must not use `BYREF` (semantic error when implemented).

### 13.8 String indexing / `&`

No Cambridge string indexing with `[]`. Use `MID` / `RIGHT` / `LENGTH`. Concatenation is `&` only (not `+`).

**PseudoPilot:** `+` on strings is a **type error** (once typing lands), not silent concat.

### 13.9 Real literals

Cambridge requires a digit on both sides of `.`.

**PseudoPilot:** Accept `.5` and `5.` with a **warning**, normalize AST to `0.5` / `5.0`, or reject in strict mode (`--strict-cambridge`).

### 13.10 Array lower bounds

Not fixed to 0 or 1.

**PseudoPilot:** Bounds are whatever the declaration states; runtime checks `lower ≤ index ≤ upper`.

### 13.11 Whole-array assignment

Cambridge allows `Saved ← Board` for same shape.

**PseudoPilot:** Supported at runtime later; parser currently requires assign targets that are identifier or index (identifier alone is fine as target — runtime decides if array-valued).

### 13.12 Character vs string quotes

`CHAR` → single quotes; `STRING` → double quotes.

**PseudoPilot:** Will enforce when CHAR literals are implemented. Until then, only double-quoted strings exist (🟡).

### 13.13 Comments inside statements

`//` ends the line. No block comments.

### 13.14 Empty procedure parameter lists

Cambridge shows `PROCEDURE Name()`.

**PseudoPilot:** Accept `PROCEDURE Name` and `PROCEDURE Name()` equivalently; same for `CALL`.

### 13.15 `OUTPUT` arity

Multiple comma-separated values.

**PseudoPilot:** ✅ (`OUTPUT a, b, c`). Runtime concatenates with system separator (space by default).

### 13.16 Indentation

Ignored for structure. Structure comes from keywords and newlines.

### 13.17 OOP / TYPE / random files

Documented in this specification as **Extended**. Core dialect is complete without them. Product roadmap implements Core first.

### 13.18 Exam inserts vs fixed builtins

Fixed builtins are §4.1. Anything else requires an insert pack. The translator must not invent Python helpers for unknown names without that pack.

---

## Document control

| Item | Value |
| --- | --- |
| Owners | PseudoPilot language-core |
| Change policy | Spec change before parser change |
| Related | [EBNF.md](./EBNF.md), [PARSER_COVERAGE.md](./PARSER_COVERAGE.md), [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md) |
