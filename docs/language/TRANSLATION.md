# Translation Engine — Architecture (V1)

**Package:** `@pseudopilot/translator`  
**Dialect version:** Core subset V14 (V13 + **CLASS … ENDCLASS OOP**)  
**Status:** Record types lower to Python `@dataclass`; classes lower to plain Python `class`. See [`TYPE_SYSTEM.md`](./TYPE_SYSTEM.md) and [`OBJECT_ORIENTED_PROGRAMMING.md`](./OBJECT_ORIENTED_PROGRAMMING.md).

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
- Fail loudly on unsupported constructs (BYREF, RANDOM files, …) with structured diagnostics — never invent control flow.
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
| `DIV` / `MOD` | `//` / `%` | `//` / `%` (**note:** Python floors on negatives; the AST interpreter truncates toward zero — known Cambridge ambiguity) |
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

**PROCEDURE → Python:** Parameters are by-value (Cambridge default). `BYVAL`/`BYREF` keywords are not parsed. Types map INTEGER→int, REAL→float, STRING/CHAR→str, BOOLEAN→bool, DATE→`date` (`# DATE` tag).

**FUNCTION → Python:** Same parameter mapping. Return type becomes a Python `->` annotation so reverse translation can distinguish FUNCTION from PROCEDURE. `RETURN expr` maps 1:1 to `return expr`. Function calls in expressions (`OUTPUT Add(2, 3)`) become `print(Add(2, 3))`. A FUNCTION with no `RETURN` anywhere errors via the checker (`C_FUNC_NO_RETURN`). Statements after `RETURN` at the same block level warn (`C_UNREACHABLE`). Full path-coverage analysis is not performed. (Python→pseudocode reverse may still emit `T_FUNC_NO_RETURN`.)

**PROCEDURE/FUNCTION safety checks:** Routine/parameter names that are Python keywords are rejected (`T_PROC_PY_KEYWORD`). Duplicate parameters are rejected (`T_PROC_DUP_PARAM`). Nested `def` is rejected. Names that shadow `print`/`input`/`range` warn (`T_PROC_SHADOWS_BUILTIN`). Unannotated Python params warn and default to INTEGER (`T_PROC_DEFAULT_TYPE`). CALL before its definition warns (`T_CALL_BEFORE_PROC`).

**DECLARE/CONSTANT diagnostics:** Duplicate names in a scope (`T_DUP_DECLARE` / `T_DUP_CONSTANT`), assignment / INPUT / FOR update of a CONSTANT (`T_ASSIGN_TO_CONSTANT`, statement not emitted), Python-keyword names (`T_DECL_PY_KEYWORD`), builtin shadow warnings (`T_DECL_SHADOWS_BUILTIN`). Locals may shadow globals. Malformed CONSTANT non-literals (`E_CONSTANT_LITERAL` from the parser).

**Builtin emission (Python):** `RIGHT` uses `s[-(n):]` and `RAND` uses `random.random() * (x)` so additive count expressions keep correct precedence. `MID` uses parenthesized `s[(start)-1:(start)-1+(length)]`. DATE helpers map to `datetime.date` attributes / `date(...)` / `date.today()`; reverse recovers `DAY`/`MONTH`/`YEAR`/`SETDATE`/`TODAY`. Reverse maps those forms back; `len(x) + …` stays numeric `+` (LENGTH is not stringy).

**Explicitly out of scope for this subset:** BYREF, RANDOM file I/O, ASC/CHR and other exam-insert-only builtins (except PseudoPilot Core `LEFT`). There is **no** Cambridge `TIME` datatype — do not invent one in translation.

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
