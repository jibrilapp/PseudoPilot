# Arrays (§3)

Syllabus requires **one-dimensional** and **two-dimensional** arrays.

---

## 1D ARRAY declaration

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
DECLARE <identifier> : ARRAY[<lower>:<upper>] OF <data type>
```

### Explanation

A fixed-length sequence of elements of the same type, indexed by consecutive integers. State the lower bound explicitly (often `1`).

### Example

```text
DECLARE StudentNames : ARRAY[1:30] OF STRING
```

### Important Cambridge rules

- Bounds are inclusive.
- Lower bound is often 1 in exams; do not assume 0.
- All elements share one data type.

### Common exam mistake

Omitting `OF <type>`, or using `TO` inside the declaration brackets instead of `:`.

### Related

- [2D ARRAY declaration](#2d-array-declaration)
- [Array element access](#array-element-access)

---

## 2D ARRAY declaration

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
DECLARE <identifier> : ARRAY[<l1>:<u1>, <l2>:<u2>] OF <data type>
```

### Explanation

A grid of elements with two index positions (row and column).

### Example

```text
DECLARE NoughtsAndCrosses : ARRAY[1:3,1:3] OF CHAR
```

### Important Cambridge rules

- Syllabus requires 1D and 2D; both are Core in PseudoPilot.
- PseudoPilot also allows 3+ dimensions as an **extension** (not required by the syllabus table).

### Common exam mistake

Indexing with the wrong number of subscripts (`A[i]` on a 2D array).

### Related

- [Array element access](#array-element-access)
- [CONFORMANCE §4.3](../CONFORMANCE.md)

---

## Array element access

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
<array>[<index>]
<array>[<index1>, <index2>]
```

Indices may be literals or integer expressions.

### Explanation

Read or write one element. Indices must lie within the declared bounds at runtime.

### Example

```text
StudentNames[1] ← "Ali"
NoughtsAndCrosses[2,3] ← 'X'
StudentNames[n+1] ← StudentNames[n]
```

### Important Cambridge rules

- Index expressions must evaluate to a valid integer index.
- Out-of-bounds access is an error (PseudoPilot: `R_ARRAY_BOUNDS`).

### Common exam mistake

Using 0-based thinking when the array was declared `[1:n]`.

### Related

- [FOR loops](./iteration.md#for--to--next)
- [Whole-array assignment](#whole-array-assignment)

---

## Whole-array assignment

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
<arrayVariable> ← <arrayVariable>
```

Allowed when both arrays have the **same size and data type**.

### Explanation

Copies the entire array in one assignment (same shape and element type).

### Example

```text
DECLARE NoughtsAndCrosses : ARRAY[1:3,1:3] OF CHAR
DECLARE SavedGame : ARRAY[1:3,1:3] OF CHAR
SavedGame ← NoughtsAndCrosses
```

### Important Cambridge rules

- Same size and type required.
- PseudoPilot checks bounds when known and checks shape at runtime.

### Common exam mistake

Assigning arrays of different lengths or element types.

### Related

- [1D ARRAY declaration](#1d-array-declaration)
- [TYPE_SYSTEM](../language/TYPE_SYSTEM.md)

---

## Array group / slice assignment (forbidden)

**Status:** SUPPORTED (construct correctly **rejected**)

### Exact Cambridge syntax

**Do not use:**

```text
StudentNames[1 TO 30] ← ""
```

### Explanation

Cambridge forbids referring to a group of elements with `TO` in an assignment. Initialise elements with a loop instead.

### Example

```text
FOR Index ← 1 TO 30
  StudentNames[Index] ← ""
NEXT Index
```

### Important Cambridge rules

- No `A[1 TO n] ← …` form.
- Use `FOR` / `WHILE` / `REPEAT` to process ranges.

### Common exam mistake

Writing `StudentNames[1 TO 30] ← ""` in an exam answer.

### Related

- [FOR … TO … NEXT](./iteration.md#for--to--next)
- Official: Guide §3.2
