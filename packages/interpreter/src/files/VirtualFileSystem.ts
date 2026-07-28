/**
 * Virtual filesystem for Cambridge text-file I/O.
 * Never touches the real OS filesystem — browser/cloud backends can implement
 * the same {@link FileSystemHost} contract later without changing the interpreter.
 */

export type FileOpenMode = 'READ' | 'WRITE' | 'APPEND';

export type FileSystemHost = {
  open(path: string, mode: FileOpenMode): void | Promise<void>;
  close(path: string): void | Promise<void>;
  readLine(path: string): string | Promise<string>;
  writeLine(path: string, line: string): void | Promise<void>;
  eof(path: string): boolean | Promise<boolean>;
};

/** In-memory file body: lines without trailing newlines. */
export type VirtualFile = {
  lines: string[];
};

export type VirtualFileHandle = {
  readonly path: string;
  readonly mode: FileOpenMode;
  /** Next line index for READ. */
  readIndex: number;
};

export class FileSystemError extends Error {
  constructor(
    readonly code:
      | 'R_FILE_NOT_FOUND'
      | 'R_FILE_ALREADY_OPEN'
      | 'R_FILE_NOT_OPEN'
      | 'R_FILE_MODE'
      | 'R_FILE_EOF'
      | 'R_FILE_CLOSED',
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

  /** Seed or replace file contents (tests / teacher-provided fixtures). */
  seed(path: string, contents: string | readonly string[]): void {
    const lines = normalizeContents(contents);
    this.store.set(path, { lines: [...lines] });
  }

  /** Snapshot of stored file text (joined with `\n`). Missing → undefined. */
  readStored(path: string): string | undefined {
    const file = this.store.get(path);
    if (!file) return undefined;
    return file.lines.join('\n');
  }

  /** All stored paths (sorted). */
  listPaths(): readonly string[] {
    return [...this.store.keys()].sort();
  }

  isOpen(path: string): boolean {
    return this.openHandles.has(path);
  }

  open(path: string, mode: FileOpenMode): void {
    if (this.openHandles.has(path)) {
      throw new FileSystemError(
        'R_FILE_ALREADY_OPEN',
        `File '${path}' is already open.`,
      );
    }

    if (mode === 'READ') {
      if (!this.store.has(path)) {
        throw new FileSystemError(
          'R_FILE_NOT_FOUND',
          `Cannot OPENFILE '${path}' FOR READ: file does not exist.`,
        );
      }
      this.openHandles.set(path, { path, mode, readIndex: 0 });
      return;
    }

    if (mode === 'WRITE') {
      this.store.set(path, { lines: [] });
      this.openHandles.set(path, { path, mode, readIndex: 0 });
      return;
    }

    // APPEND
    if (!this.store.has(path)) {
      this.store.set(path, { lines: [] });
    }
    this.openHandles.set(path, { path, mode, readIndex: 0 });
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
    const file = this.store.get(path)!;
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
    if (handle.mode === 'READ') {
      throw new FileSystemError(
        'R_FILE_MODE',
        `Cannot WRITEFILE '${path}': file is open for READ.`,
      );
    }
    const file = this.store.get(path);
    if (!file) {
      throw new FileSystemError(
        'R_FILE_NOT_FOUND',
        `Cannot WRITEFILE '${path}': file is missing.`,
      );
    }
    file.lines.push(line);
  }

  eof(path: string): boolean {
    const handle = this.requireOpen(path);
    if (handle.mode !== 'READ') {
      // Cambridge EOF is defined for read streams; treat non-READ as always EOF.
      return true;
    }
    const file = this.store.get(path)!;
    return handle.readIndex >= file.lines.length;
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
