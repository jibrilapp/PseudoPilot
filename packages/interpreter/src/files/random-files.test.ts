import { describe, expect, it } from 'vitest';
import { MemoryHost, runPseudocode, VirtualFileSystem } from '../index.js';

async function run(
  source: string,
  host = new MemoryHost(),
  options: { semanticCheck?: boolean } = {},
) {
  const result = await runPseudocode(source, {
    host,
    semanticCheck: options.semanticCheck ?? true,
  });
  return { result, host };
}

const STUDENT_TYPE = `
TYPE Student
  DECLARE LastName : STRING
  DECLARE FirstName : STRING
  DECLARE DateOfBirth : DATE
  DECLARE YearGroup : INTEGER
  DECLARE FormGroup : CHAR
ENDTYPE
`;

describe('random file I/O (Cambridge §9.2)', () => {
  it('writes and reads the same record', async () => {
    const { result, host } = await run(`
${STUDENT_TYPE}
DECLARE Pupil : Student
DECLARE Loaded : Student
Pupil.LastName ← "Johnson"
Pupil.FirstName ← "Leroy"
Pupil.DateOfBirth ← 02/01/2005
Pupil.YearGroup ← 6
Pupil.FormGroup ← 'A'
OPENFILE "StudentFile.Dat" FOR RANDOM
SEEK "StudentFile.Dat", 0
PUTRECORD "StudentFile.Dat", Pupil
SEEK "StudentFile.Dat", 0
GETRECORD "StudentFile.Dat", Loaded
CLOSEFILE "StudentFile.Dat"
OUTPUT Loaded.LastName
OUTPUT Loaded.FirstName
OUTPUT Loaded.YearGroup
OUTPUT Loaded.FormGroup
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['Johnson', 'Leroy', '6', 'A']);
  });

  it('overwrites an existing record', async () => {
    const { result, host } = await run(`
TYPE Item
  DECLARE Code : INTEGER
ENDTYPE
DECLARE A : Item
DECLARE B : Item
DECLARE Out : Item
A.Code ← 1
B.Code ← 99
OPENFILE "items.dat" FOR RANDOM
SEEK "items.dat", 3
PUTRECORD "items.dat", A
SEEK "items.dat", 3
PUTRECORD "items.dat", B
SEEK "items.dat", 3
GETRECORD "items.dat", Out
CLOSEFILE "items.dat"
OUTPUT Out.Code
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['99']);
  });

  it('supports sparse record access', async () => {
    const { result, host } = await run(`
TYPE Cell
  DECLARE N : INTEGER
ENDTYPE
DECLARE C : Cell
DECLARE R : Cell
OPENFILE "sparse.dat" FOR RANDOM
C.N ← 10
SEEK "sparse.dat", 10
PUTRECORD "sparse.dat", C
C.N ← 100
SEEK "sparse.dat", 100
PUTRECORD "sparse.dat", C
SEEK "sparse.dat", 10
GETRECORD "sparse.dat", R
OUTPUT R.N
SEEK "sparse.dat", 100
GETRECORD "sparse.dat", R
OUTPUT R.N
CLOSEFILE "sparse.dat"
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['10', '100']);
  });

  it('supports nested TYPE records and DATE fields', async () => {
    const { result, host } = await run(`
TYPE Address
  DECLARE City : STRING
ENDTYPE
TYPE Person
  DECLARE Name : STRING
  DECLARE Home : Address
  DECLARE Born : DATE
ENDTYPE
DECLARE P : Person
DECLARE Q : Person
P.Name ← "Ada"
P.Home.City ← "London"
P.Born ← 10/12/1815
OPENFILE "people.dat" FOR RANDOM
SEEK "people.dat", 1
PUTRECORD "people.dat", P
SEEK "people.dat", 1
GETRECORD "people.dat", Q
CLOSEFILE "people.dat"
OUTPUT Q.Name
OUTPUT Q.Home.City
OUTPUT Q.Born
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['Ada', 'London', '10/12/1815']);
  });

  it('supports GETRECORD / PUTRECORD with arrays of records', async () => {
    const { result, host } = await run(`
TYPE Point
  DECLARE X : INTEGER
  DECLARE Y : INTEGER
ENDTYPE
DECLARE Points : ARRAY[1:3] OF Point
DECLARE Tmp : Point
Points[1].X ← 1
Points[1].Y ← 2
OPENFILE "pts.dat" FOR RANDOM
SEEK "pts.dat", 0
PUTRECORD "pts.dat", Points[1]
SEEK "pts.dat", 0
GETRECORD "pts.dat", Points[2]
CLOSEFILE "pts.dat"
OUTPUT Points[2].X
OUTPUT Points[2].Y
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['1', '2']);
  });

  it('rejects negative SEEK addresses', async () => {
    const { result } = await run(`
TYPE T
  DECLARE N : INTEGER
ENDTYPE
OPENFILE "f.dat" FOR RANDOM
SEEK "f.dat", -1
CLOSEFILE "f.dat"
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'R_FILE_SEEK')).toBe(true);
  });

  it('rejects GETRECORD on an empty slot', async () => {
    const { result } = await run(`
TYPE T
  DECLARE N : INTEGER
ENDTYPE
DECLARE R : T
OPENFILE "f.dat" FOR RANDOM
SEEK "f.dat", 5
GETRECORD "f.dat", R
CLOSEFILE "f.dat"
`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'R_FILE_NO_RECORD')).toBe(
      true,
    );
  });

  it('rejects SEEK / GETRECORD / PUTRECORD when not open for RANDOM', async () => {
    const host = new MemoryHost();
    host.files.seed('t.txt', ['x']);
    const { result } = await run(
      `
OPENFILE "t.txt" FOR READ
SEEK "t.txt", 0
CLOSEFILE "t.txt"
`,
      host,
      { semanticCheck: false },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'R_FILE_MODE')).toBe(true);
  });

  it('rejects READFILE on a RANDOM open', async () => {
    const { result } = await run(
      `
DECLARE L : STRING
OPENFILE "f.dat" FOR RANDOM
READFILE "f.dat", L
CLOSEFILE "f.dat"
`,
      new MemoryHost(),
      { semanticCheck: false },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'R_FILE_MODE')).toBe(true);
  });

  it('Cambridge-style insert at position (shift records)', async () => {
    const { result, host } = await run(`
TYPE Student
  DECLARE LastName : STRING
ENDTYPE
DECLARE Pupil : Student
DECLARE NewPupil : Student
DECLARE Position : INTEGER
DECLARE Check : Student
OPENFILE "StudentFile.Dat" FOR RANDOM
Pupil.LastName ← "S0"
SEEK "StudentFile.Dat", 0
PUTRECORD "StudentFile.Dat", Pupil
Pupil.LastName ← "S1"
SEEK "StudentFile.Dat", 1
PUTRECORD "StudentFile.Dat", Pupil
Pupil.LastName ← "S2"
SEEK "StudentFile.Dat", 2
PUTRECORD "StudentFile.Dat", Pupil
NewPupil.LastName ← "Johnson"
FOR Position ← 2 TO 1 STEP -1
  SEEK "StudentFile.Dat", Position
  GETRECORD "StudentFile.Dat", Pupil
  SEEK "StudentFile.Dat", Position + 1
  PUTRECORD "StudentFile.Dat", Pupil
NEXT Position
SEEK "StudentFile.Dat", 1
PUTRECORD "StudentFile.Dat", NewPupil
FOR Position ← 0 TO 3
  SEEK "StudentFile.Dat", Position
  GETRECORD "StudentFile.Dat", Check
  OUTPUT Check.LastName
NEXT Position
CLOSEFILE "StudentFile.Dat"
`);
    expect(result.ok).toBe(true);
    expect(host.outputs).toEqual(['S0', 'Johnson', 'S1', 'S2']);
  });

  it('exposes recordNumber and contents to debugger hooks', async () => {
    let snap:
      | {
          readonly path: string;
          readonly mode: string;
          readonly recordNumber?: number;
          readonly records?: readonly { index: number; preview: string }[];
        }[]
      | undefined;
    const host = new MemoryHost();
    const result = await runPseudocode(
      `
TYPE T
  DECLARE N : INTEGER
ENDTYPE
DECLARE R : T
R.N ← 42
OPENFILE "dbg.dat" FOR RANDOM
SEEK "dbg.dat", 7
PUTRECORD "dbg.dat", R
OUTPUT R.N
CLOSEFILE "dbg.dat"
`,
      {
        host,
        semanticCheck: true,
        debugger: {
          onBeforeStatement: (info) => {
            if (info.openFiles && info.openFiles.length > 0) {
              snap = [...info.openFiles];
            }
            return 'continue';
          },
        },
      },
    );
    expect(result.ok).toBe(true);
    expect(snap).toBeDefined();
    const file = snap!.find((f) => f.path === 'dbg.dat');
    expect(file?.mode).toBe('RANDOM');
    expect(file?.recordNumber).toBe(7);
    expect(file?.records?.some((r) => r.index === 7 && r.preview.includes('42'))).toBe(
      true,
    );
  });

  it('VirtualFileSystem.snapshotOpenFiles reports RANDOM state', () => {
    const vfs = new VirtualFileSystem();
    vfs.open('x.dat', 'RANDOM');
    vfs.seek('x.dat', 2);
    expect(vfs.snapshotOpenFiles()).toEqual([
      {
        path: 'x.dat',
        mode: 'RANDOM',
        recordNumber: 2,
        records: [],
      },
    ]);
    vfs.close('x.dat');
  });

  it('persists random records across close/reopen', async () => {
    const host = new MemoryHost();
    const first = await run(
      `
TYPE T
  DECLARE N : INTEGER
ENDTYPE
DECLARE R : T
R.N ← 5
OPENFILE "keep.dat" FOR RANDOM
SEEK "keep.dat", 0
PUTRECORD "keep.dat", R
CLOSEFILE "keep.dat"
`,
      host,
    );
    expect(first.result.ok).toBe(true);
    const second = await run(
      `
TYPE T
  DECLARE N : INTEGER
ENDTYPE
DECLARE R : T
OPENFILE "keep.dat" FOR RANDOM
SEEK "keep.dat", 0
GETRECORD "keep.dat", R
CLOSEFILE "keep.dat"
OUTPUT R.N
`,
      host,
    );
    expect(second.result.ok).toBe(true);
    expect(host.outputs).toEqual(['5']);
  });
});
