# Types, literals, DECLARE, assignment (§2)

---

## INTEGER

**Status:** SUPPORTED

### Exact Cambridge syntax

Type keyword: `INTEGER` — a whole number.

### Explanation

Use `INTEGER` for counts, indices, and whole quantities with no fractional part.

### Example

```text
DECLARE Counter : INTEGER
Counter ← 0
```

### Important Cambridge rules

- Whole numbers only; use `REAL` when a fractional part is needed.
- There is no separate `TIME` type in Cambridge 9618.

### Common exam mistake

Declaring money or averages as `INTEGER` when a fractional part is required.

### Related

- [REAL](#real)
- [INT](../library-routines/guide-numeric.md#int)

---

## REAL

**Status:** SUPPORTED

### Exact Cambridge syntax

Type keyword: `REAL` — a number that may have a fractional part.

### Explanation

Use `REAL` for measurements, rates, and values that need decimals. Division with `/` always yields `REAL`.

### Example

```text
DECLARE TotalToPay : REAL
CONSTANT HourlyRate = 6.50
TotalToPay ← 10 * HourlyRate
```

### Important Cambridge rules

- Real literals must have at least one digit on each side of the decimal point (e.g. `4.7`, `0.3`, `-4.0`).

### Common exam mistake

Writing `.5` or `5.` — Cambridge requires `0.5` / `5.0`. PseudoPilot warns (`W_REAL_LITERAL`) and can error under `strictCambridge`.

### Related

- [Real literals](#real-literals)
- [Division `/`](./operators.md#division-)

---

## CHAR

**Status:** SUPPORTED

### Exact Cambridge syntax

Type keyword: `CHAR` — a single character. Literals use single quotes: `'x'`.

### Explanation

One character only. Longer text belongs in `STRING`.

### Example

```text
DECLARE Grade : CHAR
Grade ← 'A'
```

### Important Cambridge rules

- Delimit with single quotes.
- Exam inserts often allow a length-1 string to be treated as `CHAR` in some operations — see Library Routines.

### Common exam mistake

Using double quotes for a character (`"A"`) or putting multiple characters in a `CHAR`.

### Related

- [STRING](#string)
- [ASC](../library-routines/insert-string-character.md#asc) / [CHR](../library-routines/insert-string-character.md#chr)

---

## STRING

**Status:** SUPPORTED

### Exact Cambridge syntax

Type keyword: `STRING` — zero or more characters. Literals use double quotes: `"…"`.

### Explanation

Text of any length, including the empty string `""`.

### Example

```text
DECLARE Name : STRING
Name ← "Ali"
Name ← Name & " Khan"
```

### Important Cambridge rules

- Use `&` to join strings, not `+`.
- Empty string `""` is valid.

### Common exam mistake

Using `+` for concatenation (type error in PseudoPilot) or forgetting quotes.

### Related

- [`&` concatenation](../library-routines/guide-string.md#concatenation-)
- [LENGTH](../library-routines/guide-string.md#length)

---

## BOOLEAN

**Status:** SUPPORTED

### Exact Cambridge syntax

Type keyword: `BOOLEAN`. Literals: `TRUE`, `FALSE`.

### Explanation

Logical yes/no values. Relational and logic operators produce `BOOLEAN`.

### Example

```text
DECLARE GameOver : BOOLEAN
GameOver ← FALSE
IF Score >= 100 THEN
  GameOver ← TRUE
ENDIF
```

### Important Cambridge rules

- Only `TRUE` and `FALSE` (case-insensitive in PseudoPilot; exams print upper-case).

### Common exam mistake

Writing `true`/`false` in a programming-language style without matching exam convention, or using `1`/`0` as booleans.

### Related

- [AND / OR / NOT](./operators.md#and-or-not)

---

## DATE

**Status:** SUPPORTED

### Exact Cambridge syntax

Type keyword: `DATE`. Literals normally `dd/mm/yyyy` (state the format when clarity matters).

### Explanation

A calendar date. Paper 2 inserts provide helpers such as `DAY`, `MONTH`, `SETDATE`, `TODAY`.

### Example

```text
DECLARE DateOfBirth : DATE
DateOfBirth ← 02/01/2005
```

### Important Cambridge rules

- No standalone `TIME` datatype in the Guide.
- Good practice: say explicitly that a value is `DATE` and explain the format.

### Common exam mistake

Treating `02/01/2005` as division, or inventing a `TIME` type.

### Related

- [DATE insert routines](../library-routines/insert-date.md)
- [CONFORMANCE §4.2](../CONFORMANCE.md)

---

## Integer literals

**Status:** SUPPORTED

### Exact Cambridge syntax

Written in denary, e.g. `5`, `-3`.

### Explanation

Whole-number constants in expressions and assignments.

### Example

```text
Counter ← 5
Counter ← Counter + 1
```

### Important Cambridge rules

- Denary (base 10) notation as usual.

### Common exam mistake

Confusing integer literals with real literals that need a decimal point.

### Related

- [INTEGER](#integer)

---

## Real literals

**Status:** SUPPORTED

### Exact Cambridge syntax

At least one digit on **both** sides of `.`, e.g. `4.7`, `0.3`, `-4.0`, `0.0`.

### Explanation

Fractional number constants. Zeros are added if needed so both sides of the point have a digit.

### Example

```text
CONSTANT HourlyRate = 6.50
OUTPUT 0.0
```

### Important Cambridge rules

- `.5` and `5.` are not Cambridge-style real literals.

### Common exam mistake

Writing `.5` — PseudoPilot: warning / strict error. Prefer `0.5`.

### Related

- [REAL](#real)
- [CONFORMANCE §4.2](../CONFORMANCE.md)

---

## CHAR literals

**Status:** SUPPORTED

### Exact Cambridge syntax

Single character in single quotes: `'x'`, `'C'`, `'@'`.

### Explanation

One character value of type `CHAR`.

### Example

```text
NoughtsAndCrosses[2,3] ← 'X'
```

### Important Cambridge rules

- Single quotes for `CHAR`; double quotes for `STRING`.

### Common exam mistake

`'AB'` as a CHAR, or using the wrong quote style.

### Related

- [CHAR](#char)

---

## STRING literals

**Status:** SUPPORTED

### Exact Cambridge syntax

Double-quoted text, including `""` (empty string).

### Explanation

String constants for messages and data.

### Example

```text
OUTPUT "You have ", Lives, " lives left"
CONSTANT DefaultText = "N/A"
```

### Important Cambridge rules

- May contain no characters (`""`).

### Common exam mistake

Leaving quotes unmatched or embedding unescaped quotes incorrectly.

### Related

- [STRING](#string)
- [OUTPUT](./input-output.md#output)

---

## BOOLEAN literals

**Status:** SUPPORTED

### Exact Cambridge syntax

`TRUE`, `FALSE`.

### Explanation

The only boolean literal values.

### Example

```text
UNTIL Password = "Secret"
// condition uses relational result (BOOLEAN), not TRUE/FALSE literals necessarily
DECLARE Flag : BOOLEAN
Flag ← TRUE
```

### Important Cambridge rules

- Result of comparisons is always `BOOLEAN`.

### Common exam mistake

Assigning `"TRUE"` (a string) to a `BOOLEAN` variable.

### Related

- [BOOLEAN](#boolean)

---

## DATE literals

**Status:** SUPPORTED

### Exact Cambridge syntax

Normally `dd/mm/yyyy`, e.g. `02/01/2005`.

### Explanation

Calendar date written with slashes. PseudoPilot lexes this as a date, not as division.

### Example

```text
Pupil1.DateOfBirth ← 02/01/2005
```

### Important Cambridge rules

- State format explicitly when the paper’s convention might be unclear.

### Common exam mistake

US-style month/day confusion, or writing ISO `2005-01-02` as if it were Cambridge’s normal exam form.

### Related

- [DATE](#date)

---

## Identifiers

**Status:** SUPPORTED

### Exact Cambridge syntax

- Letters `A–Z` / `a–z`, digits `0–9`, underscore `_`
- Must **start with a letter**
- Mixed case recommended; case-insensitive uniqueness

### Explanation

Names for variables, constants, procedures, and functions. Prefer descriptive names (`TotalToPay`) over cryptic ones, except conventional `i` / `j` / `X` / `Y`.

### Example

```text
DECLARE TotalToPay : REAL
DECLARE i : INTEGER
```

### Important Cambridge rules

- Keywords must never be used as identifiers.
- `Countdown` and `CountDown` are the same name (case-insensitive).

### Common exam mistake

Starting a name with a digit (`1stPlace`) or using a keyword (`DECLARE INTEGER : INTEGER`).

### Related

- [Keywords and identifiers case](./presentation.md#keywords-and-identifiers-case)
- Soft-reserved builtins: [`BUILTINS.md`](../language/BUILTINS.md)

---

## DECLARE

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
DECLARE <identifier> : <data type>
```

Multiple names of the same type (PseudoPilot / common style):

```text
DECLARE A, B : INTEGER
```

### Explanation

Introduces a variable and its type before use. Good practice in Cambridge pseudocode.

### Example

```text
DECLARE Counter : INTEGER
DECLARE TotalToPay : REAL
DECLARE GameOver : BOOLEAN
```

### Important Cambridge rules

- Declare before use in clear algorithms.
- Type may be a built-in type, array type, or user-defined type / class.

### Common exam mistake

Assigning before declaring, or omitting the type after `:`.

### Related

- [Arrays](./arrays.md)
- [CONSTANT](#constant)

---

## CONSTANT

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
CONSTANT <identifier> = <literal>
```

### Explanation

Names a fixed literal so the algorithm is clearer and easier to update. The value must be a **literal**, not an expression or another identifier.

### Example

```text
CONSTANT HourlyRate = 6.50
CONSTANT DefaultText = "N/A"
```

### Important Cambridge rules

- Only literals on the right-hand side — never a variable, constant reference, or expression.
- Usually declared near the start (unless scope should be restricted).

### Common exam mistake

`CONSTANT Max = Limit + 1` or `CONSTANT A = B` — rejected; use a literal only.

### Related

- [Assignment](#assignment-)
- Note: `=` here introduces a constant value; `=` in expressions is comparison only.

---

## Assignment ←

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
<identifier> ← <value>
```

PseudoPilot also accepts ASCII `<-` as a keyboard-friendly alias (**extension**).

### Explanation

Stores the value of an expression in a variable (or array element / field). The expression’s type must match the target.

### Example

```text
Counter ← 0
Counter ← Counter + 1
TotalToPay ← NumberOfHours * HourlyRate
```

### Important Cambridge rules

- Assignment operator is `←`, **not** `=`.
- `=` is comparison only (except in `CONSTANT … = literal`).
- Target must be a variable / element / field, not a constant.

### Common exam mistake

Writing `Counter = Counter + 1` as assignment — that is a comparison in Cambridge pseudocode.

### Related

- [Operators](./operators.md)
- [CONFORMANCE](../CONFORMANCE.md) — ASCII `<-` is a PseudoPilot extension
