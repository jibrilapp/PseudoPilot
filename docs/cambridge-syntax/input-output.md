# Input and output (§5.1)

---

## INPUT

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
INPUT <identifier>
```

### Explanation

Reads a value from the user (or host input) into a variable, array element, or field.

### Example

```text
DECLARE Answer : STRING
INPUT Answer
```

### Important Cambridge rules

- Target must be assignable (variable / element / field).
- Cambridge does not type-check the incoming text against the variable in the Guide’s presentation — PseudoPilot still requires an assignable target.

### Common exam mistake

Writing `INPUT "Enter name"` as if a prompt were part of the `INPUT` syntax — prompts belong in a separate `OUTPUT`.

### Related

- [OUTPUT](#output)
- [INTERPRETER](../language/INTERPRETER.md)

---

## OUTPUT

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
OUTPUT <value(s)>
```

Several values may be listed, separated by commas.

### Explanation

Writes one or more values. PseudoPilot joins multiple values with spaces (teaching-friendly rendering of multi-value `OUTPUT`).

### Example

```text
OUTPUT Score
OUTPUT "You have ", Lives, " lives left"
```

### Important Cambridge rules

- Values may be literals or expressions.
- Multiple values are allowed in one `OUTPUT`.

### Common exam mistake

Using `PRINT` or language-specific print functions instead of `OUTPUT`.

### Related

- [INPUT](#input)
- [STRING literals](./types-literals.md#string-literals)
