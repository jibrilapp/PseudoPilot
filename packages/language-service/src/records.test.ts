import { describe, expect, it } from 'vitest';
import { createCompilerSession } from './index.js';

const URI = 'file:///records.pseudo';

describe('language service — TYPE / records', () => {
  it('hover on enum TYPE shows members', () => {
    const { languageService: ls } = createCompilerSession();
    ls.openDocument(
      URI,
      `
TYPE Season = (Spring, Summer, Autumn, Winter)
DECLARE Current : Season
Current ← Autumn
`,
      1,
    );
    const hover = ls.hover(URI, { line: 1, character: 6 });
    expect(hover?.contents ?? '').toMatch(/Season/i);
    expect(hover?.contents ?? '').toMatch(/Spring, Summer, Autumn, Winter/i);
  });

  it('completion after enum assignment suggests enum members', () => {
    const { languageService: ls } = createCompilerSession();
    ls.openDocument(
      URI,
      `
TYPE Season = (Spring, Summer, Autumn, Winter)
DECLARE Current : Season
Current ← 
`,
      1,
    );
    const items = ls.completion(URI, { line: 3, character: 10 });
    const labels = items.map((i) => i.label);
    expect(labels).toContain('Spring');
    expect(labels).toContain('Summer');
    expect(labels).toContain('Autumn');
    expect(labels).toContain('Winter');
  });

  it('hover on TYPE and field', () => {
    const { languageService: ls } = createCompilerSession();
    ls.openDocument(
      URI,
      `
TYPE Student
  DECLARE Name : STRING
  DECLARE Age : INTEGER
ENDTYPE
DECLARE S : Student
S.Name ← "A"
`,
      1,
    );
    const typeHover = ls.hover(URI, { line: 1, character: 6 });
    expect(typeHover?.contents ?? '').toMatch(/TYPE|Student/i);

    const fieldHover = ls.hover(URI, { line: 6, character: 3 });
    expect(fieldHover?.contents ?? '').toMatch(/Name|STRING/i);
  });

  it('completion after dot suggests fields', () => {
    const { languageService: ls } = createCompilerSession();
    ls.openDocument(
      URI,
      `
TYPE Student
  DECLARE Name : STRING
  DECLARE Age : INTEGER
ENDTYPE
DECLARE S : Student
S.
`,
      1,
    );
    // Position after `S.`
    const items = ls.completion(URI, { line: 6, character: 2 });
    const labels = items.map((i) => i.label);
    expect(labels).toContain('Name');
    expect(labels).toContain('Age');
  });

  it('rename field updates all occurrences', () => {
    const { languageService: ls } = createCompilerSession();
    ls.openDocument(
      URI,
      `
TYPE Student
  DECLARE Name : STRING
ENDTYPE
DECLARE S : Student
S.Name ← "A"
OUTPUT S.Name
`,
      1,
    );
    const result = ls.rename(URI, { line: 5, character: 3 }, 'FullName');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.edit.edits.length).toBeGreaterThanOrEqual(2);
      expect(result.edit.edits.every((e) => e.newText === 'FullName')).toBe(true);
    }
  });

  it('go to definition on TYPE name in DECLARE', () => {
    const { languageService: ls } = createCompilerSession();
    ls.openDocument(
      URI,
      `
TYPE Student
  DECLARE Name : STRING
ENDTYPE
DECLARE S : Student
`,
      1,
    );
    // "Student" in DECLARE line
    const loc = ls.definition(URI, { line: 4, character: 14 });
    expect(loc).not.toBeNull();
    expect(loc!.range.start.line).toBe(1);
  });

  it('does not confuse fields with the same name on different TYPEs', () => {
    const { languageService: ls } = createCompilerSession();
    ls.openDocument(
      URI,
      `
TYPE Teacher
  DECLARE Name : STRING
ENDTYPE
TYPE Student
  DECLARE Name : STRING
ENDTYPE
DECLARE T : Teacher
DECLARE S : Student
T.Name ← "T"
S.Name ← "S"
`,
      1,
    );
    // Hover/rename on S.Name (line 10), not T.Name (line 9).
    const hover = ls.hover(URI, { line: 10, character: 3 });
    expect(hover?.contents ?? '').toMatch(/Student/i);
    expect(hover?.contents ?? '').not.toMatch(/Teacher/i);

    const renamed = ls.rename(URI, { line: 10, character: 3 }, 'FullName');
    expect(renamed.ok).toBe(true);
    if (renamed.ok) {
      // Should not rename Teacher.Name declaration/use.
      const texts = renamed.edit.edits.map((e) => e.range.start.line);
      expect(texts.every((line) => line !== 2)).toBe(true);
      // Should not rename T.Name use.
      expect(texts.every((line) => line !== 9)).toBe(true);
    }
  });

  it('completion after nested dot only lists that record\'s fields', () => {
    const { languageService: ls } = createCompilerSession();
    ls.openDocument(
      URI,
      `
TYPE Address
  DECLARE City : STRING
ENDTYPE
TYPE Student
  DECLARE Home : Address
ENDTYPE
DECLARE S : Student
S.Home.
`,
      1,
    );
    const items = ls.completion(URI, { line: 8, character: 7 });
    const labels = items.map((i) => i.label);
    expect(labels).toEqual(['City']);
  });
});
