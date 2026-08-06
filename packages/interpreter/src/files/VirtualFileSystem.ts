/**
 * Virtual filesystem for Cambridge text-file (§9.1) and random-file (§9.2) I/O.
 * Never touches the real OS filesystem — browser/cloud backends can implement
 * the same {@link FileSystemHost} contract later without changing the interpreter.
 */
import {
  cloneValue,
  formatValue,
  type RuntimeValue,
} from '../value.js';

export type FileOpenMode = 'READ' | 'WRITE' | 'APPEND' | 'RANDOM';

/**
 * Snapshot of an open handle for debugger / IDE panels.
 * Text modes expose `readIndex`; RANDOM exposes `recordNumber` + record previews.
 */
export type OpenFileSnapshot = {
  readonly path: string;
  readonly mode: FileOpenMode;
  /** Next line index for READ (text files). */
  readonly readIndex?: number;
  /** Current record address for RANDOM (Cambridge §9.2 file pointer). */
  readonly recordNumber?: number;
  /** Sparse record slots: index → display preview (formatValue). */
  readonly records?: readonly { readonly index: number; readonly preview: string }[];
  /** Text line count when the body is a text file. */
  readonly lineCount?: number;
};

export type FileSystemHost = {
  open(path: string, mode: FileOpenMode): void | Promise<void>;
  close(path: string): void | Promise<void>;
  readLine(path: string): string | Promise<string>;
  writeLine(path: string, line: string): void | Promise<void>;
  eof(path: string): boolean | Promise<boolean>;
  /** Cambridge §9.2 — move the random-file pointer. */
  seek(path: string, recordNumber: number): void | Promise<void>;
  /** Cambridge §9.2 — read the record at the current pointer (cloned). */
  getRecord(path: string): RuntimeValue | Promise<RuntimeValue>;
  /** Cambridge §9.2 — write/replace the record at the current pointer. */
  putRecord(path: string, record: RuntimeValue): void | Promise<void>;
};

/** In-memory text-file body: lines without trailing newlines. */
export type VirtualTextFile = {
  readonly kind: 'text';
  lines: string[];
};

/**
 * In-memory random-file body: sparse map of record address → RuntimeValue.
 * Addresses are INTEGER record numbers — “number of records from the beginning
 * of the file” (Cambridge §9.2), interpreted as **0-based** (first record = 0).
 */
export type VirtualRandomFile = {
  readonly kind: 'random';
  records: Map<number, RuntimeValue>;
};

export type VirtualFile = VirtualTextFile | VirtualRandomFile;

export type VirtualFileHandle = {
  readonly path: string;
  readonly mode: FileOpenMode;
  /** Next line index for READ. */
  readIndex: number;
  /** Current record address for RANDOM (after SEEK). */
  recordNumber: number;
};

export class FileSystemError extends Error {
  constructor(
    readonly code:
      | 'R_FILE_NOT_FOUND'
      | 'R_FILE_ALREADY_OPEN'
      | 'R_FILE_NOT_OPEN'
      | 'R_FILE_MODE'
      | 'R_FILE_EOF'
      | 'R_FILE_CLOSED'
      | 'R_FILE_SEEK'
      | 'R_FILE_NO_RECORD'
      | 'R_FILE_RECORD_TYPE',
    message: string,
  ) {
    super(message);
    this.name = 'FileSystemError';
  }
}

/**
 * Deterministic in-memory VFS. Path lookup is O(1) via Map.
 * Multiple distinct paths may be open; one handle per path.
 */
export class VirtualFileSystem implements FileSystemHost {
  /** path → file body (persists after close). */
  private readonly store = new Map<string, VirtualFile>();
  /** path → open handle. */
  private readonly openHandles = new Map<string, VirtualFileHandle>();

  /** Seed or replace text-file contents (tests / teacher-provided fixtures). */
  seed(path: string, contents: string | readonly string[]): void {
    const lines = normalizeContents(contents);
    this.store.set(path, { kind: 'text', lines: [...lines] });
  }

  /**
   * Seed or replace a random-file body (tests).
   * `records` keys are 0-based Cambridge record addresses.
   */
  seedRecords(path: string, records: ReadonlyMap<number, RuntimeValue> | Iterable<readonly [number, RuntimeValue]>): void {
    const map = new Map<number, RuntimeValue>();
    for (const [i, v] of records instanceof Map ? records : records) {
      map.set(i, cloneValue(v));
    }
    this.store.set(path, { kind: 'random', records: map });
  }

  /** Snapshot of stored text-file text (joined with `\n`). Missing / non-text → undefined. */
  readStored(path: string): string | undefined {
    const file = this.store.get(path);
    if (!file || file.kind !== 'text') return undefined;
    return file.lines.join('\n');
  }

  /** Snapshot of stored random-file records (cloned). Missing / non-random → undefined. */
  readStoredRecords(path: string): Map<number, RuntimeValue> | undefined {
    const file = this.store.get(path);
    if (!file || file.kind !== 'random') return undefined;
    const out = new Map<number, RuntimeValue>();
    for (const [i, v] of file.records) out.set(i, cloneValue(v));
    return out;
  }

  /** All stored paths (sorted). */
  listPaths(): readonly string[] {
    return [...this.store.keys()].sort();
  }

  isOpen(path: string): boolean {
    return this.openHandles.has(path);
  }

  /** Debugger / IDE: open handles with position and (for RANDOM) record previews. */
  snapshotOpenFiles(): readonly OpenFileSnapshot[] {
    const out: OpenFileSnapshot[] = [];
    for (const handle of this.openHandles.values()) {
      const file = this.store.get(handle.path);
      if (handle.mode === 'RANDOM') {
        const records =
          file?.kind === 'random'
            ? [...file.records.entries()]
                .sort((a, b) => a[0] - b[0])
                .map(([index, value]) => ({
                  index,
                  preview: formatValue(value),
                }))
            : [];
        out.push({
          path: handle.path,
          mode: handle.mode,
          recordNumber: handle.recordNumber,
          records,
        });
      } else {
        out.push({
          path: handle.path,
          mode: handle.mode,
          readIndex: handle.readIndex,
          lineCount: file?.kind === 'text' ? file.lines.length : 0,
        });
      }
    }
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }

  open(path: string, mode: FileOpenMode): void {
    if (this.openHandles.has(path)) {
      throw new FileSystemError(
        'R_FILE_ALREADY_OPEN',
        `File '${path}' is already open.`,
      );
    }

    if (mode === 'READ') {
      const file = this.store.get(path);
      if (!file || file.kind !== 'text') {
        throw new FileSystemError(
          'R_FILE_NOT_FOUND',
          `Cannot OPENFILE '${path}' FOR READ: file does not exist.`,
        );
      }
      this.openHandles.set(path, { path, mode, readIndex: 0, recordNumber: 0 });
      return;
    }

    if (mode === 'WRITE') {
      this.store.set(path, { kind: 'text', lines: [] });
      this.openHandles.set(path, { path, mode, readIndex: 0, recordNumber: 0 });
      return;
    }

    if (mode === 'APPEND') {
      const existing = this.store.get(path);
      if (!existing || existing.kind !== 'text') {
        this.store.set(path, { kind: 'text', lines: [] });
      }
      this.openHandles.set(path, { path, mode, readIndex: 0, recordNumber: 0 });
      return;
    }

    // RANDOM — create empty random file if missing; do not truncate existing.
    const existing = this.store.get(path);
    if (!existing) {
      this.store.set(path, { kind: 'random', records: new Map() });
    } else if (existing.kind !== 'random') {
      // Re-open a path that previously held text lines as a fresh random file.
      // Cambridge does not define mixing text and random on the same path;
      // PseudoPilot treats OPENFILE FOR RANDOM as establishing a random body.
      this.store.set(path, { kind: 'random', records: new Map() });
    }
    this.openHandles.set(path, { path, mode, readIndex: 0, recordNumber: 0 });
  }

  close(path: string): void {
    if (!this.openHandles.has(path)) {
      throw new FileSystemError(
        'R_FILE_NOT_OPEN',
        `Cannot CLOSEFILE '${path}': file is not open.`,
      );
    }
    this.openHandles.delete(path);
  }

  readLine(path: string): string {
    const handle = this.requireOpen(path);
    if (handle.mode !== 'READ') {
      throw new FileSystemError(
        'R_FILE_MODE',
        `Cannot READFILE '${path}': file is open for ${handle.mode}.`,
      );
    }
    const file = this.requireText(path, 'READFILE');
    if (handle.readIndex >= file.lines.length) {
      throw new FileSystemError(
        'R_FILE_EOF',
        `Cannot READFILE '${path}': end of file.`,
      );
    }
    const line = file.lines[handle.readIndex]!;
    handle.readIndex += 1;
    return line;
  }

  writeLine(path: string, line: string): void {
    const handle = this.requireOpen(path);
    if (handle.mode === 'READ' || handle.mode === 'RANDOM') {
      throw new FileSystemError(
        'R_FILE_MODE',
        `Cannot WRITEFILE '${path}': file is open for ${handle.mode}.`,
      );
    }
    const file = this.requireText(path, 'WRITEFILE');
    file.lines.push(line);
  }

  eof(path: string): boolean {
    const handle = this.requireOpen(path);
    if (handle.mode !== 'READ') {
      // Cambridge EOF is defined for read streams; treat non-READ as always EOF.
      return true;
    }
    const file = this.requireText(path, 'EOF');
    return handle.readIndex >= file.lines.length;
  }

  seek(path: string, recordNumber: number): void {
    const handle = this.requireOpen(path);
    if (handle.mode !== 'RANDOM') {
      throw new FileSystemError(
        'R_FILE_MODE',
        `Cannot SEEK '${path}': file is open for ${handle.mode} (requires RANDOM).`,
      );
    }
    if (!Number.isInteger(recordNumber) || recordNumber < 0) {
      throw new FileSystemError(
        'R_FILE_SEEK',
        `Cannot SEEK '${path}' to ${recordNumber}: record address must be a non-negative INTEGER.`,
      );
    }
    handle.recordNumber = recordNumber;
  }

  getRecord(path: string): RuntimeValue {
    const handle = this.requireOpen(path);
    if (handle.mode !== 'RANDOM') {
      throw new FileSystemError(
        'R_FILE_MODE',
        `Cannot GETRECORD '${path}': file is open for ${handle.mode} (requires RANDOM).`,
      );
    }
    const file = this.requireRandom(path, 'GETRECORD');
    const record = file.records.get(handle.recordNumber);
    if (record === undefined) {
      throw new FileSystemError(
        'R_FILE_NO_RECORD',
        `Cannot GETRECORD '${path}': no record at address ${handle.recordNumber}.`,
      );
    }
    return cloneValue(record);
  }

  putRecord(path: string, record: RuntimeValue): void {
    const handle = this.requireOpen(path);
    if (handle.mode !== 'RANDOM') {
      throw new FileSystemError(
        'R_FILE_MODE',
        `Cannot PUTRECORD '${path}': file is open for ${handle.mode} (requires RANDOM).`,
      );
    }
    if (record.kind !== 'RECORD') {
      throw new FileSystemError(
        'R_FILE_RECORD_TYPE',
        `Cannot PUTRECORD '${path}': value must be a TYPE record (got ${record.kind}).`,
      );
    }
    const file = this.requireRandom(path, 'PUTRECORD');
    file.records.set(handle.recordNumber, cloneValue(record));
  }

  private requireOpen(path: string): VirtualFileHandle {
    const handle = this.openHandles.get(path);
    if (!handle) {
      throw new FileSystemError(
        'R_FILE_NOT_OPEN',
        `File '${path}' is not open.`,
      );
    }
    return handle;
  }

  private requireText(path: string, via: string): VirtualTextFile {
    const file = this.store.get(path);
    if (!file || file.kind !== 'text') {
      throw new FileSystemError(
        'R_FILE_NOT_FOUND',
        `Cannot ${via} '${path}': text file is missing.`,
      );
    }
    return file;
  }

  private requireRandom(path: string, via: string): VirtualRandomFile {
    const file = this.store.get(path);
    if (!file || file.kind !== 'random') {
      throw new FileSystemError(
        'R_FILE_NOT_FOUND',
        `Cannot ${via} '${path}': random file is missing.`,
      );
    }
    return file;
  }
}

function normalizeContents(contents: string | readonly string[]): string[] {
  if (typeof contents === 'string') {
    if (contents.length === 0) return [];
    // Preserve a trailing empty line only if the string ends with \n\n …;
    // split keeps a final empty segment when text ends with \n.
    const parts = contents.split('\n');
    if (parts.length > 0 && parts[parts.length - 1] === '') {
      parts.pop();
    }
    return parts;
  }
  return [...contents];
}
