import { describe, expect, it } from 'vitest';
import { MemoryHost, runPseudocode, VirtualFileSystem } from '../index.js';

async function run(
  source: string,
  host = new MemoryHost(),
  options: { semanticCheck?: boolean } = {},
) {
  const result = await runPseudocode(source, {
    host,
    semanticCheck: options.semanticCheck,
  });
  return { result, host };
}

describe('VirtualFileSystem', () => {
  it('supports WRITE then READ with EOF', () => {
    const vfs = new VirtualFileSystem();
    vfs.open('a.txt', 'WRITE');
    vfs.writeLine('a.txt', 'one');
    vfs.writeLine('a.txt', 'two');
    vfs.close('a.txt');

    vfs.open('a.txt', 'READ');
    expect(vfs.eof('a.txt')).toBe(false);
    expect(vfs.readLine('a.txt')).toBe('one');
    expect(vfs.readLine('a.txt')).toBe('two');
    expect(vfs.eof('a.txt')).toBe(true);
    vfs.close('a.txt');
  });

  it('APPEND preserves prior lines', () => {
    const vfs = new VirtualFileSystem();
    vfs.seed('b.txt', ['x']);
    vfs.open('b.txt', 'APPEND');
    vfs.writeLine('b.txt', 'y');
    vfs.close('b.txt');
    expect(vfs.readStored('b.txt')).toBe('x\ny');
  });

  it('WRITE truncates', () => {
    const vfs = new VirtualFileSystem();
    vfs.seed('c.txt', ['old']);
    vfs.open('c.txt', 'WRITE');
    vfs.writeLine('c.txt', 'new');
    vfs.close('c.txt');
    expect(vfs.readStored('c.txt')).toBe('new');
  });
});

describe('interpreter file I/O', () => {
  it('OPENFILE WRITE / WRITEFILE / READFILE / EOF / CLOSEFILE', async () => {
    const host = new MemoryHost();
    const { result } = await run(
      `
OPENFILE "data.txt" FOR WRITE
WRITEFILE "data.txt", "hello"
WRITEFILE "data.txt", "world"
CLOSEFILE "data.txt"
OPENFILE "data.txt" FOR READ
DECLARE Line : STRING
WHILE NOT EOF("data.txt")
  READFILE "data.txt", Line
  OUTPUT Line
ENDWHILE
CLOSEFILE "data.txt"
`,
      host,
    );
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['hello', 'world']);
    expect(host.files.readStored('data.txt')).toBe('hello\nworld');
  });

  it('APPEND adds to existing file', async () => {
    const host = new MemoryHost();
    host.files.seed('log.txt', ['a']);
    const { result } = await run(
      `
OPENFILE "log.txt" FOR APPEND
WRITEFILE "log.txt", "b"
CLOSEFILE "log.txt"
`,
      host,
    );
    expect(result.ok).toBe(true);
    expect(host.files.readStored('log.txt')).toBe('a\nb');
  });

  it('errors on READ of missing file', async () => {
    const { result } = await run(`
OPENFILE "missing.txt" FOR READ
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'R_FILE_NOT_FOUND')).toBe(
      true,
    );
  });

  it('errors on double open', async () => {
    const { result } = await run(
      `
OPENFILE "t.txt" FOR WRITE
OPENFILE "t.txt" FOR WRITE
`,
      new MemoryHost(),
      { semanticCheck: false },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'R_FILE_ALREADY_OPEN')).toBe(
      true,
    );
  });

  it('errors on close when not open', async () => {
    const { result } = await run(
      `
CLOSEFILE "t.txt"
`,
      new MemoryHost(),
      { semanticCheck: false },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'R_FILE_NOT_OPEN')).toBe(
      true,
    );
  });

  it('errors reading a WRITE-mode file', async () => {
    const { result } = await run(
      `
OPENFILE "t.txt" FOR WRITE
DECLARE L : STRING
READFILE "t.txt", L
`,
      new MemoryHost(),
      { semanticCheck: false },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'R_FILE_MODE')).toBe(true);
  });

  it('errors writing a READ-mode file', async () => {
    const host = new MemoryHost();
    host.files.seed('t.txt', ['x']);
    const { result } = await run(
      `
OPENFILE "t.txt" FOR READ
WRITEFILE "t.txt", "y"
`,
      host,
      { semanticCheck: false },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'R_FILE_MODE')).toBe(true);
  });

  it('errors reading past EOF', async () => {
    const host = new MemoryHost();
    host.files.seed('t.txt', []);
    const { result } = await run(
      `
OPENFILE "t.txt" FOR READ
DECLARE L : STRING
READFILE "t.txt", L
`,
      host,
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'R_FILE_EOF')).toBe(true);
  });

  it('supports file ops inside procedures', async () => {
    const host = new MemoryHost();
    const { result } = await run(
      `
PROCEDURE Save
  OPENFILE "p.txt" FOR WRITE
  WRITEFILE "p.txt", "ok"
  CLOSEFILE "p.txt"
ENDPROCEDURE
CALL Save
OPENFILE "p.txt" FOR READ
DECLARE L : STRING
READFILE "p.txt", L
OUTPUT L
CLOSEFILE "p.txt"
`,
      host,
    );
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['ok']);
  });

  it('supports multiple open files', async () => {
    const host = new MemoryHost();
    const { result } = await run(
      `
OPENFILE "a.txt" FOR WRITE
OPENFILE "b.txt" FOR WRITE
WRITEFILE "a.txt", "A"
WRITEFILE "b.txt", "B"
CLOSEFILE "a.txt"
CLOSEFILE "b.txt"
`,
      host,
    );
    expect(result.ok).toBe(true);
    expect(host.files.readStored('a.txt')).toBe('A');
    expect(host.files.readStored('b.txt')).toBe('B');
  });

  it('uses STRING variable as file path', async () => {
    const host = new MemoryHost();
    const { result } = await run(
      `
DECLARE Name : STRING
Name ← "v.txt"
OPENFILE Name FOR WRITE
WRITEFILE Name, "z"
CLOSEFILE Name
`,
      host,
    );
    expect(result.ok).toBe(true);
    expect(host.files.readStored('v.txt')).toBe('z');
  });
});
