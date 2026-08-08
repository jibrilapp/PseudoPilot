# Iteration (§7)

---

## FOR … TO … NEXT

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
FOR <identifier> ← <value1> TO <value2>
  <statement(s)>
NEXT <identifier>
```

Bare `NEXT` (no identifier) is also Cambridge-legal; repeating the identifier after `NEXT` is good practice, especially when nested.

### Explanation

Count-controlled loop. The control variable (INTEGER) takes each integer from `value1` to `value2` **inclusive**. If `value1 = value2`, the body runs once. If `value1 > value2` (with default step +1), the body does not run.

### Example

```text
Total ← 0
FOR Row ← 1 TO MaxRow
  RowTotal ← 0
  FOR Column ← 1 TO 10
    RowTotal ← RowTotal + Amount[Row, Column]
  NEXT Column
  OUTPUT "Total for Row ", Row, " is ", RowTotal
  Total ← Total + RowTotal
NEXT Row
```

### Important Cambridge rules

- Control variable must be `INTEGER`.
- Inclusive range.
- When an identifier appears after `NEXT`, it must match the `FOR` binder (PseudoPilot: `E_FOR_NEXT_MISMATCH`).

### Common exam mistake

Using `ENDFOR`, or mismatching `NEXT Inner` with an outer `FOR`.

### Related

- [FOR … STEP](#for--step)
- [Arrays](./arrays.md)

---

## FOR … STEP

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
FOR <identifier> ← <value1> TO <value2> STEP <increment>
  <statement(s)>
NEXT <identifier>
```

### Explanation

Same as `FOR`…`TO`, but the control variable changes by `increment` each time (may be negative). The loop stops when the next value would go past `value2`.

### Example

```text
FOR Position ← 20 TO 10 STEP -1
  SEEK "StudentFile.Dat", Position
  GETRECORD "StudentFile.Dat", Pupil
  SEEK "StudentFile.Dat", Position + 1
  PUTRECORD "StudentFile.Dat", Pupil
NEXT Position
```

### Important Cambridge rules

- Increment must evaluate to an integer.
- Negative steps are allowed.

### Common exam mistake

Forgetting `STEP -1` when counting downwards, leaving an empty loop.

### Related

- [FOR … TO … NEXT](#for--to--next)
- [Random files](./files.md)

---

## REPEAT … UNTIL

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
REPEAT
  <statement(s)>
UNTIL <condition>
```

### Explanation

Post-condition loop: body runs **at least once**. After each pass, if the condition is `TRUE`, the loop ends; otherwise it repeats.

### Example

```text
REPEAT
  OUTPUT "Please enter the password"
  INPUT Password
UNTIL Password = "Secret"
```

### Important Cambridge rules

- Condition is `BOOLEAN`.
- Test happens **after** the body.

### Common exam mistake

Using `WHILE` when the body must run once even if the condition is initially false — use `REPEAT`.

### Related

- [WHILE … ENDWHILE](#while--endwhile)

---

## WHILE … ENDWHILE

**Status:** SUPPORTED

### Exact Cambridge syntax

Guide form (no `DO`):

```text
WHILE <condition>
  <statement(s)>
ENDWHILE
```

PseudoPilot also accepts optional classroom `DO` after the condition (**extension**); printers may emit `DO`.

### Explanation

Pre-condition loop: the condition is tested **before** each iteration. If initially `FALSE`, the body never runs.

### Example

```text
WHILE Number > 9
  Number ← Number - 9
ENDWHILE
```

### Important Cambridge rules

- Condition is `BOOLEAN`.
- Official Guide examples omit `DO`.

### Common exam mistake

Writing `WEND` or forgetting `ENDWHILE`; or assuming `DO` is required in the Guide.

### Related

- [REPEAT … UNTIL](#repeat--until)
- [CONFORMANCE §4.7](../CONFORMANCE.md)
