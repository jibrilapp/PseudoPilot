# User-defined types (§4)

Extended / A Level surface: enumerated types, pointers, records, and sets.

---

## Enumerated TYPE

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
TYPE <identifier> = (<value1>, <value2>, <value3>, ...)
```

### Explanation

A non-composite type whose value is one of a named list (like seasons or directions).

### Example

```text
TYPE Season = (Spring, Summer, Autumn, Winter)
DECLARE ThisSeason : Season
ThisSeason ← Spring
```

### Important Cambridge rules

- Values are identifiers in the enum list.
- After definition, use the type like any other data type in `DECLARE`.

### Common exam mistake

Treating enum values as strings (`"Spring"`) instead of enum identifiers (`Spring`).

### Related

- [Using user-defined types](#field-access-)
- [TYPE_SYSTEM](../language/TYPE_SYSTEM.md)

---

## Pointer TYPE

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
TYPE <identifier> = ^<data type>
```

### Explanation

A pointer type holds a reference to a memory location that stores a value of the given type. The `^` marks the pointer.

### Example

```text
TYPE TIntPointer = ^INTEGER
TYPE TCharPointer = ^CHAR
DECLARE MyPointer : TIntPointer
```

### Important Cambridge rules

- Declaring a **variable** of pointer type does **not** use `^` in the `DECLARE` line.
- `^` appears in the `TYPE` definition and in address / dereference expressions.

### Common exam mistake

Writing `DECLARE MyPointer : ^INTEGER` instead of declaring via a named pointer type, or confusing `^` with exponentiation (Cambridge uses `^` for pointers, not power).

### Related

- [Pointer operations](#pointer-operations-)
- [Operators](./operators.md)

---

## Pointer operations ^

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
<pointerVariable> ← ^<variable>   // address-of
<variable> ← <pointerVariable>^ // dereference
```

### Explanation

`^Var` takes the address of `Var`. `Ptr^` reads (or is used with) the value at that address.

### Example

```text
DECLARE ThisSeason : Season
DECLARE MyPointer : TIntPointer
MyPointer ← ^ThisSeason
NextSeason ← MyPointer^ + 1
```

*(Guide example uses pointer with season arithmetic; teach carefully with your paper’s types.)*

### Important Cambridge rules

- Address-of and dereference are context-dependent uses of `^`.
- PseudoPilot implements both in the Extended pipeline.

### Common exam mistake

Using `^` as “to the power of”.

### Related

- [Pointer TYPE](#pointer-type)
- [SPECIFICATION §2.6](../language/SPECIFICATION.md)

---

## Record TYPE … ENDTYPE

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
TYPE <identifier>
  DECLARE <field> : <type>
  DECLARE <field> : <type>
  ...
ENDTYPE
```

### Explanation

A composite type grouping fields under one name (e.g. a student record).

### Example

```text
TYPE StudentRecord
  DECLARE LastName : STRING
  DECLARE FirstName : STRING
  DECLARE DateOfBirth : DATE
  DECLARE YearGroup : INTEGER
  DECLARE FormGroup : CHAR
ENDTYPE
```

### Important Cambridge rules

- Fields are declared inside `TYPE` … `ENDTYPE`.
- Records can contain arrays; arrays can contain records.

### Common exam mistake

Forgetting `ENDTYPE`, or using `CLASS` when the paper asks for a record `TYPE`.

### Related

- [Field access](#field-access-)
- [OOP CLASS](./oop.md)

---

## Field access .

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
<recordVariable>.<fieldName>
```

Whole-record assignment by value:

```text
<recordVariable> ← <recordVariable>
```

### Explanation

Dot selects a field. Whole-record assignment copies field values (PseudoPilot: deep clone for value semantics).

### Example

```text
DECLARE Pupil1 : StudentRecord
DECLARE Pupil2 : StudentRecord
Pupil1.LastName ← "Johnson"
Pupil1.FirstName ← "Leroy"
Pupil2 ← Pupil1
```

### Important Cambridge rules

- After definition, user types are used like built-in types.
- Nested fields and arrays of records are allowed.

### Common exam mistake

Writing `Pupil1[LastName]` as if the record were an array.

### Related

- [Record TYPE](#record-type--endtype)
- [Arrays of records](./arrays.md)

---

## SET OF and DEFINE

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
TYPE <identifier> = SET OF <base type>
DEFINE <setIdentifier> (<value1>, <value2>, ...) : <set type identifier>
```

### Explanation

Defines a set type over a base type, then creates a named set value with `DEFINE`.

### Example

```text
TYPE LetterSet = SET OF CHAR
DEFINE Vowels ('A','E','I','O','U'): LetterSet
```

### Important Cambridge rules

- `SET OF` names the type; `DEFINE` builds an instance.
- ADTs such as stack/queue are **not** extra keywords — build them from available structures (Guide / syllabus approach).

### Common exam mistake

Inventing `STACK` / `QUEUE` keywords as if they were Guide syntax.

### Related

- [TYPE_SYSTEM](../language/TYPE_SYSTEM.md)
- [CONFORMANCE §4.4](../CONFORMANCE.md)
