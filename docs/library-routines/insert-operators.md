# Insert operators

Paper 2 inserts list operators alongside functions. Full operator teaching notes: [Operators (syntax)](../cambridge-syntax/operators.md). All of the following are **SUPPORTED** in PseudoPilot unless noted.

---

## & (insert reminder)

**Status:** SUPPORTED

Joins strings (and CHAR with STRING on inserts). Example: `"Summer" & " " & "Pudding"`.

See [Concatenation &](./guide-string.md#concatenation-).

---

## AND

**Status:** SUPPORTED

Logical AND on booleans. Example: `TRUE AND FALSE` → `FALSE`.

---

## OR

**Status:** SUPPORTED

Logical OR. Example: `TRUE OR FALSE` → `TRUE`.

---

## NOT

**Status:** SUPPORTED

Logical NOT. Example: `NOT TRUE` → `FALSE`.

---

## MOD

**Status:** SUPPORTED

Remainder. Example: `10 MOD 3` → `1`.

---

## DIV

**Status:** SUPPORTED

Integer quotient. Example: `10 DIV 3` → `3`.

---

## Comparison operators

**Status:** SUPPORTED

```text
=    >    <    >=    <=    <>
```

Insert notes (summarised):

- Compare items of the same type; result `BOOLEAN`.
- May compare `REAL` with `INTEGER`.
- May compare `CHAR` with `STRING`.
- Case-sensitive for CHAR/STRING.
- Cannot compare two records with these operators.
- `"Program" = "program"` → `FALSE`.

### Common mistake

Using comparison operators to assign values, or comparing entire records with `=`.

### Related

- [Relational operators](../cambridge-syntax/operators.md#relational-operators)
- [AND OR NOT](../cambridge-syntax/operators.md#and-or-not)
