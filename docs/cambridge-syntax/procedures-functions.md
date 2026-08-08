# Procedures and functions (§8)

---

## PROCEDURE … ENDPROCEDURE

**Status:** SUPPORTED

### Exact Cambridge syntax

No parameters:

```text
PROCEDURE <identifier>()
  <statement(s)>
ENDPROCEDURE
```

With parameters:

```text
PROCEDURE <identifier>(<param> : <type>, ...)
  <statement(s)>
ENDPROCEDURE
```

Parameters may be grouped: `A, B : INTEGER`.

### Explanation

A named subroutine that performs actions and does not return a value to an expression. Call it with `CALL`.

### Example

```text
PROCEDURE DefaultSquare()
  CALL Square(100)
ENDPROCEDURE

PROCEDURE Square(Size : INTEGER)
  FOR Side ← 1 TO 4
    CALL MoveForward(Size)
    CALL Turn(90)
  NEXT Side
ENDPROCEDURE
```

### Important Cambridge rules

- Nested procedures/functions are not allowed (PseudoPilot: `E_NESTED_ROUTINE`).
- Default parameter passing is **by value** unless `BYREF` / `BYVAL` is stated.

### Common exam mistake

Using `RETURN` inside a procedure, or calling a procedure as if it were an expression without `CALL`.

### Related

- [CALL](#call)
- [BYREF](#byref)

---

## CALL

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
CALL <identifier>()
CALL <identifier>(<value1>, <value2>, ...)
```

### Explanation

Invokes a procedure. Argument count, order, and types must match the definition. Empty `()` may be omitted in some classroom styles; PseudoPilot accepts empty `()` / omitted forms consistently with the dialect.

### Example

```text
CALL DefaultSquare()
CALL Square(Size)
```

### Important Cambridge rules

- `CALL` is for **procedures** only.
- Functions are called **inside expressions**, without `CALL`.

### Common exam mistake

`CALL Max(a, b)` when `Max` is a function — use `OUTPUT Max(a, b)` instead.

### Related

- [FUNCTION](#function--returns--endfunction)
- [PROCEDURE](#procedure--endprocedure)

---

## FUNCTION … RETURNS … ENDFUNCTION

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
FUNCTION <identifier>() RETURNS <type>
  <statement(s)>
ENDFUNCTION

FUNCTION <identifier>(<param> : <type>, ...) RETURNS <type>
  <statement(s)>
ENDFUNCTION
```

### Explanation

Like a procedure, but returns one value used in an expression. The return type is part of the header.

### Example

```text
FUNCTION Max(Number1 : INTEGER, Number2 : INTEGER) RETURNS INTEGER
  IF Number1 > Number2 THEN
    RETURN Number1
  ELSE
    RETURN Number2
  ENDIF
ENDFUNCTION

OUTPUT "Penalty Fine = ", Max(10, Distance * 2)
```

### Important Cambridge rules

- Do **not** use `CALL` for functions.
- Use `RETURN <expression>` to produce the value.
- `BYREF` must not be used on function parameters.

### Common exam mistake

Forgetting `RETURNS <type>` in the header, or omitting `RETURN` on some paths.

### Related

- [RETURN](#return)
- [BYREF](#byref)

---

## RETURN

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
RETURN <expression>
```

### Explanation

Ends the function immediately and supplies the value that replaces the function call in the expression. Normally the last statement, but if it appears earlier, later lines are skipped.

### Example

```text
RETURN Number1
```

### Important Cambridge rules

- Valid in **functions** only (not procedures).
- Execution of `RETURN` is immediate.

### Common exam mistake

`RETURN` with no value, or using `RETURN` in a `PROCEDURE`.

### Related

- [FUNCTION](#function--returns--endfunction)
- [SEMANTICS](../language/SEMANTICS.md) — all-paths return analysis is partial

---

## BYVAL

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
PROCEDURE Example(BYVAL X : INTEGER)
```

If the method is unspecified, **by value is assumed**.

### Explanation

The procedure receives a copy of the argument. Changes to the parameter do not update the caller’s variable.

### Example

```text
PROCEDURE Square(BYVAL Size : INTEGER)
  Size ← Size * Size
ENDPROCEDURE
```

### Important Cambridge rules

- Default when `BYVAL` / `BYREF` omitted: by value.
- `BYVAL` / `BYREF` may apply to a following group of parameters without repeating the keyword (Guide SWAP-style sticky mode).

### Common exam mistake

Expecting a by-value parameter to modify the caller’s variable.

### Related

- [BYREF](#byref)
- [CONFORMANCE §4.8](../CONFORMANCE.md)

---

## BYREF

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
PROCEDURE SWAP(BYREF X : INTEGER, Y : INTEGER)
  Temp ← X
  X ← Y
  Y ← Temp
ENDPROCEDURE
```

Here `Y` is also by reference because `BYREF` applies to the following parameters until changed.

### Explanation

Pass by reference: the procedure works on the caller’s variable. Used for `SWAP`-style updates.

### Example

```text
DECLARE A, B : INTEGER
A ← 3
B ← 7
CALL SWAP(A, B)
```

### Important Cambridge rules

- **Do not** pass parameters by reference to a **function**.
- Sticky `BYREF` / `BYVAL` across grouped parameters follows the Guide.

### Common exam mistake

Putting `BYREF` on a `FUNCTION` parameter (PseudoPilot: `C_BYREF_ON_FUNCTION`).

### Related

- [BYVAL](#byval)
- [PROCEDURE](#procedure--endprocedure)

---

## Parameter groups

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
FUNCTION Max(Number1 : INTEGER, Number2 : INTEGER) RETURNS INTEGER
PROCEDURE Demo(A, B : INTEGER, C : STRING)
```

### Explanation

Several parameters can share one type annotation (`A, B : INTEGER`). PseudoPilot expands groups in the AST.

### Example

```text
PROCEDURE Init(A, B : INTEGER)
  A ← 0
  B ← 0
ENDPROCEDURE
```

### Important Cambridge rules

- Order and types of arguments at the call site must match the definition.

### Common exam mistake

Swapping argument order when types differ.

### Related

- [CALL](#call)
- [FUNCTION](#function--returns--endfunction)
