# EOF (§9.1)

---

## EOF

**Status:** SUPPORTED

### Syntax

```text
EOF(<FileName>) RETURNS BOOLEAN
```

Guide / insert style: `EOF(FileName : STRING) RETURNS BOOLEAN`.

### Parameters

| Name | Type | Role |
| --- | --- | --- |
| File name | `STRING` | File already open for `READ` |

### Return

`TRUE` if there are no more lines to read (or empty file opened for `READ`); otherwise `FALSE`.

### What it does

Tests end-of-file for sequential text reading.

### Example

```text
WHILE NOT EOF("FileA.txt")
  READFILE "FileA.txt", LineOfText
  OUTPUT LineOfText
ENDWHILE
```

### Restrictions

Insert wording: error if the file is not already open in `READ` mode. PseudoPilot enforces mode via file checker/runtime. `EOF` on `RANDOM` files is not a text-stream concept (see `FILE_IO.md`).

### Common mistake

Calling `EOF` before `OPENFILE … FOR READ`.

### Support notes

Dedicated grammar primary; Core builtin. Cross-link: [Text files](../cambridge-syntax/files.md).
