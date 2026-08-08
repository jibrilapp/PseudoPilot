# Guide numeric routines (§5.6)

---

## INT

**Status:** SUPPORTED

### Syntax

```text
INT(x : REAL) RETURNS INTEGER
```

### Parameters

| Name | Type | Role |
| --- | --- | --- |
| `x` | `REAL` | Value whose integer part is needed |

PseudoPilot also accepts `INTEGER` input.

### Return

`INTEGER` — integer part (truncate toward zero).

### What it does

Drops the fractional part of a real number.

### Example

```text
OUTPUT INT(27.5415)
// 27
```

### Restrictions

Malformed call → error.

### Common mistake

Expecting banker’s rounding or floor for negatives — PseudoPilot truncates toward zero (e.g. `INT(-1.8)` → `-1`).

### Support notes

Guide §5.6; also repeated on Paper 2 inserts.

---

## RAND

**Status:** SUPPORTED

### Syntax

```text
RAND(x : INTEGER) RETURNS REAL
```

### Parameters

| Name | Type | Role |
| --- | --- | --- |
| `x` | `INTEGER` | Exclusive upper bound of the range |

### Return

`REAL` in **`[0, x)`** — includes 0, excludes `x`.

### What it does

Returns a pseudo-random real number suitable for simulations and games.

### Example

```text
OUTPUT RAND(87)
// e.g. 35.43
```

### Restrictions

Non-positive `x` → runtime error in PseudoPilot. Malformed call → error.

### Common mistake

Thinking the result is an `INTEGER`, or that `x` is inclusive.

### Support notes

Injectable RNG in the interpreter for tests. Translator: `random.random() * (x)`.
