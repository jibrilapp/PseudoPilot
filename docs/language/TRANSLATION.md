# Translation Engine — Architecture (V1)

**Package:** `@pseudopilot/translator`  
**Dialect version:** Core subset V8 (assignment, I/O, expressions, CHAR, array indexes, IF / ELSE / ELSE IF, WHILE / ENDWHILE, REPEAT / UNTIL, FOR / NEXT / STEP, CASE OF / OTHERWISE / ENDCASE, PROCEDURE / CALL, **FUNCTION / RETURNS / RETURN**)  
**Status:** FUNCTION translation milestone complete

---

## 1. Architecture

PseudoPilot does **not** translate by string rewrite. The engine is a classic multi-frontend / multi-backend compiler pipeline:

```
┌─────────────────────┐     ┌─────────────────────┐
│ Cambridge source    │     │ Python source       │
└─────────┬───────────┘     └─────────┬───────────┘
          │ parse                     │ parse (V1 subset)
          ▼                           ▼
┌─────────────────────┐     ┌─────────────────────┐
│ language-core AST   │     │ Python CST → IR     │
└─────────┬───────────┘     └─────────┬───────────┘
          │ lower                     │
          └────────────┬──────────────┘
                       ▼
              ┌─────────────────┐
              │  Canonical IR   │  ← language-neutral
              │  + trivia       │
              └────────┬────────┘
                       │ print
          ┌────────────┴────────────┐
          ▼                         ▼
   Cambridge text              Python text
```

### Layers

| Layer | Responsibility |
| --- | --- |
| **Frontends** | Parse source → IR (Cambridge via `@pseudopilot/language-core`; Python via in-package subset parser) |
| **IR** | Single semantic model for V1 statements/expressions + attached trivia |
| **Rule tables** | Operator / literal / I/O mappings (data, not scattered `if` soup) |
| **Printers** | IR → concrete syntax with precedence-aware parentheses and trivia emission |
| **Pipeline** | Orchestration, unsupported-construct diagnostics, options |

### Design constraints

- Deterministic: same input → same IR → same output (stable formatting).
- Pure library: no I/O, network, or AI.
- Fail loudly on unsupported constructs (DECLARE, …) with structured diagnostics — never invent control flow.
- New languages plug in as **frontend + printer** only; IR and rule registries stay shared.

---

## 2. How the AST is traversed

### Cambridge → IR

1. `parse(source)` from `language-core` yields a `Program`.
2. A **lowering walker** visits `Program.body` in order, recursively lowering nested blocks (`IF` / `WHILE` / `REPEAT` / `FOR` / `CASE` bodies).
3. Each `Statement` is pattern-matched by `kind`:
   - Supported → IR node
   - Unsupported → diagnostic `T_UNSUPPORTED_*`, statement skipped or pipeline `ok = false`
4. Expressions are lowered recursively (`BinaryExpression`, `UnaryExpression`, `GroupingExpression`, literals, identifiers).
5. Trivia collector uses original source + statement `span` to attach leading/trailing comments and blank lines.

This is a **single-pass recursive descent over the AST** (visitor by explicit `switch` on `kind`), not a visitor-framework abstraction yet — YAGNI until backends multiply.

### Python → IR

1. Python subset lexer → tokens (including `#` comments, newlines, and `INDENT`/`DEDENT`).
2. Recursive-descent parser builds IR **directly** (no separate long-lived Py AST) for:
   - `name = expr`
   - `name = input(...)` → `IrInput` (+ optional `IrOutput` for prompt)
   - `print(...)` → `IrOutput`
   - `if` / `elif` / `else` suites (indented blocks; empty → `pass`)
   - `while` suites (indented blocks; empty → `pass`)
   - `while True` + trailing `if <condition>: break` patterns → `REPEAT ... UNTIL`
   - `for <var> in range(...)` → `FOR ... NEXT`
   - `match` / `case` / `case _` → `CASE OF` / arms / `OTHERWISE`
   - `def Name(params):` → `PROCEDURE … ENDPROCEDURE`
   - `def Name(params) -> type:` → `FUNCTION … RETURNS … ENDFUNCTION`
   - `return expr` → `RETURN expr`
   - statement-level `Name(args)` → `CALL Name(args)`
   - expression-level `Name(args)` → function `CallExpression`
3. Same IR printers as the Cambridge path.

### IR → text

Printers walk IR recursively with a **precedence context** integer so parentheses are inserted only when required (or when `IrGrouping` was preserved from source).

---

## 3. How translation rules are organized

Rules live as **tables and pure functions**, not as ad-hoc string concat in printers:

| Module | Contents |
| --- | --- |
| `rules/operators.ts` | Cambridge ↔ IR ↔ Python operator maps, precedences |
| `rules/literals.ts` | `TRUE`/`FALSE` ↔ `True`/`False`; number/string escaping |
| `rules/io.ts` | `INPUT`/`OUTPUT` ↔ `input`/`print` conventions |
| `cambridge/lower.ts` | AST kind → IR kind |
| `python/parse.ts` | Python syntax → IR |
| `*/print.ts` | IR → syntax using the tables |

Adding a new construct (e.g. FOR later):

1. Extend IR nodes.
2. Add lowerers in each frontend.
3. Add print arms.
4. Add golden tests both directions.

---

## 4. Adding new languages later

To add e.g. JavaScript or Java:

1. Define `frontends/<lang>/parse.ts` → `IrProgram`.
2. Define `backends/<lang>/print.ts` ← `IrProgram`.
3. Register in `pipeline/registry.ts` (`LanguageId` → `{ parse, print }`).
4. Reuse the same IR; only map surface syntax through rule tables (or lang-specific overrides).

IR stability is the scalability bottleneck we protect: prefer evolving IR carefully over forking per-language trees.

---

## 5. Formatting, comments, indentation

### V1 policy (honest fidelity)

| Concern | Behaviour |
| --- | --- |
| **Indentation** | Regenerated. Nested `IF` / `WHILE` / `REPEAT` / `FOR` / `CASE` blocks use 4 spaces per level in both Cambridge and Python printers. Top-level statements have no indent. |
| **Assignment glyph** | Default Cambridge print uses `←`; option `assignmentArrow: 'ascii'` → `<-`. |
| **Whitespace inside exprs** | Canonical: `a + b`, `a DIV b` / `a // b` — not source-faithful spacing. |
| **Comments** | Full-line `//` or `#` comments between statements are captured as **leading trivia** on the following statement (or trailing program trivia). Same-line trailing comments attach as **trailing trivia**. |
| **Blank lines** | Runs of blank lines between statements compressed to at most one blank trivia node (stable, readable). |
| **Round-trip** | Semantics-preserving for the V1 subset; **layout is normalized**, comments preserved when attached to statements. |

Trivia is stored on IR nodes, not re-derived from target language, so Cambridge `//` becomes Python `#` on print (and vice versa) — comment *text* preserved, comment *syntax* adapted.

---

## V1 construct map

| Cambridge | IR | Python |
| --- | --- | --- |
| `x ← expr` | `IrAssignment` | `x = expr` |
| `A[i] ← expr` / `A[i, j] ← expr` | `IrAssignment` + `IrIndexExpression` | `A[i] = expr` / `A[i][j] = expr` |
| `INPUT x` / `INPUT A[i]` | `IrInput` | `x = input()` / `A[i] = input()` |
| `OUTPUT a, b` | `IrOutput` | `print(a, b)` |
| `DIV` / `MOD` | `//` / `%` | `//` / `%` |
| `=` `<>` … | `==` `!=` … | `==` `!=` … |
| `AND` `OR` `NOT` | `and` `or` `not` | `and` `or` `not` |
| `TRUE`/`FALSE` | bool | `True`/`False` |
| `'A'` (CHAR) | `IrCharLiteral` | `'A'` |
| `"text"` (STRING) | `IrStringLiteral` | `"text"` |
| `IF` / `ELSE IF` / `ELSE` / `ENDIF` | `IrIfStatement` | `if` / `elif` / `else` (+ `pass` for empty body) |
| `WHILE` / `[DO]` / `ENDWHILE` | `IrWhileStatement` | `while` (+ `pass` for empty body) |
| `REPEAT` / `UNTIL` | `IrRepeatStatement` | `while True` + trailing `if cond: break` |
| `FOR` / `TO` / `STEP` / `NEXT` | `IrForStatement` | `for … in range(start, end±1 [, step])` |
| `CASE OF` / `OTHERWISE` / `ENDCASE` | `IrCaseStatement` | Python 3.10+ `match` / `case` / `case _` (ranges → `case _v if low <= _v and _v <= high`) |
| `PROCEDURE` / `ENDPROCEDURE` | `IrProcedureDeclaration` | `def Name(params):` with `int`/`float`/`str`/`bool` annotations |
| `CALL Name(args)` | `IrCallStatement` | `Name(args)` statement |
| `FUNCTION` / `RETURNS` / `ENDFUNCTION` | `IrFunctionDeclaration` | `def Name(params) -> type:` |
| `RETURN expr` | `IrReturnStatement` | `return expr` |
| `F(args)` expression | `IrCallExpression` | `F(args)` |

**INPUT typing:** Without `DECLARE` (out of current subset), Cambridge `INPUT` has no declared type. PseudoPilot maps to Python `input()` (always `str`). Coercion belongs with a later typechecker + DECLARE milestone — not invented here.

**CASE → Python decision:** Emit `match`/`case` (Python 3.10+). It is the clearest semantic match for Cambridge CASE; the project does not pin an older Python runtime. Range labels use a guarded capture `_v` so inclusive `TO` bounds round-trip.

**PROCEDURE → Python:** Parameters are by-value (Cambridge default). `BYVAL`/`BYREF` keywords are not parsed. Types map INTEGER→int, REAL→float, STRING/CHAR→str, BOOLEAN→bool.

**FUNCTION → Python:** Same parameter mapping. Return type becomes a Python `->` annotation so reverse translation can distinguish FUNCTION from PROCEDURE. `RETURN expr` maps 1:1 to `return expr`. Function calls in expressions (`OUTPUT Add(2, 3)`) become `print(Add(2, 3))`. A FUNCTION with no `RETURN` anywhere warns (`T_FUNC_NO_RETURN`). Statements after `RETURN` at the same block level warn (`T_UNREACHABLE_AFTER_RETURN`). Full path-coverage analysis is not performed.

**PROCEDURE/FUNCTION safety checks:** Routine/parameter names that are Python keywords are rejected (`T_PROC_PY_KEYWORD`). Duplicate parameters are rejected (`T_PROC_DUP_PARAM`). Nested `def` is rejected. Names that shadow `print`/`input`/`range` warn (`T_PROC_SHADOWS_BUILTIN`). Unannotated Python params warn and default to INTEGER (`T_PROC_DEFAULT_TYPE`). CALL before its definition warns (`T_CALL_BEFORE_PROC`).

**Explicitly out of scope for this subset:** DECLARE, BYREF, file I/O, `&` concatenation, builtins, DATE literals.
