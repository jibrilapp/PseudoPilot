# Virtual filesystem (interpreter)

**Package:** `@pseudopilot/interpreter` → `src/files/`  
**Contract:** `FileSystemHost` on optional `RuntimeHost.files`

The interpreter **never** touches the real OS filesystem. All Cambridge text-file
I/O goes through a pluggable host; the default is an in-memory
{@link VirtualFileSystem}.

---

## Model

| Concept | Role |
| --- | --- |
| `VirtualFile` | Stored body: `lines: string[]` (no trailing newlines) |
| `VirtualFileHandle` | Open cursor: path, mode, `readIndex` |
| `VirtualFileSystem` | O(1) `Map` for store + open handles |
| `FileSystemHost` | Port for browser / cloud / sandbox backends |

One handle per path. Multiple distinct paths may be open at once.

---

## Modes (Cambridge Core)

| Mode | Behaviour |
| --- | --- |
| `READ` | File must already exist; sequential `READFILE` |
| `WRITE` | Create / truncate, then `WRITEFILE` |
| `APPEND` | Create if missing; `WRITEFILE` appends lines |

`REWRITE` is **not** Cambridge 9618. `RANDOM` / `SEEK` / `GETRECORD` / `PUTRECORD` are Extended — not implemented.

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

Future: swap in IndexedDB, teacher workspace, or sandboxed remote FS **without**
changing interpreter statement dispatch.

---

## Diagnostics (`R_FILE_*`)

| Code | Meaning |
| --- | --- |
| `R_FILE_NOT_FOUND` | OPENFILE FOR READ on missing path |
| `R_FILE_ALREADY_OPEN` | Double open |
| `R_FILE_NOT_OPEN` | READ/WRITE/CLOSE/EOF when closed |
| `R_FILE_MODE` | Wrong op for mode |
| `R_FILE_EOF` | READFILE past end |
| `R_FILE_PATH` | Non-STRING path expression |

---

## Seeding (tests / teachers)

```ts
host.files.seed('data.txt', ['line1', 'line2']);
```
