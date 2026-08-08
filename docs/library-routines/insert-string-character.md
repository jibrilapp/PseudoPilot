# Paper 2 insert — string & character

Source: [June 2024 Paper 2 Insert](https://www.cambridgeinternational.org/Images/673618-june-2024-insert-paper-21.pdf) (representative exam insert). Individual papers may vary; PseudoPilot ships a **fixed Core pack**, not every historical one-off name.

Insert note: a string of length 1 may be treated as `CHAR` or `STRING`; `CHAR` may assign/concatenate with `STRING`; longer `STRING` cannot assign to `CHAR`.

---

## LEFT

**Status:** SUPPORTED *(PseudoPilot Core extension / common insert — **not** in Teacher Guide §5.5 index)*

### Syntax

```text
LEFT(ThisString : STRING, x : INTEGER) RETURNS STRING
```

### Parameters

| Name | Type | Role |
| --- | --- | --- |
| `ThisString` | `STRING` | Source |
| `x` | `INTEGER` | Count from the left |

### Return

`STRING` — leftmost `x` characters.

### What it does

Takes a prefix of the string.

### Example

```text
OUTPUT LEFT("ABCDEFGH", 3)
// "ABC"
```

### Restrictions

Malformed call → error. Soft CHAR accepted in PseudoPilot.

### Common mistake

Assuming `LEFT` is in the Teacher Guide keyword index — cite the insert / PseudoPilot Core when teaching.

### Support notes

Listed here because Cambridge exam inserts include it. Marked as Core extension in [`BUILTINS.md`](../language/BUILTINS.md).

---

## TO_UPPER

**Status:** NOT YET SUPPORTED

### Syntax

```text
TO_UPPER(x : <type>) RETURNS <type>
```

`<type>` may be `CHAR` or `STRING`. Returns the same kind with all characters upper-cased.

### Parameters

| Name | Type | Role |
| --- | --- | --- |
| `x` | `CHAR` or `STRING` | Value to convert |

### Return

Same type as `x`.

### What it does

Upper-cases every character (insert examples include digits/spaces unchanged in place).

### Example

```text
OUTPUT TO_UPPER("Error 803")
// "ERROR 803"
OUTPUT TO_UPPER('a')
// 'A'
```

### Restrictions

Not in PseudoPilot Core registry. Use Guide `UCASE` for single characters, or wait for exam-pack registry.

### Common mistake

Writing `TO_UPPER` in PseudoPilot expecting Core support — currently unsupported.

### Support notes

Per-paper insert; CONFORMANCE: insert pack registry beyond ASC/DATE still open.

---

## TO_LOWER

**Status:** NOT YET SUPPORTED

### Syntax

```text
TO_LOWER(x : <type>) RETURNS <type>
```

### Parameters

| Name | Type | Role |
| --- | --- | --- |
| `x` | `CHAR` or `STRING` | Value to convert |

### Return

Same type as `x`, lower-cased.

### What it does

Lower-cases characters in `x`.

### Example

```text
OUTPUT TO_LOWER("JIM 803")
// "jim 803"
OUTPUT TO_LOWER('W')
// 'w'
```

### Restrictions

Not in Core pack. Prefer Guide `LCASE` for CHAR.

### Common mistake

Confusing insert `TO_LOWER` with Guide `LCASE`.

### Support notes

Same registry gap as `TO_UPPER`.

---

## NUM_TO_STR

**Status:** NOT YET SUPPORTED

### Syntax

```text
NUM_TO_STR(x : <numeric>) RETURNS <stringy>
```

`<numeric>` may be `REAL` or `INTEGER`; result may be `CHAR` or `STRING` per insert typing notes.

### Parameters

| Name | Type | Role |
| --- | --- | --- |
| `x` | `REAL` / `INTEGER` | Number to format |

### Return

String representation. Negatives begin with `-`.

### What it does

Converts a number to text.

### Example

```text
OUTPUT NUM_TO_STR(87.5)
// "87.5"
```

### Restrictions

Not implemented in Core. No PseudoPilot invent-on-the-fly translation for undocumented inserts (ADR 0005).

### Common mistake

Assuming automatic number→string coercion in `OUTPUT` covers exam questions that require `NUM_TO_STR`.

### Support notes

Exam-insert only until a pack registers it.

---

## STR_TO_NUM

**Status:** NOT YET SUPPORTED

### Syntax

```text
STR_TO_NUM(x : <stringy>) RETURNS <numeric>
```

### Parameters

| Name | Type | Role |
| --- | --- | --- |
| `x` | `CHAR` / `STRING` | Text holding a number |

### Return

Numeric value; leading `-` yields a negative.

### What it does

Parses a numeric string.

### Example

```text
OUTPUT STR_TO_NUM("23.45")
// 23.45
```

### Restrictions

Not in Core. Related supported helper: [IS_NUM](#is_num) to validate before conversion in algorithms you write yourself.

### Common mistake

Calling `STR_TO_NUM` in PseudoPilot Core projects.

### Support notes

Appears on June 2024 insert; not yet registered.

---

## IS_NUM

**Status:** SUPPORTED *(Paper 2 insert — shipped as Core)*

### Syntax

```text
IS_NUM(ThisString : STRING) RETURNS BOOLEAN
```

Insert: `<type>` may be `CHAR` or `STRING`.

### Parameters

| Name | Type | Role |
| --- | --- | --- |
| `ThisString` | `STRING` / `CHAR` | Candidate numeric text |

### Return

`TRUE` if the value represents a valid numeric literal.

### What it does

Validates numeric text before conversion-style logic.

### Example

```text
OUTPUT IS_NUM("-12.36")
// TRUE
```

### Restrictions

PseudoPilot: empty/whitespace → `FALSE`; exponents/hex → `FALSE` (optional sign + decimal digits only).

### Common mistake

Expecting scientific notation to count as numeric.

### Support notes

Core insert pack. See [`BUILTINS.md`](../language/BUILTINS.md).

---

## ASC

**Status:** SUPPORTED *(Paper 2 insert — Core)*

### Syntax

```text
ASC(ThisChar : CHAR) RETURNS INTEGER
```

### Parameters

| Name | Type | Role |
| --- | --- | --- |
| `ThisChar` | `CHAR` | Character |

### Return

ASCII / code-point integer.

### What it does

Maps a character to its code.

### Example

```text
OUTPUT ASC('A')
// 65
OUTPUT ASC('B')
// 66
```

### Restrictions

`CHAR` only — multi-character `STRING` rejected. Empty CHAR → runtime error.

### Common mistake

Passing a `STRING` longer than one character.

### Support notes

Core. Pair with [CHR](#chr).

---

## CHR

**Status:** SUPPORTED *(Paper 2 insert — Core)*

### Syntax

```text
CHR(x : INTEGER) RETURNS CHAR
```

### Parameters

| Name | Type | Role |
| --- | --- | --- |
| `x` | `INTEGER` | Code point |

### Return

`CHAR` for that code.

### What it does

Inverse of `ASC`.

### Example

```text
OUTPUT CHR(65)
// 'A'
```

### Restrictions

Out-of-range code → `R_BUILTIN` in PseudoPilot.

### Common mistake

Expecting a `STRING` return for multi-byte concepts; Cambridge form returns `CHAR`.

### Support notes

Core insert pack.
