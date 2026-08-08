# Guide string routines (§5.5)

Teacher Guide string functions and `&`. Positions are **1-based** where applicable.

---

## LENGTH

**Status:** SUPPORTED

### Syntax

```text
LENGTH(ThisString : STRING) RETURNS INTEGER
```

### Parameters

| Name | Type | Role |
| --- | --- | --- |
| `ThisString` | `STRING` | Text to measure |

PseudoPilot soft-accepts `CHAR` as well.

### Return

`INTEGER` — character count.

### What it does

Returns how many characters are in the string.

### Example

```text
OUTPUT LENGTH("Happy Days")
// 10
```

### Restrictions

Malformed calls / wrong types → error (exam insert wording; PseudoPilot `C_BUILTIN_*` / `R_BUILTIN`).

### Common mistake

Assuming 0-based length semantics from other languages, or using `LEN`.

### Support notes

Guide §5.5. Soft CHAR acceptance is a PseudoPilot convenience.

---

## RIGHT

**Status:** SUPPORTED

### Syntax

```text
RIGHT(ThisString : STRING, x : INTEGER) RETURNS STRING
```

### Parameters

| Name | Type | Role |
| --- | --- | --- |
| `ThisString` | `STRING` | Source text |
| `x` | `INTEGER` | Number of characters from the right |

### Return

`STRING` — rightmost `x` characters.

### What it does

Takes the ending slice of the string of length `x`.

### Example

```text
OUTPUT RIGHT("ABCDEFGH", 3)
// "FGH"
```

### Restrictions

Improper call → error. PseudoPilot: `RIGHT(s, 0)` → `""`.

### Common mistake

Expecting 0-based indices, or confusing with `MID`.

### Support notes

Soft CHAR accepted. Translator uses `_pp_right` so length `0` stays empty.

---

## MID

**Status:** SUPPORTED

### Syntax

```text
MID(ThisString : STRING, x : INTEGER, y : INTEGER) RETURNS STRING
```

### Parameters

| Name | Type | Role |
| --- | --- | --- |
| `ThisString` | `STRING` | Source |
| `x` | `INTEGER` | **1-based** start position |
| `y` | `INTEGER` | Length of substring |

### Return

`STRING` of length `y` starting at position `x`.

### What it does

Extracts a middle substring.

### Example

```text
OUTPUT MID("ABCDEFGH", 2, 3)
// "BCD"
```

### Restrictions

`x < 1` → runtime error in PseudoPilot. Malformed calls → error.

### Common mistake

Using `0` as the start index (Python-style).

### Support notes

Core Guide builtin; soft CHAR accepted.

---

## LCASE

**Status:** PARTIALLY SUPPORTED

### Syntax

```text
LCASE(ThisChar : CHAR) RETURNS CHAR
```

### Parameters

| Name | Type | Role |
| --- | --- | --- |
| `ThisChar` | `CHAR` | Character to convert |

### Return

Lower-case `CHAR`. If not an upper-case letter, returned unchanged.

### What it does

Converts one character to lower case.

### Example

```text
OUTPUT LCASE('W')
// 'w'
```

### Restrictions

Guide signature is **CHAR → CHAR**. PseudoPilot also soft-accepts `STRING` (whole-string casefold) — **partial** vs strict Guide wording.

### Common mistake

Assuming Guide `LCASE` always takes a full `STRING` (that is closer to insert `TO_LOWER`).

### Support notes

See [TO_LOWER](./insert-string-character.md#to_lower) (insert; not in Core pack).

---

## UCASE

**Status:** PARTIALLY SUPPORTED

### Syntax

```text
UCASE(ThisChar : CHAR) RETURNS CHAR
```

### Parameters

| Name | Type | Role |
| --- | --- | --- |
| `ThisChar` | `CHAR` | Character to convert |

### Return

Upper-case `CHAR`. Non-letters unchanged.

### What it does

Converts one character to upper case.

### Example

```text
OUTPUT UCASE('h')
// 'H'
```

### Restrictions

Guide: CHAR only. PseudoPilot soft STRING → **partial**.

### Common mistake

Using `TO_UPPER` from an insert paper without checking whether that paper provides it.

### Support notes

Related insert: [TO_UPPER](./insert-string-character.md#to_upper) — **NOT YET SUPPORTED** in Core.

---

## Concatenation &

**Status:** SUPPORTED

### Syntax

```text
<string> & <string>
```

### Parameters

Operands: `STRING` (exam inserts also allow concatenating `CHAR` with `STRING`).

### Return

Joined `STRING`.

### What it does

Concatenates (joins) strings.

### Example

```text
OUTPUT "Summer" & " " & "Pudding"
// "Summer Pudding"
```

### Restrictions

Wrong types → error. Do not use `+` for strings in PseudoPilot.

### Common mistake

Writing `+` between strings.

### Support notes

Operator, not a function call. Also listed on Paper 2 inserts.
