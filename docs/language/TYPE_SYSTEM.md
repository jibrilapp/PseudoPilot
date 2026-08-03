# TYPE system (Cambridge records)

Cambridge 9618 user-defined **record** types via `TYPE` … `ENDTYPE`.

## Syntax

```text
TYPE Student
    DECLARE Name : STRING
    DECLARE Age : INTEGER
ENDTYPE

DECLARE S : Student
S.Name ← "Alice"
OUTPUT S.Age
```

Nested records, arrays of records, and records containing arrays are supported.

Enum / pointer / SET forms (`TYPE Name = …`) are **not** implemented (parser emits `E_UNSUPPORTED_TYPE_FORM`).

## Pipeline

```text
Lexer (TYPE, ENDTYPE, `.`)
  → Parser (TypeDeclaration, NamedType, MemberExpression)
  → AST
  → Checker (type table, field lookup, C_* diagnostics)
  → Interpreter (RecordValue, default init, by-value copy)
  → IR / Translator (Python `@dataclass`)
  → Language Service / Monaco (hover, `.` completion, rename, …)
```

## Record representation

| Layer | Representation |
| --- | --- |
| AST | `TypeDeclaration` + field `DeclareStatement`s; `NamedType`; `MemberExpression` |
| Checker | `PpType` `{ kind: 'record', name, fields }` in a TYPE table |
| Interpreter | `RecordValue` `{ kind: 'RECORD', typeName, fields: Map }` |
| Translator | IR `IrTypeDeclaration` → Python `@dataclass` |

## Field lookup

- Case-insensitive (Cambridge), display casing preserved from declaration.
- Nested access: `S.Home.City`, `Class[i].Marks[j]`.
- Checker codes: `C_UNKNOWN_FIELD`, `C_NOT_RECORD`, `C_DUP_FIELD`, `C_UNKNOWN_TYPE`, `C_DUP_TYPE`, `C_RECURSIVE_TYPE`, `C_ASSIGN_TYPE`.
- Field symbols are **not** entered into the global variable scope — `Student.Name` and `Teacher.Name` do not collide. Language-service field refs resolve against the object expression’s record type.

## Type resolution

1. Pass 0 registers all `TYPE` names (forward refs allowed).
2. Fields resolve against the TYPE table.
3. Recursive TYPE graphs are rejected (`C_RECURSIVE_TYPE`).
4. `DECLARE` / parameters / `RETURNS` may use `NamedType`.

## Default values

| Field type | Default |
| --- | --- |
| INTEGER | `0` |
| REAL | `0.0` |
| STRING | `""` |
| BOOLEAN | `FALSE` |
| CHAR | `' '` |
| nested record | fresh default instance |
| ARRAY | allocated bounds, each slot defaulted |

Record and array **assignment** and **parameter passing** are by value (deep clone).
The Python translator emits `copy.deepcopy(...)` for composite stores and call arguments so translated output matches the interpreter.

## Performance

- TYPE table is built once per check.
- Field lookup is linear in field count (small for exam programs).
- Interpreter resolves member/index chains via a shared place resolver (no duplicate walks).

## Limitations

- No enum / pointer / SET TYPE forms
- No `CLASS` / OOP (next milestone)
- No `GETRECORD` / `PUTRECORD` file ops yet
- Recursive records are forbidden (pointers deferred)
- Whole-record / whole-array relational comparison is rejected (`C_COMPARE_TYPE`); compare fields or elements
- Python→Cambridge reverse recovers `list[…]` TYPE fields when a `# ARRAY[l:u]` comment is present (PseudoPilot emit); hand-written lambdas without that comment get placeholder `1:1` bounds

## Future OOP relationship

`TYPE` record symbols, member lookup (`MemberExpression`), and type resolution are designed so a future `CLASS` milestone can reuse:

- the same member-access AST
- checker field / method lookup patterns
- interpreter place resolution for `obj.member`

Do **not** implement `CLASS` in this milestone.
