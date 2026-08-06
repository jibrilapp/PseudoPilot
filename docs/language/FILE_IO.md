# File I/O (Cambridge 9618 §9)

**Guide:** *Pseudocode Guide for Teachers* (exams 2026) §9.1 Text files, §9.2 Random files.  
**Stack:** lexer → parser → checker (`C_FILE_*`) → interpreter VFS (`R_FILE_*`) → translator ↔ Python.

PseudoPilot never touches the OS disk. All I/O goes through an in-memory
[`VirtualFileSystem`](../../packages/interpreter/src/files/VirtualFileSystem.ts)
(pluggable via `RuntimeHost.files`).

---

## §9.1 Text files

| Statement | Form |
| --- | --- |
| Open | `OPENFILE <file> FOR READ \| WRITE \| APPEND` |
| Read line | `READFILE <file>, <assignTarget>` |
| Write line | `WRITEFILE <file>, <expression>` |
| Close | `CLOSEFILE <file>` |
| EOF | `EOF(<file>)` → `BOOLEAN` |

**Modes**

| Mode | Behaviour |
| --- | --- |
| `READ` | File must already exist; sequential `READFILE` |
| `WRITE` | Create / truncate, then `WRITEFILE` |
| `APPEND` | Create if missing; `WRITEFILE` appends lines |

`<file>` is an expression of type `STRING` (or `CHAR`). Paths are opaque strings.

---

## §9.2 Random files

Random files hold a collection of **fixed-length records** (normally user-defined
`TYPE` values) with a movable file pointer.

| Statement | Form | Role |
| --- | --- | --- |
| Open | `OPENFILE <file> FOR RANDOM` | Open (create empty store if missing; do not truncate existing) |
| Seek | `SEEK <file>, <address>` | Move pointer to record address |
| Get | `GETRECORD <file>, <assignTarget>` | Read record at pointer into a TYPE variable |
| Put | `PUTRECORD <file>, <expression>` | Write/replace record at pointer |

### Address / record number (PseudoPilot resolution)

Cambridge §9.2: the address is an **INTEGER** expression indicating “the location
of a record… usually the number of records from the beginning of the file.”

PseudoPilot interprets addresses as **0-based**: the first record is address `0`
(zero records from the start). Document this in teaching materials when using
exam examples that start at 10, 20, etc. — those examples are compatible with
either convention as long as you are consistent.

### Record types

- `GETRECORD` / `PUTRECORD` require a **TYPE record** value (Cambridge: “usually
  a user-defined type”).
- Nested `TYPE` fields, `DATE` fields, and **array elements of records**
  (`Pupils[i]`) are supported via normal assign targets / expressions.
- **CLASS objects are not records** — rejected by the checker (`C_FILE_RECORD_TYPE`)
  and runtime (`R_FILE_RECORD_TYPE`).

### Interaction with text modes

- `READFILE` / `WRITEFILE` / `EOF` require text modes (`READ` / `WRITE` / `APPEND`).
- `SEEK` / `GETRECORD` / `PUTRECORD` require `RANDOM`.
- Mixing modes on the same open handle → `C_FILE_MODE` / `R_FILE_MODE`.

---

## Checker (`C_FILE_*`)

| Code | Meaning |
| --- | --- |
| `C_FILE_PATH_TYPE` | Path not STRING/CHAR |
| `C_FILE_NOT_OPEN` / `C_FILE_ALREADY_OPEN` | Literal-path open-state (best-effort, control-flow insensitive) |
| `C_FILE_MODE` | Wrong op for open mode |
| `C_FILE_SEEK_TYPE` | SEEK address not INTEGER |
| `C_FILE_RECORD_TYPE` | GETRECORD target / PUTRECORD value not a TYPE record |
| `C_ASSIGN_TYPE` | READFILE into non-STRING target |

Dynamic path variables are type-checked only; open/mode errors surface at runtime.

---

## Runtime (`R_FILE_*`)

| Code | Meaning |
| --- | --- |
| `R_FILE_NOT_FOUND` | OPENFILE FOR READ on missing text path |
| `R_FILE_ALREADY_OPEN` | Double open |
| `R_FILE_NOT_OPEN` | Op on closed file |
| `R_FILE_MODE` | Wrong op for mode |
| `R_FILE_EOF` | READFILE past end |
| `R_FILE_PATH` | Non-STRING path at runtime |
| `R_FILE_SEEK` | Negative / non-INTEGER SEEK address |
| `R_FILE_NO_RECORD` | GETRECORD on an unwritten address |
| `R_FILE_RECORD_TYPE` | PUTRECORD / GETRECORD with non-RECORD value |

### Undefined / documented PseudoPilot behaviour

Cambridge is silent on several edges; PseudoPilot defines:

| Case | Behaviour |
| --- | --- |
| SEEK to an address with no prior PUTRECORD | Allowed; pointer moves |
| GETRECORD at empty address | `R_FILE_NO_RECORD` |
| PUTRECORD beyond prior high-water mark | Allowed; sparse map grows |
| Negative address | `R_FILE_SEEK` |
| OPENFILE FOR RANDOM on a path that previously held text lines | Store is replaced with an empty random body (mixing text/random on one path is undefined in the guide) |
| EOF on RANDOM | Always `TRUE` (EOF is a text-stream concept) |
| Record size / binary layout | Abstract: records stored as cloned runtime values (not byte packing) |

Debugger hooks receive `openFiles` snapshots (mode, `readIndex` or `recordNumber`,
record previews via `formatValue`).

---

## Python translation

| Cambridge | Python (PseudoPilot emit) |
| --- | --- |
| Text OPEN/READ/WRITE/CLOSE | `open` / `readline` / `write` / `close` (+ `_pp_eof`) |
| `OPENFILE … FOR RANDOM` | `_pp_random_open(path)` into handle / store |
| `SEEK` | `_pp_random_seek(handle, n)` |
| `GETRECORD` | `var = _pp_random_get(handle)` (`copy.deepcopy`) |
| `PUTRECORD` | `_pp_random_put(handle, rec)` |
| `CLOSEFILE` (random) | `_pp_random_close(handle)` (no-op on store) |

Reverse lift recovers SEEK/GETRECORD/PUTRECORD from these helpers when possible.
Sequential text-file emission is unchanged when random ops are absent.

---

## Related docs

- [`SPECIFICATION.md`](./SPECIFICATION.md) §5
- [`SEMANTICS.md`](./SEMANTICS.md)
- [`INTERPRETER.md`](./INTERPRETER.md)
- [`TRANSLATION.md`](./TRANSLATION.md)
- [`CONFORMANCE.md`](../CONFORMANCE.md) §4.9
- [`packages/interpreter/src/files/README.md`](../../packages/interpreter/src/files/README.md)
