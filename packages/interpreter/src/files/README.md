# Virtual filesystem (interpreter)

**Package:** `@pseudopilot/interpreter` → `src/files/`  
**Contract:** `FileSystemHost` on optional `RuntimeHost.files`

The interpreter **never** touches the real OS filesystem. All Cambridge file
I/O (text §9.1 and random §9.2) goes through a pluggable host; the default is an
in-memory {@link VirtualFileSystem}.

Product overview: [`docs/language/FILE_IO.md`](../../../../docs/language/FILE_IO.md).

---

## Model

| Concept | Role |
| --- | --- |
| `VirtualTextFile` | Text body: `lines: string[]` (no trailing newlines) |
| `VirtualRandomFile` | Sparse `Map<recordNumber, RuntimeValue>` (TYPE records) |
| `VirtualFileHandle` | Open cursor: path, mode, `readIndex`, `recordNumber` |
| `VirtualFileSystem` | O(1) `Map` for store + open handles |
| `FileSystemHost` | Port for browser / cloud / sandbox backends |
| `OpenFileSnapshot` | Debugger / IDE view of open handles |

One handle per path. Multiple distinct paths may be open at once.

---

## Modes (Cambridge)

| Mode | Behaviour |
| --- | --- |
| `READ` | Text file must already exist; sequential `READFILE` |
| `WRITE` | Create / truncate text, then `WRITEFILE` |
| `APPEND` | Create text if missing; `WRITEFILE` appends lines |
| `RANDOM` | Record store; create empty if missing; `SEEK` / `GETRECORD` / `PUTRECORD` |

Record addresses are **0-based** INTEGER (Cambridge “records from the beginning”).

---

## RuntimeHost

```ts
interface RuntimeHost {
  readInput(...);
  writeOutput(...);
  readonly files?: FileSystemHost; // optional; ephemeral VFS if omitted
}
```

`MemoryHost` and the web `IdeRuntimeHost` expose a `VirtualFileSystem` as `.files`.

---

## Diagnostics (`R_FILE_*`)

| Code | Meaning |
| --- | --- |
| `R_FILE_NOT_FOUND` | OPENFILE FOR READ on missing path |
| `R_FILE_ALREADY_OPEN` | Double open |
| `R_FILE_NOT_OPEN` | Op when closed |
| `R_FILE_MODE` | Wrong op for mode |
| `R_FILE_EOF` | READFILE past end |
| `R_FILE_PATH` | Non-STRING path expression |
| `R_FILE_SEEK` | Invalid SEEK address |
| `R_FILE_NO_RECORD` | GETRECORD on empty slot |
| `R_FILE_RECORD_TYPE` | Non-RECORD PUT/GET payload |

---

## Seeding (tests / teachers)

```ts
host.files.seed('data.txt', ['line1', 'line2']);
host.files.seedRecords('data.dat', new Map([[0, recordValue]]));
```

```ts
vfs.snapshotOpenFiles(); // debugger: position + record previews
```
