# Presentation (§1)

How Cambridge presents pseudocode in exams. PseudoPilot accepts the same lexical rules; layout is for readability, not semantics.

---

## Font style and size

**Status:** SUPPORTED (presentation convention — not enforced by the runtime)

### Exact Cambridge syntax

Not a language construct. Pseudocode appears in a **monospaced** font (e.g. Courier New) at a consistent size.

### Explanation

Exams print algorithms in fixed-width type so columns and indentation stay clear. Write answers the same way in the booklet.

### Example

```text
DECLARE Counter : INTEGER
Counter ← 0
```

### Important Cambridge rules

- Font is presentation only; it does not change meaning.
- Keep statements readable; prefer short lines when possible.

### Common exam mistake

Writing keywords in a proportional font and losing alignment when copying nested `IF` / `FOR` structures.

### Related

- [Indentation](#indentation)
- [Line numbering](#line-numbering)
- Official: [2027–2029 Guide §1.1](https://www.cambridgeinternational.org/Images/721401-2027-2029-pseudocode-guide.pdf)

---

## Indentation

**Status:** SUPPORTED

### Exact Cambridge syntax

Lines inside a statement are indented (often about three spaces). With line numbers, indentation may be omitted in the printed paper.

### Explanation

Indentation shows nesting for humans. Cambridge does **not** treat spaces as significant syntax the way Python does.

### Example

```text
IF Score > 0 THEN
  OUTPUT "Positive"
ENDIF
```

### Important Cambridge rules

- Indentation is for readability only.
- Continuation lines should align for clarity when a statement wraps.

### Common exam mistake

Assuming wrong indentation will fail the program — in Cambridge pseudocode (and PseudoPilot) indentation does not change control flow.

### Related

- [`SPECIFICATION.md` §0.3](../language/SPECIFICATION.md)
- [CONFORMANCE §4.1](../CONFORMANCE.md)

---

## Keywords and identifiers case

**Status:** SUPPORTED

### Exact Cambridge syntax

- Keywords: upper-case (`IF`, `REPEAT`, `PROCEDURE`, …)
- Identifiers: mixed case / camelCase / PascalCase (e.g. `NumberOfPlayers`)
- Meta-variables in the Guide use angled brackets `<…>`

### Explanation

Exams print keywords in capitals so they stand out. Variable names use mixed case. Names are **case-insensitive** — do not use `Count` and `count` as two different variables.

### Example

```text
DECLARE NumberOfPlayers : INTEGER
NumberOfPlayers ← 4
IF NumberOfPlayers > 0 THEN
  OUTPUT NumberOfPlayers
ENDIF
```

### Important Cambridge rules

- Keywords from the Guide must not be used as identifiers.
- Identifiers: letters, digits, underscore; must start with a letter; no accented letters.
- PseudoPilot’s lexer is case-insensitive for keywords; the IDE may upper-case them.

### Common exam mistake

Using a keyword such as `FOR` or `STRING` as a variable name.

### Related

- [Identifiers](./types-literals.md#identifiers)
- [CONFORMANCE §4.1](../CONFORMANCE.md)

---

## Line numbering

**Status:** PARTIALLY SUPPORTED

### Exact Cambridge syntax

When lines are numbered for reference, numbers appear to the **left** of the code, clearly separated from statements. Continuation lines of a wrapped statement are **not** numbered. Numbers may skip to show omitted code.

### Explanation

Line numbers are exam presentation aids for “refer to line 12” questions. They are not part of the algorithm text you type into PseudoPilot.

### Example

```text
01 DECLARE Password : STRING
02 REPEAT
03   INPUT Password
04 UNTIL Password = "Secret"
```

*(In PseudoPilot, omit the `01`/`02` prefixes — enter only the statements.)*

### Important Cambridge rules

- Each statement line is numbered; wrapped continuation lines are not.
- Skipped numbers mean omitted code (stated in the paper).

### Common exam mistake

Copying line numbers into a runnable program, or treating packed same-line `THEN` / `ELSE` layouts as required syntax.

### Related

- [CONFORMANCE §4.1](../CONFORMANCE.md) — same-line packing after `THEN`/`ELSE` is incomplete vs some exam prints
- Official: Guide §1.4

---

## Comments //

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
// <comment text to end of line>
```

Multi-line comments: each line starts with `//`.

### Explanation

`//` starts a comment that runs to the end of that line. Use comments to explain intent; they do not affect execution.

### Example

```text
// this procedure swaps
// values of X and Y
PROCEDURE SWAP(BYREF X : INTEGER, Y : INTEGER)
  Temp ← X // temporarily store X
  X ← Y
  Y ← Temp
ENDPROCEDURE
```

### Important Cambridge rules

- Normally place the comment on its own line before the code, at the same indent.
- Short comments may sit at the end of the line they describe.

### Common exam mistake

Using `#`, `/* */`, or Python-style comments — Cambridge uses `//` only.

### Related

- [BYREF](./procedures-functions.md#byref)
- Official: Guide §1.5
