# Semantic analysis (Cambridge 9618)

**Package:** `@pseudopilot/checker`  
**Pipeline position:** Lexer → Parser → AST → **Semantic Checker** → IR → Translator → Interpreter

The checker validates programs **after parsing** and **before** IR lowering / translation / execution. It does **not** live inside the parser or the translator’s Python-target rules.

---

## 1. Responsibilities

| Owns | Does not own |
| --- | --- |
| Symbol tables & lexical scopes | Lexing / parsing |
| DECLARE / CONSTANT / parameter bindings | Python keyword legality (`T_DECL_PY_KEYWORD`) |
| PROCEDURE / FUNCTION / **builtin** signatures | Unsupported-construct translation (`T_UNSUPPORTED_*`) |
| Type compatibility of assignments & calls | Runtime evaluation / RNG seeding |
| Undeclared identifiers / routines | Layout / trivia |

Builtins are soft-reserved via `CORE_BUILTINS` in `@pseudopilot/language-core` (injected into the global scope before user routines).

---

## 2. Scopes

| Scope | Contents |
| --- | --- |
| **Global** | Top-level DECLARE, CONSTANT, PROCEDURE, FUNCTION |
| **Routine** | Parameters + local DECLARE / CONSTANT inside PROCEDURE / FUNCTION |

**Control-flow** (`IF` / `WHILE` / `FOR` / …) does **not** introduce declaration scopes. A `DECLARE` inside an `IF` still binds in the enclosing routine/global scope (Cambridge-style flat locals).

### Shadowing

- Locals **may** shadow globals (including CONSTANT shadowed by a local DECLARE).
- Duplicate names **in the same scope** are errors (`C_DUP_*`).
- PROCEDURE / FUNCTION names are **hoisted** in the global scope so `CALL` before definition is allowed.

### Case sensitivity

Identifiers are **case-insensitive** (Cambridge / SPECIFICATION §13.6).  
`Count`, `count`, and `COUNT` refer to the same binding. The checker keeps **first-declaration casing** in `globalSymbols` and diagnostics help text.

When translating to Python (case-sensitive), the lowerer **rewrites** uses to that first-declaration spelling so generated code does not raise `NameError`.

### FOR variables

If the FOR control variable is not yet bound, the checker **implicitly** introduces an `INTEGER` variable (common Cambridge teaching style). Using a CONSTANT as a FOR variable is an error. A declared control variable must be **INTEGER** (Cambridge 9618); REAL / ARRAY / routines are rejected (`C_FOR_VAR_TYPE`).

---

## 3. Types

Scalars: `INTEGER`, `REAL`, `STRING`, `BOOLEAN`, `CHAR`, `DATE`  
Arrays: `ARRAY[…] OF <scalar>` (dimensionality checked on indexing)

Cambridge 9618 does not define a standalone `TIME` datatype; PseudoPilot does not invent one.

### Assignment compatibility

| From → To | Allowed? |
| --- | --- |
| Same scalar | ✅ |
| `INTEGER` → `REAL` | ✅ (implicit widening) |
| `REAL` → `INTEGER` | ❌ (use `INT(...)`) |
| `CHAR` ↔ `STRING` | ❌ (distinct) |
| `DATE` ↔ other scalars | ❌ (use `SETDATE` / component builtins) |
| Arrays | ✅ only if element type **and** rank match |

`INPUT` / `READFILE` require an assignable target (declared, not CONSTANT) but do **not** enforce a source type (Cambridge I/O is untyped at the language level).

### Text files

Checker tracks open state for **string-literal** paths (`C_FILE_*`). Dynamic path variables are type-checked only; open/mode errors surface at runtime (`R_FILE_*`). Control-flow insensitive (IF branches are not merged).

### Builtins (Core)

Signatures live in `language-core` `CORE_BUILTINS` (types only). Python emission lives in `translator/src/builtins/emit.ts`. Checker validates arity/types (`C_BUILTIN_ARG_*`).

| Builtin | Returns | Notes |
| --- | --- | --- |
| `LENGTH(s)` | INTEGER | STRING or CHAR (CHAR is PseudoPilot soft extension; guide is STRING) |
| `LEFT(s, n)` / `RIGHT(s, n)` | STRING | LEFT is PseudoPilot Core (exam-insert style; not in teacher-guide index) |
| `MID(s, x, y)` | STRING | **1-based** start `x`, length `y` |
| `LCASE` / `UCASE` | same as arg | Guide: CHAR→CHAR; PseudoPilot also STRING→STRING |
| `INT(x)` | INTEGER | REAL or INTEGER; truncate toward zero |
| `RAND(x)` | **REAL** | `[0, x)`; `x` must be INTEGER |
| `DAY` / `MONTH` / `YEAR` / `DAYINDEX` | INTEGER | DATE insert helpers |
| `SETDATE(d, m, y)` | DATE | Construct calendar date |
| `TODAY()` | DATE | Current calendar date |

DATE values may be compared with `=` / `<>` / `<` / `<=` / `>` / `>=`. Arithmetic on DATE is rejected (`C_BINARY_TYPE`).

Builtin names are **soft-reserved against redefinition** (SPEC §1.9): `DECLARE Length` / `FUNCTION LENGTH` collide with the injected Core builtin (`C_DUP_FUNCTION`).

### String concatenation `&`

Operands must be STRING or CHAR (`C_CONCAT_TYPE`). Result is STRING. Same precedence as `+` / `-`. Do **not** use `+` for strings.

---

## 4. Diagnostic codes (`C_*`)

| Code | Meaning |
| --- | --- |
| `C_DUP_VARIABLE` / `C_DUP_CONSTANT` / `C_DUP_PARAMETER` / `C_DUP_PROCEDURE` / `C_DUP_FUNCTION` | Duplicate binding |
| `C_UNDECL_IDENT` / `C_UNDECL_ARRAY` / `C_UNDECL_ROUTINE` / `C_UNDECL_FUNCTION` | Missing declaration |
| `C_ASSIGN_TO_CONSTANT` / `C_ASSIGN_TO_ROUTINE` / `C_ASSIGN_TYPE` | Bad assignment |
| `C_ARG_COUNT` / `C_ARG_TYPE` | Call mismatch |
| `C_PROC_AS_EXPR` / `C_FUNC_AS_VALUE` / `C_NOT_CALLABLE` | Misused routines |
| `C_RETURN_OUTSIDE` / `C_RETURN_TYPE` / `C_FUNC_NO_RETURN` | RETURN rules |
| `C_ARRAY_RANK` / `C_INDEX_TYPE` / `C_ARRAY_BOUND_TYPE` / `C_NOT_ARRAY` | Arrays |
| `C_FOR_VAR_TYPE` / `C_FOR_BOUND_TYPE` | FOR typing |
| `C_BUILTIN_ARG_COUNT` / `C_BUILTIN_ARG_TYPE` | Builtin call mismatch |
| `C_CONCAT_TYPE` | `&` operand not STRING/CHAR |
| `C_FILE_PATH_TYPE` | File path not STRING/CHAR |
| `C_FILE_NOT_OPEN` / `C_FILE_ALREADY_OPEN` / `C_FILE_MODE` | Open-state (literal paths, best-effort) |
| `C_UNKNOWN_TYPE` / `C_DUP_TYPE` / `C_RECURSIVE_TYPE` | TYPE … ENDTYPE |
| `C_UNKNOWN_FIELD` / `C_DUP_FIELD` / `C_NOT_RECORD` | Record fields |
| `C_UNKNOWN_CLASS` / `C_DUP_CLASS` / `C_INVALID_INHERITS` / `C_CYCLIC_INHERITANCE` | CLASS declaration |
| `C_DUP_MEMBER` / `C_DUP_METHOD` / `C_OVERRIDE_MISMATCH` (warning) | CLASS members |
| `C_NOT_CLASS` / `C_UNKNOWN_METHOD` / `C_PRIVATE_ACCESS` / `C_INVALID_NEW` / `C_SUPER_OUTSIDE` | CLASS usage (`obj.Method(...)`, `NEW`, `SUPER`) |
| `C_COND_TYPE` / `C_BINARY_TYPE` / `C_UNARY_TYPE` / `C_COMPARE_TYPE` | Expression typing |
| `C_CASE_LABEL_TYPE` / `C_CASE_RANGE_TYPE` | CASE (warnings / errors) |
| `C_UNREACHABLE` | Statement after RETURN (warning) |
| `C_TOO_MANY_DIAGNOSTICS` | Soft cap reached (warning) |
| `C_FUNC_NO_RETURN` | FUNCTION body has no RETURN (**error**) |

Parser still owns structural codes (`E_FOR_NEXT_MISMATCH`, `E_CASE_DUP`, …).

---

## 5. Public API

```ts
import { check } from '@pseudopilot/checker';
import { parse } from '@pseudopilot/language-core';

const { ast } = parse(source);
const { ok, diagnostics, globalSymbols } = check(ast);
// Optional: check(ast, { maxDiagnostics: 512 })
```

`globalSymbols` is best-effort even when `ok` is false — for future interpreter / variables panel. Keys are **case-folded** (`identKey` / lowercase); display casing is `SymbolInfo.name`. Prefer `lookupSymbol(globalSymbols, name)`.

`@pseudopilot/translator` runs the checker by default (`TranslateOptions.semanticCheck`, default `true`). Checker `help` is forwarded as `TranslateDiagnostic.help` (not mangled into `message`).

---

## 6. Limitations (honest)

- No path-sensitive “all paths return” analysis (only “any RETURN present”).
- Unreachable-after-RETURN is **same-block** only (including nested IF/loop/CASE bodies); does not prove a branch always returns.
- No definite-assignment / use-before-init beyond undeclared names.
- File I/O: open-state for literal paths (`C_FILE_*`), READFILE assignability to STRING, path types.
- No BYREF / enum-pointer-SET TYPE forms.
- Record `TYPE` … `ENDTYPE` is supported — see [`TYPE_SYSTEM.md`](./TYPE_SYSTEM.md).
- `CLASS` OOP (single inheritance, `PUBLIC`/`PRIVATE`, `SUPER`, `NEW`) is supported — see
  [`OBJECT_ORIENTED_PROGRAMMING.md`](./OBJECT_ORIENTED_PROGRAMMING.md). `C_OVERRIDE_MISMATCH`
  is a warning only, not enforced strictly.
- Expression typing is best-effort; some operator combinations may under-report.
- NEXT/FOR variable mismatch and CASE duplicate labels remain **parser** structural diagnostics (`E_*`).
- Runtime execution lives in `@pseudopilot/interpreter` (see [`INTERPRETER.md`](./INTERPRETER.md)); checker does not evaluate code.
- `RIGHT(S, 0)` Python mapping differs from interpreter (`""` at runtime) — documented in interpreter + translation docs.

---

## 7. Future work

- Reuse `globalSymbols` + per-routine scopes in the debugger UI
- Wire interpreter into `apps/web` via `RuntimeHost`
- Stricter definite assignment
- Exam-insert builtin packs (ASC/CHR/…) extending the registry
- AI coach explanations keyed by `C_*` / `R_*` codes
