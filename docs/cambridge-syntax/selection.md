# Selection (§6)

---

## IF THEN ENDIF

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
IF <condition> THEN
  <statement(s)>
ENDIF
```

### Explanation

Runs the body only when the condition is `TRUE`.

### Example

```text
IF Score > 0 THEN
  OUTPUT "Positive"
ENDIF
```

### Important Cambridge rules

- Condition must be `BOOLEAN`.
- Always close with `ENDIF`.

### Common exam mistake

Omitting `THEN` or `ENDIF`, or using `END IF` with a space as if it were required (write `ENDIF`).

### Related

- [IF ELSE ENDIF](#if-else-endif)
- [CASE OF](#case-of--endcase)

---

## IF ELSE ENDIF

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
IF <condition> THEN
  <statement(s)>
ELSE
  <statement(s)>
ENDIF
```

### Explanation

Chooses one of two branches.

### Example

```text
IF Size = Default THEN
  CALL DefaultSquare()
ELSE
  CALL Square(Size)
ENDIF
```

### Important Cambridge rules

- `THEN` / `ELSE` may be indented slightly less in printed papers (continuation of the `IF`).
- Nested `IF` is the Guide’s way to express multi-way conditions.

### Common exam mistake

Forgetting the final `ENDIF` when nesting.

### Related

- [Nested IF](#nested-if)

---

## Nested IF

**Status:** SUPPORTED

### Exact Cambridge syntax

An `IF` inside another `IF`’s `THEN` or `ELSE` branch (each with its own `ENDIF`).

### Explanation

Cambridge examples use nesting rather than a special `ELSE IF` keyword. PseudoPilot also accepts same-line `ELSE IF` as a **compatibility extension**.

### Example

```text
IF ChallengerScore > ChampionScore THEN
  IF ChallengerScore > HighestScore THEN
    OUTPUT ChallengerName, " is champion and highest scorer"
  ELSE
    OUTPUT ChallengerName, " is the new champion"
  ENDIF
ELSE
  OUTPUT ChampionName, " is still the champion"
ENDIF
```

### Important Cambridge rules

- Match each `IF` with its own `ENDIF`.
- Prefer nested `IF` in formal Cambridge answers unless the paper shows otherwise.

### Common exam mistake

Crossing `ELSE` with the wrong `IF`, or relying on `ELSE IF` when the mark scheme shows nesting.

### Related

- [IF ELSE ENDIF](#if-else-endif)
- [CONFORMANCE](../CONFORMANCE.md) — `ELSE IF` extension

---

## CASE OF … ENDCASE

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
CASE OF <identifier>
  <value> : <statement>
  ...
ENDCASE
```

### Explanation

Selects one branch based on the value of a variable. Arms are tested **in order**; the first match runs, then control leaves the `CASE`.

### Example

```text
INPUT Move
CASE OF Move
  'W' : Position ← Position - 10
  'S' : Position ← Position + 10
  'A' : Position ← Position - 1
  'D' : Position ← Position + 1
  OTHERWISE : CALL Beep
ENDCASE
```

### Important Cambridge rules

- First matching arm only; later arms are not tested.
- `OTHERWISE`, if present, must be last.

### Common exam mistake

Expecting fall-through like C `switch`, or putting `OTHERWISE` in the middle.

### Related

- [CASE TO ranges](#case-to-ranges)
- [OTHERWISE](#otherwise)

---

## CASE TO ranges

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
<value1> TO <value2> : <statement>
```

### Explanation

A CASE arm that matches any value from `value1` through `value2` inclusive.

### Example

```text
CASE OF Mark
  0 TO 49 : OUTPUT "Fail"
  50 TO 100 : OUTPUT "Pass"
  OTHERWISE : OUTPUT "Invalid"
ENDCASE
```

### Important Cambridge rules

- Ranges are valid CASE values (Guide §6.2).
- Still first-match wins.

### Common exam mistake

Writing `50..100` or `50-100` instead of `50 TO 100`.

### Related

- [CASE OF … ENDCASE](#case-of--endcase)

---

## OTHERWISE

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
OTHERWISE : <statement>
```

as the **last** arm of a `CASE`.

### Explanation

Runs when no earlier arm matched.

### Example

```text
OTHERWISE : CALL Beep
```

### Important Cambridge rules

- Must be the last case if present.

### Common exam mistake

Using `ELSE` inside `CASE` instead of `OTHERWISE`.

### Related

- [CASE OF … ENDCASE](#case-of--endcase)
