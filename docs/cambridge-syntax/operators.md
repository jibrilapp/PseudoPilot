# Operators (§5.2–5.4)

Arithmetic, relational, and logic operators. String `&` and library functions: [Library Routines](../library-routines/README.md).

---

## Addition, subtraction, multiplication

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
+   -   *
```

Also unary `+` / `-`.

### Explanation

Standard arithmetic. `*` and `/` bind more tightly than `+` and `-`.

### Example

```text
TotalToPay ← NumberOfHours * HourlyRate
Counter ← Counter + 1
```

### Important Cambridge rules

- Prefer parentheses in complex expressions.
- Multiplication/division outrank addition/subtraction.

### Common exam mistake

Relying on unspoken precedence instead of parentheses in exam answers.

### Related

- [Division `/`](#division-)
- [DIV](#div) / [MOD](#mod)

---

## Division /

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
<operand> / <operand>
```

### Explanation

Division. The result is always **REAL**, even when both operands are integers.

### Example

```text
DECLARE Average : REAL
Average ← Total / Count
```

### Important Cambridge rules

- Result type is `REAL` (Guide §5.2).
- For integer quotient use `DIV`; for remainder use `MOD`.

### Common exam mistake

Expecting `7 / 2` to be the integer `3` — that requires `DIV`.

### Related

- [DIV](#div)
- [INT](../library-routines/guide-numeric.md#int)

---

## DIV

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
<operand> DIV <operand>
```

### Explanation

Integer division: the integer quotient (part before the decimal point).

### Example

```text
OUTPUT 10 DIV 3
// 3
```

### Important Cambridge rules

- Operands are integers at runtime in PseudoPilot.
- Guide is silent on negatives; PseudoPilot truncates toward zero (aligned with translator helpers).

### Common exam mistake

Using `/` when the mark scheme expects `DIV`.

### Related

- [MOD](#mod)
- [Insert operators](../library-routines/insert-operators.md)

---

## MOD

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
<operand> MOD <operand>
```

### Explanation

Remainder after integer division (modulus).

### Example

```text
OUTPUT 10 MOD 3
// 1
```

### Important Cambridge rules

- INTEGER operands at runtime.
- Negative-dividend behaviour follows PseudoPilot’s trunc-toward-zero policy (Guide silent).

### Common exam mistake

Confusing `MOD` with percentage or with `/`.

### Related

- [DIV](#div)

---

## Relational operators

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
>    <    >=    <=    =    <>
```

### Explanation

Compare two values. The result is always `BOOLEAN`.

### Example

```text
IF ChallengerScore > ChampionScore THEN
  OUTPUT "New champion"
ENDIF
```

### Important Cambridge rules

- `=` means **equal to**, never assignment.
- `<>` means not equal.
- Use parentheses in complex expressions.
- Do not chain `1 < x < 10` as a single range test — use `x > 1 AND x < 10`.

### Common exam mistake

Using `=` for assignment, or writing `!=` instead of `<>`.

### Related

- [Assignment ←](./types-literals.md#assignment-)
- [AND OR NOT](#and-or-not)

---

## AND OR NOT

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
<boolean> AND <boolean>
<boolean> OR <boolean>
NOT <boolean>
```

### Explanation

Logic operators on `BOOLEAN` values. Operands and results are boolean.

### Example

```text
IF Score >= 50 AND Score < 70 THEN
  OUTPUT "Merit"
ENDIF
IF NOT GameOver THEN
  OUTPUT "Continue"
ENDIF
```

### Important Cambridge rules

- Only `AND`, `OR`, `NOT` (Guide §5.4).
- PseudoPilot **short-circuits** `AND`/`OR` (Guide silent — documented extension).

### Common exam mistake

Writing `&&` / `||` / `!` from other languages.

### Related

- [BOOLEAN](./types-literals.md#boolean)
- [CONFORMANCE §4.5](../CONFORMANCE.md)

---

## Operator precedence

**Status:** SUPPORTED

### Exact Cambridge syntax

Guide: `*` and `/` above `+` and `-`; use parentheses for clarity. PseudoPilot Pratt levels (high → low):

1. `(…)`, calls, indexing  
2. Unary `+` `-` `NOT`  
3. `*` `/` `DIV` `MOD`  
4. `+` `-` `&`  
5. Relational  
6. `AND`  
7. `OR`

### Explanation

When unsure, add parentheses — Cambridge recommends this for complex expressions.

### Example

```text
OUTPUT (A + B) * C
OUTPUT x > 1 AND x < 10
```

### Important Cambridge rules

- Prefer explicit parentheses over relying on memory of precedence tables in exams.

### Common exam mistake

`NOT A AND B` misread without parentheses.

### Related

- [SPECIFICATION §2.7](../language/SPECIFICATION.md)
