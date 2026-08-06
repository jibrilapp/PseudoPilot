# TYPE system (Cambridge user-defined types)

Cambridge 9618 user-defined types via `TYPE` (Guide §4): **records**, **enumerated**, **pointer**, and **SET** (+ `DEFINE`).

## Forms

### Record (`TYPE` … `ENDTYPE`)

```text
TYPE Student
    DECLARE Name : STRING
    DECLARE Age : INTEGER
ENDTYPE

DECLARE S : Student
S.Name ← "Alice"
OUTPUT S.Age
```

Nested records, arrays of records, records containing arrays, and **pointer fields** are supported. Recursive record graphs (a record field whose type is the same record, directly or via other records) are **forbidden** (`C_RECURSIVE_TYPE`).

### Enumerated

```text
TYPE Season = (Spring, Summer, Autumn, Winter)
DECLARE S : Season
S ← Summer
```

Enum members are distinct named values of that type. Assignment and comparison use the enum type.

### Pointer

```text
TYPE IntPtr = ^INTEGER
DECLARE X : INTEGER
DECLARE P : IntPtr
P ← ^X
P^ ← 42
OUTPUT X
```

- `TYPE Name = ^T` — pointer type to base type `T`
- `^Var` — address-of (must be a mutable place)
- `Ptr^` — dereference (r-value and assign target)

### SET + DEFINE

```text
TYPE Digits = SET OF INTEGER
DEFINE Lucky(3, 7, 9) : Digits
```

`DEFINE` creates a named set instance of a previously declared `SET OF` type.

## Pipeline

```text
Lexer (TYPE, ENDTYPE, SET, DEFINE, `.`, `^`)
  → Parser (record / enum / pointer / set decls; MemberExpression; pointer ops)
  → AST
  → Checker (type table, fields, enum members, pointer/set rules, C_* diagnostics)
  → Interpreter (RecordValue / enum / pointer cells / set values)
  → IR / Translator (Python `@dataclass` / IntEnum / `_pp_addr` helpers / set + `_pp_define`)
  → Language Service / Monaco (hover, `.` completion, rename, …)
```

## Representation

| Form | AST | Checker | Interpreter | Translator |
| --- | --- | --- | --- | --- |
| Record | `TypeDeclaration` + field `DeclareStatement`s; `NamedType`; `MemberExpression` | `PpType` `{ kind: 'record', … }` | `RecordValue` | IR → `@dataclass` |
| Enum | `EnumTypeDeclaration` | enum type + members | enum ordinal / name | `class Name(IntEnum)` |
| Pointer | `PointerTypeDeclaration`; address-of / deref exprs | pointer-to `T` | pointer cell / place | `_pp_addr` / `_pp_pload` / `_pp_pstore` |
| SET | `SetTypeDeclaration` + `DefineStatement` | set-of `T` | set value | `set` + `_pp_define` |

## Field lookup (records)

- Case-insensitive (Cambridge), display casing preserved from declaration.
- Nested access: `S.Home.City`, `Class[i].Marks[j]`.
- Checker codes: `C_UNKNOWN_FIELD`, `C_NOT_RECORD`, `C_DUP_FIELD`, `C_UNKNOWN_TYPE`, `C_DUP_TYPE`, `C_RECURSIVE_TYPE`, `C_ASSIGN_TYPE`.
- Field symbols are **not** entered into the global variable scope — `Student.Name` and `Teacher.Name` do not collide. Language-service field refs resolve against the object expression’s record type.

## Type resolution

1. Pass 0 registers all `TYPE` names (forward refs allowed).
2. Fields / bases / set element types resolve against the TYPE table.
3. Recursive **record** TYPE graphs are rejected (`C_RECURSIVE_TYPE`). Pointer fields to named types are allowed (no cycle through record containment).
4. `DECLARE` / parameters / `RETURNS` may use `NamedType`.

## Default values (record fields)

| Field type | Default |
| --- | --- |
| INTEGER | `0` |
| REAL | `0.0` |
| STRING | `""` |
| BOOLEAN | `FALSE` |
| CHAR | `' '` |
| DATE | `01/01/1900` |
| nested record | fresh default instance |
| ARRAY | allocated bounds, each slot defaulted |
| pointer | NIL / unset |
| enum | first member (implementation default) |

Record and array **assignment** and **parameter passing** are by value (deep clone).  
The Python translator emits `copy.deepcopy(...)` for composite stores and call arguments so translated output matches the interpreter.

Whole-array assignment requires matching element type, rank, and (when known) identical bounds — checker and runtime agree.

## Performance

- TYPE table is built once per check.
- Field lookup is linear in field count (small for exam programs).
- Interpreter resolves member/index/pointer chains via a shared place resolver.

## Limitations

- `TYPE` has no visibility, methods, or inheritance — see [`OBJECT_ORIENTED_PROGRAMMING.md`](./OBJECT_ORIENTED_PROGRAMMING.md) for `CLASS`
- Recursive **records** are forbidden; use pointer fields for linked structures
- Whole-record / whole-array relational comparison is rejected (`C_COMPARE_TYPE`); compare fields or elements
- `GETRECORD` / `PUTRECORD` work with TYPE records — see [`FILE_IO.md`](./FILE_IO.md)
- Python→Cambridge reverse recovers enum/pointer/SET from PseudoPilot-emitted shapes (`IntEnum`, `_pp_addr` / `_pp_*`, `_pp_define`); hand-written variants may not round-trip

## Relationship to `CLASS` (OOP)

`CLASS` reuses member-access AST and case-insensitive name tables (`TYPE`/`CLASS` names collide: `C_DUP_TYPE`/`C_DUP_CLASS`) but uses **reference** semantics, unlike `TYPE` value copy. See [`OBJECT_ORIENTED_PROGRAMMING.md`](./OBJECT_ORIENTED_PROGRAMMING.md).
