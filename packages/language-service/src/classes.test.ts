import { describe, expect, it } from 'vitest';
import { createCompilerSession } from './index.js';

const URI = 'file:///classes.pseudo';

const ANIMAL_PROGRAM = `
CLASS Animal
  PRIVATE Name : STRING
  PUBLIC Sound : STRING

  PROCEDURE NEW(GivenName : STRING)
    Name ← GivenName
  ENDPROCEDURE

  FUNCTION Speak() RETURNS STRING
    RETURN Name & " says " & Sound
  ENDFUNCTION
ENDCLASS

CLASS Dog INHERITS Animal
  PROCEDURE NEW(GivenName : STRING)
    SUPER.NEW(GivenName)
    Sound ← "Woof"
  ENDPROCEDURE

  FUNCTION Speak() RETURNS STRING
    RETURN SUPER.Speak() & "!"
  ENDFUNCTION
ENDCLASS

DECLARE A : Animal
A ← NEW Animal("Rex")
OUTPUT A.Speak()

DECLARE D : Dog
D ← NEW Dog("Fido")
OUTPUT D.Sound
`;

describe('language service — CLASS / OOP', () => {
  it('keywords include CLASS/OOP vocabulary', async () => {
    const { CAMBRIDGE_KEYWORDS, isKeyword } = await import('./keywords.js');
    for (const kw of ['CLASS', 'ENDCLASS', 'PUBLIC', 'PRIVATE', 'INHERITS', 'SUPER', 'NEW']) {
      expect(CAMBRIDGE_KEYWORDS).toContain(kw);
      expect(isKeyword(kw.toLowerCase())).toBe(true);
    }
  });

  it('completion after `.` on a class instance suggests own fields and methods', () => {
    const { languageService: ls } = createCompilerSession();
    ls.openDocument(URI, `${ANIMAL_PROGRAM}\nA.\n`, 1);
    const lines = `${ANIMAL_PROGRAM}\nA.\n`.split('\n');
    const lineIdx = lines.length - 2; // the `A.` line
    const items = ls.completion(URI, { line: lineIdx, character: 2 });
    const labels = items.map((i) => i.label);
    expect(labels).toContain('Name');
    expect(labels).toContain('Sound');
    expect(labels).toContain('Speak');
  });

  it('completion after `.` on a subclass instance includes inherited members', () => {
    const { languageService: ls } = createCompilerSession();
    ls.openDocument(URI, `${ANIMAL_PROGRAM}\nD.\n`, 1);
    const lines = `${ANIMAL_PROGRAM}\nD.\n`.split('\n');
    const lineIdx = lines.length - 2;
    const items = ls.completion(URI, { line: lineIdx, character: 2 });
    const labels = items.map((i) => i.label);
    // Inherited from Animal:
    expect(labels).toContain('Name');
    expect(labels).toContain('Sound');
    expect(labels).toContain('Speak'); // Dog overrides Speak — still listed once
    expect(labels.filter((l) => l === 'Speak')).toHaveLength(1);
  });

  it('hover on a CLASS name shows inherits + own fields + own methods', () => {
    const { languageService: ls } = createCompilerSession();
    ls.openDocument(URI, ANIMAL_PROGRAM, 1);
    // "Dog" in `CLASS Dog INHERITS Animal`
    const lines = ANIMAL_PROGRAM.split('\n');
    const dogLine = lines.findIndex((l) => l.startsWith('CLASS Dog'));
    const tip = ls.hover(URI, { line: dogLine, character: 8 });
    expect(tip?.contents ?? '').toMatch(/CLASS/i);
    expect(tip?.contents ?? '').toMatch(/Inherits.*Animal/i);
    expect(tip?.contents ?? '').toMatch(/Speak/);
  });

  it('hover on a method shows its signature and visibility', () => {
    const { languageService: ls } = createCompilerSession();
    ls.openDocument(URI, ANIMAL_PROGRAM, 1);
    const lines = ANIMAL_PROGRAM.split('\n');
    const speakLine = lines.findIndex((l) => l.includes('FUNCTION Speak'));
    const col = lines[speakLine]!.indexOf('Speak') + 1;
    const tip = ls.hover(URI, { line: speakLine, character: col });
    expect(tip?.contents ?? '').toMatch(/METHOD/i);
    expect(tip?.contents ?? '').toMatch(/FUNCTION Speak/);
    expect(tip?.contents ?? '').toMatch(/PUBLIC/);
  });

  it('hover on a PRIVATE field shows PRIVATE visibility', () => {
    const { languageService: ls } = createCompilerSession();
    ls.openDocument(URI, ANIMAL_PROGRAM, 1);
    const lines = ANIMAL_PROGRAM.split('\n');
    const nameLine = lines.findIndex((l) => l.includes('PRIVATE Name'));
    const col = lines[nameLine]!.indexOf('Name') + 1;
    const tip = ls.hover(URI, { line: nameLine, character: col });
    expect(tip?.contents ?? '').toMatch(/FIELD/i);
    expect(tip?.contents ?? '').toMatch(/PRIVATE/);
  });

  it('hover on NEW (instantiation) explains object construction', () => {
    const { languageService: ls } = createCompilerSession();
    const program = `${ANIMAL_PROGRAM}\n`;
    ls.openDocument(URI, program, 1);
    const lines = program.split('\n');
    const newLine = lines.findIndex((l) => l.trim().startsWith('A ← NEW Animal'));
    const col = lines[newLine]!.indexOf('NEW') + 1;
    const tip = ls.hover(URI, { line: newLine, character: col });
    expect(tip?.contents ?? '').toMatch(/NEW/);
    expect(tip?.contents ?? '').toMatch(/instantiates/i);
  });

  it('go to definition on a CLASS name in DECLARE', () => {
    const { languageService: ls } = createCompilerSession();
    ls.openDocument(URI, ANIMAL_PROGRAM, 1);
    const lines = ANIMAL_PROGRAM.split('\n');
    const declLine = lines.findIndex((l) => l.startsWith('DECLARE A : Animal'));
    const col = lines[declLine]!.indexOf('Animal') + 1;
    const loc = ls.definition(URI, { line: declLine, character: col });
    expect(loc).not.toBeNull();
    const classLine = lines.findIndex((l) => l.startsWith('CLASS Animal'));
    expect(loc!.range.start.line).toBe(classLine);
  });

  it('renames a method on one class without touching a same-named method on another class', () => {
    const program = `
CLASS Cat
  PROCEDURE Speak()
    OUTPUT "Meow"
  ENDPROCEDURE
ENDCLASS

CLASS Bird
  PROCEDURE Speak()
    OUTPUT "Tweet"
  ENDPROCEDURE
ENDCLASS

DECLARE C : Cat
DECLARE B : Bird
C ← NEW Cat()
B ← NEW Bird()
C.Speak()
B.Speak()
`;
    const { languageService: ls } = createCompilerSession();
    ls.openDocument(URI, program, 1);
    const lines = program.split('\n');
    const catSpeakLine = lines.findIndex((l) => l.includes('PROCEDURE Speak') && lines.indexOf(l) < lines.findIndex((x) => x.startsWith('CLASS Bird')));
    const col = lines[catSpeakLine]!.indexOf('Speak') + 1;

    const result = ls.rename(URI, { line: catSpeakLine, character: col }, 'MakeSound');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const editedLines = result.edit.edits.map((e) => e.range.start.line);
    // Every edited line must belong to Cat's Speak (decl + call), never Bird's.
    const birdSpeakLine = lines.findIndex((l) => l.includes('PROCEDURE Speak') && lines.indexOf(l) > lines.findIndex((x) => x.startsWith('CLASS Bird')));
    const birdCallLine = lines.findIndex((l) => l.trim() === 'B.Speak()');
    expect(editedLines).not.toContain(birdSpeakLine);
    expect(editedLines).not.toContain(birdCallLine);

    const catCallLine = lines.findIndex((l) => l.trim() === 'C.Speak()');
    expect(editedLines).toContain(catCallLine);
    expect(editedLines).toContain(catSpeakLine);
    expect(result.edit.edits.every((e) => e.newText === 'MakeSound')).toBe(true);
  });

  it('find references on a field lists declaration + all uses, scoped to its class', () => {
    const { languageService: ls } = createCompilerSession();
    ls.openDocument(URI, ANIMAL_PROGRAM, 1);
    const lines = ANIMAL_PROGRAM.split('\n');
    const soundDeclLine = lines.findIndex((l) => l.includes('PUBLIC Sound'));
    const col = lines[soundDeclLine]!.indexOf('Sound') + 1;
    const refs = ls.references(URI, { line: soundDeclLine, character: col });
    expect(refs.length).toBeGreaterThanOrEqual(2);
  });

  it('document symbols include the CLASS, its fields, and its methods', () => {
    const { languageService: ls } = createCompilerSession();
    ls.openDocument(URI, ANIMAL_PROGRAM, 1);
    const symbols = ls.documentSymbols(URI);

    const animalClass = symbols.find((s) => s.kind === 'class' && s.name === 'Animal');
    expect(animalClass).toBeDefined();

    const membersOfAnimal = symbols.filter(
      (s) => (s.kind === 'field' || s.kind === 'method') && s.containerName === 'Animal',
    );
    const memberNames = membersOfAnimal.map((s) => s.name);
    expect(memberNames).toEqual(
      expect.arrayContaining(['Name', 'Sound', 'NEW', 'Speak']),
    );

    const dogClass = symbols.find((s) => s.kind === 'class' && s.name === 'Dog');
    expect(dogClass).toBeDefined();
  });
});
