# Translation Engine — Architecture (V1)

**Package:** `@pseudopilot/translator`  
**Dialect version:** Core + Extended TYPE forms + CLASS (V15)  
**Status:** Records → `@dataclass`; enums → `IntEnum`; pointers → `_pp_addr` / `_pp_pload` / `_pp_pstore`; SET/`DEFINE` → `set` + `_pp_define`; classes → plain Python `class`. DIV/MOD → `_pp_div`/`_pp_mod`; RIGHT → `_pp_right`. See [`TYPE_SYSTEM.md`](./TYPE_SYSTEM.md) and [`OBJECT_ORIENTED_PROGRAMMING.md`](./OBJECT_ORIENTED_PROGRAMMING.md).

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
- Fail loudly on unsupported constructs with structured diagnostics — never invent control flow.
- **Semantic check** (default on): `@pseudopilot/checker` validates scopes/types/builtins before lowering. Disable with `semanticCheck: false` only for IR experiments.
- **Builtins:** signatures in `language-core` `CORE_BUILTINS`; Python emission in `translator/src/builtins/emit.ts` (backend-owned, not in language-core).
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
   - `@dataclass class Name:` → `TYPE … ENDTYPE`
   - plain `class Name[(Parent)]:` → `CLASS … ENDCLASS` (`__init__` → `NEW`, methods,
     `super().__init__` / `super().Method`, properties from `self.X = …`)
   - `ClassName(args)` (known class) → `NEW ClassName(args)`
   - `obj.method(args)` → method call expression / expression statement
   - Unsupported Python (`with`, `try`, `lambda`, `async`, list comprehensions as
     statements, …) → structured diagnostics (`T_PY_PARSE` / related), never invented control flow
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
| `python/identifier-sanitizer.ts` | Deterministic keyword/builtin → `name_` (and reverse) |
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
| `INPUT x` / `INPUT A[i]` | `IrInput` | Typed: `x = int(input().strip())` / `A[i - L] = int(input().strip())` (see below) |
| `OUTPUT a, b` | `IrOutput` | `print(a, b)` |
| `DIV` / `MOD` | `_pp_div` / `_pp_mod` | Trunc toward zero (incl. negatives) — aligned with interpreter; not raw Python `//` / `%` |
| `=` `<>` … | `==` `!=` … | `==` `!=` … |
| `AND` `OR` `NOT` | `and` `or` `not` | `and` `or` `not` |
| `TRUE`/`FALSE` | bool | `True`/`False` |
| `'A'` (CHAR) | `IrCharLiteral` | `'A'` |
| `04/10/2003` (DATE) | `IrDateLiteral` | `date(2003, 10, 4)` |
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
| `DECLARE` (scalar / array / multi-name) | `IrDeclareStatement` | `Name: type` / `Name: list[T]  # ARRAY[…]` |
| `CONSTANT Name = literal` | `IrConstantStatement` | `Name = literal  # CONSTANT` |

**DECLARE / CONSTANT → Python strategy:** Scalar DECLARE becomes a PEP 526 annotation with no initializer (`Count: int`). CHAR is `str  # CHAR` and DATE is `date  # DATE` so reverse can restore those types. Arrays become dense 0-based lists of length `(upper - lower + 1)`:

```python
Scores: list[int] = [0 for _ in range((10) - (1) + 1)]  # ARRAY[1:10]
Scores[i - 1] = 10   # Cambridge Scores[i] with lower bound 1
```

Index emission always subtracts the declared lower bound (`arr[i - L]`) — including for `ARRAY[5:10]`, `ARRAY[-3:3]`, and `ARRAY[0:9]`. There is **no** special case for lower bound 1. Multi-name DECLARE expands to one line per name. CONSTANT becomes an assignment of a literal tagged `# CONSTANT`. Reverse recovers bounds from `# ARRAY[…]` and strips `i - L` back to Cambridge indices when `L` matches.

**INPUT typing:** `IrInput.valueType` drives Python conversions matching the interpreter:

| Cambridge type | Python |
| --- | --- |
| INTEGER | `int(input().strip())` |
| REAL | `float(input().strip())` |
| BOOLEAN | `_pp_input_bool()` (TRUE/FALSE) |
| CHAR | `_pp_input_char()` (first character) |
| DATE | `_pp_input_date()` (`dd/mm/yyyy` → `date`) |
| STRING | `input()` |

Unknown / undeclared targets still emit plain `input()`.

**CASE → Python decision:** Emit `match`/`case` (Python 3.10+). It is the clearest semantic match for Cambridge CASE; the project does not pin an older Python runtime. Range labels use a guarded capture `_v` so inclusive `TO` bounds round-trip.

**PROCEDURE → Python:** Parameters default to by-value (Cambridge §8.3). Explicit
`BYVAL`/`BYREF` are parsed. Scalar **BYREF** parameters lower to list cells via
`_pp_cell(value)` (body uses `Name[0]`; call sites wrap/unwrap). Composite BYREF
(record) skips `copy.deepcopy` so the shared object is mutated. Reverse recovers
`# BYREF` tags on `def` lines and collapses `_pp_ref_*` call patterns. Types map
INTEGER→int, REAL→float, STRING/CHAR→str, BOOLEAN→bool, DATE→`date` (`# DATE` tag).

**FUNCTION → Python:** Same parameter mapping. Return type becomes a Python `->` annotation so reverse translation can distinguish FUNCTION from PROCEDURE. `RETURN expr` maps 1:1 to `return expr`. Function calls in expressions (`OUTPUT Add(2, 3)`) become `print(Add(2, 3))`. A FUNCTION with no `RETURN` anywhere errors via the checker (`C_FUNC_NO_RETURN`). Statements after `RETURN` at the same block level warn (`C_UNREACHABLE`). Full path-coverage analysis is not performed. (Python→pseudocode reverse may still emit `T_FUNC_NO_RETURN`.)

**PROCEDURE/FUNCTION safety checks:** Duplicate parameters are rejected (`T_PROC_DUP_PARAM`). Nested `def` is rejected. Unannotated Python params warn and default to INTEGER (`T_PROC_DEFAULT_TYPE`). CALL before its definition warns (`T_CALL_BEFORE_PROC`). Python keywords and builtins in routine/parameter names are **sanitized** at emit time (see Identifier sanitization below) rather than rejected.

**DECLARE/CONSTANT diagnostics:** Duplicate names in a scope (`T_DUP_DECLARE` / `T_DUP_CONSTANT`), assignment / INPUT / FOR update of a CONSTANT (`T_ASSIGN_TO_CONSTANT`, statement not emitted). Locals may shadow globals. Malformed CONSTANT non-literals (`E_CONSTANT_LITERAL` from the parser). Python keywords and builtins in DECLARE/CONSTANT names are sanitized at emit time (see below).

### Identifier sanitization (Python)

Cambridge identifiers are kept verbatim in IR. The Python printer runs **every** user identifier through a single `IdentifierSanitizer` (`packages/translator/src/python/identifier-sanitizer.ts`) so emitted Python never uses a keyword or shadows a builtin the translator relies on.

| Cambridge | Python |
| --- | --- |
| `list` | `list_` |
| `class` | `class_` |
| `print` | `print_` |
| `input` | `input_` |
| `str` | `str_` |
| `int` | `int_` |
| `Count` (no collision) | `Count` (unchanged) |

**Policy**

- Deterministic: same Cambridge name → same Python name everywhere (declarations, references, TYPE/CLASS names, fields, methods, parameters, loop variables, helpers’ user-facing args).
- Collision → append a single trailing `_`. Non-colliding names are unchanged.
- Covers Python keywords (`class`, `def`, `pass`, `for`, `while`, `if`, `else`, `from`, `import`, `lambda`, `global`, `nonlocal`, `match`, `case`, …) and builtins (`list`, `dict`, `set`, `tuple`, `str`, `int`, `float`, `bool`, `input`, `print`, `len`, `range`, `type`, `object`, `open`, `sum`, `min`, `max`, `chr`, `ord`, `bytes`, `Exception`, …) plus names the translator binds (`date`, `copy`, `random`, `dataclass`, `field`).
- Generated helpers keep the `_pp_` prefix (`_pp_cell`, `_pp_is_num`, …) and are not rewritten by the sanitizer.

**Reverse recovery**

The Python parser recovers Cambridge names with the inverse rule: if a name ends with `_` and the stem is reserved, strip one `_` (`list_` → `list`). Otherwise leave the name unchanged.

**Edge cases**

- If Cambridge already used a name like `list_`, forward emit leaves it as `list_` (not reserved), but reverse strips it to `list` — round-trip is imperfect for that edge case.
- A Cambridge identifier equal to a translator helper (e.g. `_pp_cell`) is not reserved and is emitted unchanged; avoid those names to prevent colliding with helpers.
- Case matters for the reserved check (`List` is not `list`); Cambridge case-folding still canonicalizes student identifiers to first-declaration casing before emit.
- Cambridge language keywords (`INPUT`, `CLASS`, `FOR`, …) cannot appear as identifiers in Cambridge source (lexer). Sanitization still applies when those names enter IR from reverse translation of PseudoPilot-emitted Python (`input_`, `class_`, …).

**Builtin emission (Python):** `RIGHT` uses `_pp_right(s, n)` so `RIGHT(s, 0)` is `""` (Python `s[-0:]` would return the whole string). `RAND` uses `random.random() * (x)` so additive count expressions keep correct precedence. `MID` uses parenthesized `s[(start)-1:(start)-1+(length)]`. `DIV`/`MOD` emit `_pp_div`/`_pp_mod` (trunc toward zero). DATE helpers map to `datetime.date` attributes / `date(...)` / `date.today()`; reverse recovers `DAY`/`MONTH`/`YEAR`/`SETDATE`/`TODAY`. Reverse maps those forms back; `len(x) + …` stays numeric `+` (LENGTH is not stringy).

**Explicitly out of scope for this subset:** ASC/CHR and other exam-insert-only builtins that lack a fixed Core mapping (except PseudoPilot Core `LEFT`). There is **no** Cambridge `TIME` datatype — do not invent one in translation.

### Text file I/O (V12)

Cambridge → Python (literal paths):

| Cambridge | Python |
| --- | --- |
| `OPENFILE "f.txt" FOR READ` | `_f_f_txt = open("f.txt", "r")` |
| `OPENFILE … FOR WRITE` | `open(..., "w")` |
| `OPENFILE … FOR APPEND` | `open(..., "a")` |
| `READFILE path, target` | `target = handle.readline().rstrip("\n")` |
| `WRITEFILE path, value` | `handle.write(str(value) + "\n")` |
| `CLOSEFILE path` | `handle.close()` |
| `EOF(path)` | `_pp_eof(handle)` using tell/read(1)/seek |

Dynamic paths use `_pp_files[path] = open(...)`. Reverse translation lifts `open` / `readline` / `write` / `close` patterns back to Cambridge where practical.

**Fidelity notes:** Python file objects are not Cambridge path-handles; EOF via tell/seek is a documented teaching mapping, not a byte-identical Cambridge runtime.

### Random file I/O (§9.2)

| Cambridge | Python |
| --- | --- |
| `OPENFILE "f.dat" FOR RANDOM` | `handle = _pp_random_open("f.dat")` |
| `SEEK path, n` | `_pp_random_seek(handle, n)` |
| `GETRECORD path, var` | `var = _pp_random_get(handle)` |
| `PUTRECORD path, expr` | `_pp_random_put(handle, expr)` |
| `CLOSEFILE path` (random) | `_pp_random_close(handle)` |

Helpers use an in-memory `_pp_random_files` dict (teaching mapping — not OS binary records). Reverse lift recovers SEEK/GETRECORD/PUTRECORD from these helpers. See [`FILE_IO.md`](./FILE_IO.md).

### Enum / pointer / SET TYPE

| Cambridge | Python |
| --- | --- |
| `TYPE Season = (Spring, Summer, …)` | `class Season(IntEnum): Spring = 0; …` |
| `TYPE IntPtr = ^INTEGER` | Type comment / alias; values are cells |
| `P ← ^X` | `P = _pp_addr(X)` (or `_pp_cell` wrap for non-simple places) |
| `P^` (load / store) | `_pp_pload(P)` / `_pp_pstore(P, value)` |
| `TYPE Digits = SET OF INTEGER` | Documented set-of alias |
| `DEFINE Lucky(3, 7) : Digits` | `Lucky = _pp_define("Digits", 3, 7)` |

Reverse recovers PseudoPilot-emitted `IntEnum`, `_pp_addr` / `_pp_*` pointer helpers, and `_pp_define`. Hand-written Python may not round-trip. See [`TYPE_SYSTEM.md`](./TYPE_SYSTEM.md).

### `CLASS` / OOP (V14)

Cambridge → Python (forward only — see limitations below):

| Cambridge | Python |
| --- | --- |
| `CLASS Name [INHERITS Parent] … ENDCLASS` | `class Name[(Parent)]:` |
| `PROCEDURE NEW(params) … ENDPROCEDURE` | `def __init__(self, params) -> None:` |
| `PROCEDURE Method(params) … ENDPROCEDURE` | `def Method(self, params):` |
| `FUNCTION Method(params) RETURNS Type … ENDFUNCTION` | `def Method(self, params) -> Type:` |
| `SUPER.NEW(args)` | `super().__init__(args)` |
| `SUPER.Method(args)` | `super().Method(args)` |
| `NEW ClassName(args)` | `ClassName(args)` |
| `Obj.Method(args)` / `CALL Obj.Method(args)` | `Obj.Method(args)` |
| `DECLARE X : ClassName` | `X: ClassName | None = None` |
| `DECLARE Xs : ARRAY[1:n] OF ClassName` | `Xs: list[ClassName | None] = [None for _ in range((n) - (1) + 1)]  # ARRAY[1:n]` |

```text
CLASS Pet
PRIVATE Name : STRING
PUBLIC PROCEDURE NEW(GivenName : STRING)
  Name ← GivenName
ENDPROCEDURE
PUBLIC FUNCTION GetName() RETURNS STRING
  RETURN Name
ENDFUNCTION
ENDCLASS

CLASS Cat INHERITS Pet
PRIVATE Breed : STRING
PUBLIC PROCEDURE NEW(GivenName : STRING, GivenBreed : STRING)
  SUPER.NEW(GivenName)
  Breed ← GivenBreed
ENDPROCEDURE
ENDCLASS
```

→

```python
class Pet:
    def __init__(self, GivenName: str) -> None:
        self.Name = GivenName
    def GetName(self) -> str:
        return self.Name

class Cat(Pet):
    def __init__(self, GivenName: str, GivenBreed: str) -> None:
        super().__init__(GivenName)
        self.Breed = GivenBreed
```

**Why `class`, not `@dataclass`:** unlike record `TYPE`, a `CLASS` needs constructor logic
(`NEW`) and methods, so it lowers to a plain Python `class` rather than a `@dataclass`.

**Reference semantics preserved:** `CLASS` instance assignment/parameter passing does
**not** emit `copy.deepcopy(...)` (unlike `TYPE` records/arrays) — Python object assignment
is already reference semantics, matching the interpreter's `ObjectValue` aliasing.

**`PRIVATE` is soft in emission:** no name-mangling; `PRIVATE` fields/methods keep their
plain Cambridge identifier in the emitted Python. Cambridge's `PRIVATE` is enforced only at
check time (`C_PRIVATE_ACCESS`), never at runtime or in translated code.

**Reverse (Python → Cambridge) supports PseudoPilot-emitted `class`:** plain
`class Name[(Parent)]:` with `__init__` / methods / `super().__init__` /
`super().Method` / `Obj.Method(...)` / `ClassName(...)` maps back to
`CLASS … ENDCLASS`, `PROCEDURE NEW`, `SUPER`, method calls, and `NEW`.
Properties are recovered from `self.Field = …` assignments. Unsupported Python
class shapes (class-level assignments, multiple inheritance, nested classes)
are rejected with diagnostics rather than guessed.
