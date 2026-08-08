# File handling (§9)

PseudoPilot uses an in-memory VFS (never OS disk). Semantics: [`FILE_IO.md`](../language/FILE_IO.md).

---

## OPENFILE (text modes)

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
OPENFILE <file> FOR READ
OPENFILE <file> FOR WRITE
OPENFILE <file> FOR APPEND
```

`<file>` is a string literal or `STRING` variable.

### Explanation

Opens a text file before read/write operations. One mode at a time.

| Mode | Meaning |
| --- | --- |
| `READ` | Read existing lines |
| `WRITE` | Create/truncate, then write |
| `APPEND` | Write after existing data |

### Example

```text
OPENFILE "FileA.txt" FOR READ
OPENFILE "FileB.txt" FOR WRITE
```

### Important Cambridge rules

- Open before any file operation.
- A file should be open in only one mode at a time.

### Common exam mistake

Writing to a file opened for `READ`, or forgetting `OPENFILE` entirely.

### Related

- [READFILE](#readfile)
- [CLOSEFILE](#closefile)

---

## READFILE

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
READFILE <file>, <variable>
```

### Explanation

After `OPENFILE … FOR READ`, reads the next line into a `STRING` variable.

### Example

```text
DECLARE LineOfText : STRING
READFILE "FileA.txt", LineOfText
```

### Important Cambridge rules

- Destination should be `STRING`.
- Use with `EOF` to know when reading is finished.

### Common exam mistake

Using `READFILE` in `WRITE` mode.

### Related

- [EOF](../library-routines/eof.md)
- [WHILE … ENDWHILE](./iteration.md#while--endwhile)

---

## WRITEFILE

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
WRITEFILE <file>, <expression>
```

### Explanation

Writes a line to a file opened for `WRITE` or `APPEND`.

### Example

```text
IF LineOfText = "" THEN
  WRITEFILE "FileB.txt", " ----------------------------"
ELSE
  WRITEFILE "FileB.txt", LineOfText
ENDIF
```

### Important Cambridge rules

- Same `WRITEFILE` statement for `WRITE` and `APPEND` modes.
- `WRITE` truncates/creates; `APPEND` adds after existing data.

### Common exam mistake

Inventing `APPENDFILE` as a separate statement.

### Related

- [OPENFILE (text modes)](#openfile-text-modes)

---

## CLOSEFILE

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
CLOSEFILE <file>
```

### Explanation

Closes a file when it is no longer needed.

### Example

```text
CLOSEFILE "FileA.txt"
CLOSEFILE "FileB.txt"
```

### Important Cambridge rules

- Close files you opened when finished.

### Common exam mistake

Leaving files open across unrelated parts of an algorithm in longer solutions.

### Related

- [OPENFILE (text modes)](#openfile-text-modes)

---

## Text file copy pattern

**Status:** SUPPORTED

### Exact Cambridge syntax

Combine `OPENFILE`, `WHILE NOT EOF(…)`, `READFILE`, `WRITEFILE`, `CLOSEFILE`.

### Explanation

Typical exam pattern: process every line of an input file into an output file.

### Example

```text
DECLARE LineOfText : STRING
OPENFILE "FileA.txt" FOR READ
OPENFILE "FileB.txt" FOR WRITE
WHILE NOT EOF("FileA.txt")
  READFILE "FileA.txt", LineOfText
  IF LineOfText = "" THEN
    WRITEFILE "FileB.txt", " ----------------------------"
  ELSE
    WRITEFILE "FileB.txt", LineOfText
  ENDIF
ENDWHILE
CLOSEFILE "FileA.txt"
CLOSEFILE "FileB.txt"
```

### Important Cambridge rules

- `EOF` is true when there are no more lines (including empty file in `READ` mode).

### Common exam mistake

Testing `EOF` after a failed read pattern that skips the last line — follow the Guide’s `WHILE NOT EOF` + `READFILE` structure.

### Related

- [EOF](../library-routines/eof.md)

---

## OPENFILE FOR RANDOM

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
OPENFILE <file> FOR RANDOM
```

### Explanation

Opens a random-access file of fixed-length records with a movable file pointer.

### Example

```text
OPENFILE "StudentFile.Dat" FOR RANDOM
```

### Important Cambridge rules

- Use with `SEEK`, `GETRECORD`, `PUTRECORD`.
- PseudoPilot: create empty store if missing; do not truncate existing random body on open.

### Common exam mistake

Using `READFILE` on a `RANDOM` file.

### Related

- [SEEK](#seek)
- [FILE_IO.md](../language/FILE_IO.md)

---

## SEEK

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
SEEK <file>, <address>
```

### Explanation

Moves the file pointer to a record address (INTEGER). Cambridge: usually “number of records from the beginning.” PseudoPilot uses **0-based** addresses — document this when teaching examples that start at 10, 20, etc.

### Example

```text
SEEK "StudentFile.Dat", Position
```

### Important Cambridge rules

- Address is an INTEGER expression.
- Explain how addresses are computed in exam answers when relevant.

### Common exam mistake

Assuming 1-based vs 0-based without stating the convention used.

### Related

- [GETRECORD](#getrecord)
- [CONFORMANCE / FILE_IO address note](../language/FILE_IO.md)

---

## GETRECORD

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
GETRECORD <file>, <variable>
```

### Explanation

Reads the record at the current file pointer into a variable of the appropriate user-defined record type.

### Example

```text
GETRECORD "StudentFile.Dat", Pupil
```

### Important Cambridge rules

- Destination is normally a `TYPE` record (not a `CLASS` object).
- File must be open for `RANDOM`.

### Common exam mistake

Using a `STRING` destination as if it were text-file I/O.

### Related

- [PUTRECORD](#putrecord)
- [Record TYPE](./user-types.md#record-type--endtype)

---

## PUTRECORD

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
PUTRECORD <file>, <variable>
```

### Explanation

Writes the record value at the file pointer, replacing any previous data there.

### Example

```text
PUTRECORD "StudentFile.Dat", NewPupil
```

### Important Cambridge rules

- Overwrites the record at the pointer.
- PseudoPilot allows sparse growth beyond existing addresses (see `FILE_IO.md`).

### Common exam mistake

Forgetting `SEEK` before `PUTRECORD`, writing to the wrong address.

### Related

- [SEEK](#seek)
- [OPENFILE FOR RANDOM](#openfile-for-random)
