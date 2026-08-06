# Object-oriented programming (Cambridge `CLASS`)

Cambridge 9618 OOP: `CLASS` … `ENDCLASS`, `PUBLIC` / `PRIVATE` members, single-inheritance
`INHERITS`, `SUPER`, and `NEW` instantiation — implemented end to end (parser, checker,
interpreter, translator, language service).

**Status:** ✅ Implemented. See [`IMPLEMENTATION_CHECKLIST.md`](./IMPLEMENTATION_CHECKLIST.md) §L.

---

## 1. Class model

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

DECLARE MyPet : Pet
MyPet ← NEW Pet("Rex")
OUTPUT MyPet.GetName()
```

| Member form | Meaning |
| --- | --- |
| `[PUBLIC \| PRIVATE] [DECLARE] Name : Type [, Name2 : …]` | Property (field). `DECLARE` is optional — Cambridge examples omit it. |
| `[PUBLIC \| PRIVATE] PROCEDURE Name(params) … ENDPROCEDURE` | Method with no return value. `Name = NEW` is the constructor. |
| `[PUBLIC \| PRIVATE] FUNCTION Name(params) RETURNS Type … ENDFUNCTION` | Method returning a value. |

**Visibility defaults to `PUBLIC`** when omitted — matching plain `TYPE` fields, which have
no visibility concept at all. Cambridge's own examples always write `PUBLIC`/`PRIVATE`
explicitly; PseudoPilot accepts the bare form too.

`CLASS` and `TYPE` names share **one case-insensitive name table** (`C_DUP_TYPE` /
`C_DUP_CLASS` if a name collides across the two).

Nested `CLASS` declarations are rejected (`E_NESTED_CLASS`), matching the existing
`E_NESTED_ROUTINE` rule for `PROCEDURE`/`FUNCTION`.

---

## 2. Inheritance (`INHERITS`)

```text
CLASS Animal
  PUBLIC PROCEDURE NEW()
  ENDPROCEDURE
  PUBLIC FUNCTION Speak() RETURNS STRING
    RETURN "..."
  ENDFUNCTION
ENDCLASS

CLASS Dog INHERITS Animal
  PUBLIC PROCEDURE NEW()
    SUPER.NEW()
  ENDPROCEDURE
  PUBLIC FUNCTION Speak() RETURNS STRING
    RETURN "Woof"
  ENDFUNCTION
ENDCLASS
```

- **Single inheritance only** — `INHERITS` names exactly one parent `CLASS`. Cambridge 9618
  does not define multiple inheritance, and PseudoPilot does not extend it.
- The parent must be declared as a `CLASS` (not a `TYPE`) — `C_INVALID_INHERITS` otherwise.
  Forward references are allowed (`INHERITS` a `CLASS` declared later in the same file).
- Cyclic inheritance (`A INHERITS B`, `B INHERITS A`, directly or transitively) is rejected
  (`C_CYCLIC_INHERITANCE`) and the cycle is broken so later passes terminate.
- A subclass may re-declare a method with the same name to **override** it. A best-effort
  warning (`C_OVERRIDE_MISMATCH`) fires if the override's parameter count, kind
  (`PROCEDURE`/`FUNCTION`), or return type differs from the parent's — the constructor
  (`NEW`) is exempt, since every class may define its own.
- **Covariant assignment:** a variable declared with the parent type may hold a subclass
  instance (`DECLARE A : Animal` then `A ← NEW Dog()`), because `isAssignable` walks the
  inheritance chain.

### `SUPER`

`SUPER` is only meaningful as the object of a method call:

| Form | Meaning |
| --- | --- |
| `SUPER.NEW(args)` | Call the parent constructor (typically the first line of a subclass's own `NEW`). |
| `SUPER.Method(args)` | Call the parent's implementation of `Method`, even if the current class overrides it. |

Using `SUPER` outside a `CLASS` method, or a class with no `INHERITS` parent, is
`C_SUPER_OUTSIDE`. `SUPER` cannot be used as a plain value (`SUPER` alone is not an
expression) — only `SUPER.Name(...)` is valid.

---

## 3. `NEW` instantiation

```text
DECLARE P : Pet
P ← NEW Pet("Rex")
```

- `NEW ClassName(args)` allocates an instance with all fields (own + inherited) **default
  initialised** (same defaults as `TYPE`: `0` / `0.0` / `""` / `FALSE` / `' '` / fresh nested
  record or object), then — if the class declares a `NEW` method — calls it with `args`.
- A class with **no** `NEW` method accepts `NEW ClassName()` with zero arguments only
  (`C_ARG_COUNT` otherwise); fields keep their defaults.
- `NEW` is parsed as a keyword in method-name position (`PROCEDURE NEW(...)`) and as an
  expression keyword (`NEW ClassName(...)`) — both covered by the `New` token; `NEW` cannot
  be used as an ordinary identifier anywhere else.
- Unknown class names in `NEW` are `C_INVALID_NEW`.

---

## 4. Member lookup and visibility

Field/method resolution walks the inheritance chain, **own members first, then the parent,
then the grandparent, …** — a child's own field/method of the same name always wins
(override semantics). This mirrors `TYPE` field lookup but adds the inheritance walk.

**`PRIVATE` is scoped to the *defining* class, not the static type of the object:**

```text
CLASS Animal
  PRIVATE Name : STRING     ' defined on Animal
ENDCLASS
CLASS Dog INHERITS Animal
  PUBLIC PROCEDURE Bark()
    OUTPUT Name             ' ❌ C_PRIVATE_ACCESS — Name is PRIVATE to Animal, not Dog
  ENDPROCEDURE
ENDCLASS
```

A subclass does **not** automatically get access to a parent's `PRIVATE` members — only
code whose enclosing class *is* the declaring class (case-insensitive) may access a
`PRIVATE` field/method. This is enforced by `isAccessible(visibility, definingClass,
currentClass)` in `@pseudopilot/checker`.

Inside a class method, a bare identifier that isn't a local/parameter is resolved as an
**implicit `this.<field>`** access against the enclosing class (and its ancestors) —
`Name ← GivenName` inside `Animal.NEW` reads/writes `Animal`'s own `Name` field without
writing `THIS.Name` (Cambridge has no `THIS`/`self` keyword).

---

## 5. Object representation (reference vs. value semantics)

This is the **one semantic difference** from `TYPE` records that matters most in practice:

| | `TYPE` (`RecordValue`) | `CLASS` (`ObjectValue`) |
| --- | --- | --- |
| Assignment (`B ← A`) | **Deep copy** — `B` and `A` are independent afterwards | **Alias** — `B` and `A` refer to the *same* instance |
| Parameter passing | Deep copy (by value) | Reference (mutating the parameter mutates the caller's object) |
| Equality (`=`) | Rejected (`C_COMPARE_TYPE`) — compare fields | Rejected (`C_COMPARE_TYPE`) — compare fields |
| Python target | `@dataclass` (value-ish, but Python objects are still references) | Plain `class` (reference, matching Python's own model) |

```text
DECLARE A, B : Box
A ← NEW Box(1)
B ← A
B.Value ← 99
OUTPUT A.Value   ' 99 — B and A are the same object
OUTPUT B.Value   ' 99
```

Interpreter: `ObjectValue.kind === 'OBJECT'` is excluded from `cloneValue`'s deep-copy branch
(`RecordValue`/`ArrayValue` copy; `ObjectValue` returns the same reference) —
`packages/interpreter/src/value.ts`. `OUTPUT` on an object formats as
`ClassName{Field: value, …}` (own + inherited fields, declaration order).

---

## 6. Method dispatch (dynamic / overrides)

Cambridge OOP method calls always dispatch on the **runtime** class of the object, not its
static declared type — the interpreter walks the object's `className` (not the variable's
declared type) when resolving a method, so overrides in a subclass are honoured even when
accessed through a parent-typed variable:

```text
DECLARE A : Animal
A ← NEW Dog()
OUTPUT A.Speak()   ' "Woof" — Dog's override runs, even though A is declared Animal
```

`SUPER.Method(...)` bypasses this dispatch deliberately, resolving against the *lexically
enclosing class's parent* — the one Cambridge escape hatch for calling an overridden
implementation.

---

## 7. Translator: Python mapping

`@pseudopilot/translator` lowers `CLASS … ENDCLASS` to a plain Python `class` (not
`@dataclass` — unlike `TYPE`, since Cambridge objects need constructor logic and Python
dataclasses complicate that). See [`TRANSLATION.md`](./TRANSLATION.md) for the full V14
construct table.

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

DECLARE MyCat : Cat
MyCat ← NEW Cat("Kitty", "Shorthaired")
OUTPUT MyCat.GetName()
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

MyCat: Cat | None = None
MyCat = Cat("Kitty", "Shorthaired")
print(MyCat.GetName())
```

| Cambridge | Python |
| --- | --- |
| `CLASS Name [INHERITS Parent] … ENDCLASS` | `class Name[(Parent)]:` |
| `PRIVATE` / `PUBLIC Name : Type` property | *(no emission — properties become `self.Name = …` assignments inside methods, same as any Python instance attribute; there is no separate field-declaration syntax)* |
| `PROCEDURE NEW(params) … ENDPROCEDURE` | `def __init__(self, params) -> None:` |
| `PROCEDURE Name(params) … ENDPROCEDURE` | `def Name(self, params):` |
| `FUNCTION Name(params) RETURNS Type … ENDFUNCTION` | `def Name(self, params) -> Type:` |
| `NEW ClassName(args)` | `ClassName(args)` |
| `SUPER.NEW(args)` | `super().__init__(args)` |
| `SUPER.Method(args)` | `super().Method(args)` |
| `Obj.Method(args)` (statement, no `CALL`) | `Obj.Method(args)` |
| `CALL Obj.Method(args)` | `Obj.Method(args)` (`CALL` dropped, same as routine calls) |
| `DECLARE X : ClassName` | `X: ClassName | None = None` (reference type — no eager allocation; a class may need constructor arguments) |
| `DECLARE Xs : ARRAY[1:n] OF ClassName` | `Xs: list[ClassName | None] = [None for _ in range(1, n+1)]  # ARRAY[1:n]` |

**Reference semantics preserved:** unlike `TYPE` records/arrays, `CLASS` instance
assignment and parameter passing do **not** emit `copy.deepcopy(...)` — Python object
assignment is already reference semantics, matching the interpreter.

**`PRIVATE` is soft in Python emission** — Python has no true private members. PseudoPilot
does **not** name-mangle `PRIVATE` fields/methods (no leading `_`/`__`); the Python output
uses the same identifier for `PUBLIC` and `PRIVATE` members. Cambridge's `PRIVATE` is a
**source-level, checker-enforced** access rule (`C_PRIVATE_ACCESS`), not a runtime one — the
interpreter itself does not enforce it either (see `INTERPRETER.md` / limitations below).

---

## 8. Language service features

`@pseudopilot/language-service` treats `CLASS` symbols the same way it treats `TYPE`
symbols, extended for methods and inheritance:

| Feature | Behaviour |
| --- | --- |
| Completion after `.` | Fields **and** methods, own + inherited (child override replaces the ancestor's entry once), with visibility noted in the completion detail. |
| Completion after `DECLARE …:` / `RETURNS` | `CLASS` names offered alongside `TYPE` names and scalars. |
| Hover — class name | Kind, `Inherits: Parent`, own fields (`+public`/`-private` markers), own methods with signatures. |
| Hover — method | `METHOD` kind, `PROCEDURE`/`FUNCTION` signature with named parameters, `Visibility: PUBLIC\|PRIVATE`. |
| Hover — field | `FIELD` kind, type, `Visibility: PUBLIC\|PRIVATE`. |
| Hover — `NEW` | Static keyword documentation (no declaration site of its own to hover over other than the constructor method). |
| Go to definition | `CLASS` names (`DECLARE X : ClassName`, `NEW ClassName(...)`), fields (`Obj.Field`), methods (`Obj.Method(...)`, `SUPER.Method(...)`). |
| Find references | Declaration + every dotted use, resolved against the object's static type walking the inheritance chain — a field/method access on a subclass instance correctly links back to the ancestor that declares it. |
| Rename | Fields/methods are namespaced by their *declaring* `CLASS` — renaming `Cat.Speak` never touches an unrelated `Bird.Speak`. |
| Document symbols | `CLASS` appears as a `class`-kind symbol; its fields/methods appear as `field`/`method`-kind symbols with `containerName` set to the class name (outline-groupable, same pattern as `TYPE` fields). |

See [`LANGUAGE_SERVICE.md`](./LANGUAGE_SERVICE.md) for the full feature table and
[`classes.test.ts`](../../packages/language-service/src/classes.test.ts) for executable
coverage.

### Monaco / IDE

`apps/web/lib/monaco/registerPseudocode.ts` adds `CLASS`/`ENDCLASS`/`PUBLIC`/`PRIVATE`/
`INHERITS`/`SUPER`/`NEW` to:

- the Monarch keyword table (syntax highlighting),
- `indentationRules` (`CLASS` increases indent, `ENDCLASS` decreases it — same pattern as
  `TYPE`/`ENDTYPE`),
- folding markers (`CLASS` … `ENDCLASS` is a foldable region).

---

## 9. Relationship to `TYPE`

`CLASS` deliberately **reuses** the `TYPE`/record infrastructure rather than duplicating it:

| Shared | `TYPE` (record) | `CLASS` |
| --- | --- | --- |
| AST | `MemberExpression` (`.` access) | Same `MemberExpression`, plus `MethodCallExpression` / `NewExpression` / `SuperExpression` |
| Name table | One case-insensitive table (`typeTable`) | Same table — `CLASS`/`TYPE` names collide (`C_DUP_TYPE`/`C_DUP_CLASS`) |
| Field symbols | `kind: 'field'`, `containerName` = declaring `TYPE` | Same shape, `containerName` = declaring `CLASS` (defining class, for `PRIVATE` checks) |
| Interpreter place resolution | `obj.field` walks `RecordValue.fields` | `obj.field` walks `ObjectValue.fields` (flattened own + inherited) |

**But objects are not records:**

- `PpType` has a distinct `{ kind: 'class', name, inherits, fields, methods }` — not reused
  as `{ kind: 'record' }` — because classes carry methods, visibility, and an inheritance
  link that records do not have.
- `ObjectValue` is a distinct runtime shape (`{ kind: 'OBJECT', className, fields,
  fieldNames }`) purely so `cloneValue` can special-case it (never deep-copy) without
  touching `RecordValue` behaviour.
- A `TYPE` cannot `INHERITS`; a `CLASS` cannot use `GETRECORD`/`PUTRECORD`
  (random-file I/O is for TYPE records only — see [`FILE_IO.md`](./FILE_IO.md)).

---

## 10. Limitations (honest)

- **No multiple inheritance.** `INHERITS` names exactly one parent, matching the 9618
  syllabus scope.
- **`PRIVATE` is soft in Python emission.** No name-mangling; PseudoPilot's Python output
  makes `PRIVATE` members just as accessible as `PUBLIC` ones. Cambridge's access control is
  a **teaching-time** rule, enforced only by the checker (`C_PRIVATE_ACCESS`) — not by the
  interpreter or the translated Python.
- **Reverse translation (Python → Cambridge) supports PseudoPilot-emitted `class`.**
  Forward and reverse `CLASS` translation are both implemented for the shapes the
  translator itself emits (`__init__` → `NEW`, `super().__init__` → `SUPER.NEW`,
  instance method calls, `ClassName(...)` → `NEW ClassName(...)`, `Name: Cls | None = None`
  → `DECLARE`). Properties are inferred from `self.Field = …`. Unsupported Python
  class constructs are rejected with clear diagnostics — never silently mis-translated.
  (`TYPE` continues to reverse via `@dataclass`.)
- **No `GETRECORD`/`PUTRECORD` of objects.** Random-file I/O applies to TYPE records only
  (see [`FILE_IO.md`](./FILE_IO.md)); CLASS objects are rejected by the checker/runtime.
- **No abstract classes / interfaces.** Cambridge 9618 does not define either; every `CLASS`
  is concrete and instantiable via `NEW` (a class with no `NEW` method still allows
  `NEW ClassName()` with zero arguments).
- **Override checking is best-effort and non-blocking.** `C_OVERRIDE_MISMATCH` is a
  *warning*, not an error — arity/kind/return-type mismatches between an override and its
  parent's method do not stop compilation.
- **No mandatory `THIS`/`self` keyword in hand-written Cambridge.** Field/method access on
  the implicit receiver inside a method body may be *bare* (`Name`) — matching Cambridge's
  own examples. Reverse translation from Python `self.Field` emits explicit `SELF.Field` so
  assignments stay object-field writes when a parameter shares the field name
  (`SELF.name ← name`). Forward translation accepts both bare fields and `SELF.Field`.
- **Language-service inheritance walk depth is capped** (64 levels) purely as a safety net
  against undetected cycles; ordinary programs never approach this.

---

## 11. Manual IDE test cases

Paste each into the IDE editor and verify the behaviour described:

1. **Completion after `.`** — type the Pet/Cat example above, then on a new line type
   `MyCat.` and confirm the completion list shows `GetName` (own, `Cat`) **and** the
   inherited `Name`-related members from `Pet` are reachable if declared `PUBLIC`.
2. **Hover on a class name** — hover `Cat` in `CLASS Cat INHERITS Pet` and confirm the
   tooltip shows `Inherits: Pet` plus `Cat`'s own fields/methods.
3. **Hover on `NEW`** — hover the `NEW` in `MyCat ← NEW Cat("Kitty", "Shorthaired")` and
   confirm a tooltip explaining instantiation appears (there is no separate declaration to
   jump to).
4. **Hover on a `PRIVATE` field** — hover `Name` inside `CLASS Pet`'s property line and
   confirm `Visibility: PRIVATE` appears.
5. **Rename a method without cross-class collisions** — declare two unrelated classes each
   with a `Speak` method (e.g. `Cat`/`Bird`), rename one class's `Speak`, and confirm only
   that class's declaration + call sites update (the other `Speak` is untouched).
6. **Go to definition** — from `DECLARE MyCat : Cat`, go to definition on `Cat` and land on
   `CLASS Cat INHERITS Pet`.
7. **Find references on an inherited field accessed via a subclass** — declare
   `PUBLIC Sound : STRING` on a parent class, assign it via a subclass instance
   (`D.Sound ← "Woof"` where `D : Dog INHERITS Animal`), and confirm references from the
   parent's declaration include that subclass use.
8. **Folding** — collapse a `CLASS … ENDCLASS` block using the gutter fold arrow, same as
   `TYPE … ENDTYPE`.
9. **Run it** — execute the Pet/Cat example (▶ Run) and confirm `OUTPUT MyCat.GetName()`
   prints `Kitty`.
10. **Translate it** — switch to the Python pane and confirm `CLASS Cat INHERITS Pet` becomes
    `class Cat(Pet):` with `super().__init__(GivenName)` inside `__init__`.
