import { describe, expect, it } from 'vitest';
import {
  LanguageService,
  analyzeDocument,
  positionAt,
  PACKAGE_VERSION,
  createCompilerSession,
} from './index.js';

const URI = 'file:///test.pseudo';

function open(source: string): LanguageService {
  const ls = new LanguageService();
  ls.openDocument(URI, source, 1);
  return ls;
}

/** Position of the Nth whole-word identifier match (0-based). */
function identPos(
  source: string,
  name: string,
  occurrence = 0,
): { line: number; character: number } {
  const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    if (i === occurrence) return positionAt(source, m.index);
    i += 1;
  }
  throw new Error(`identifier not found: ${name} #${occurrence}`);
}

describe('language-service package', () => {
  it('exports a version', () => {
    expect(PACKAGE_VERSION).toBe('1.0.0-beta.0');
  });
});

describe('analyzeDocument', () => {
  it('reuses checker diagnostics (no duplicate codes invented)', () => {
    const a = analyzeDocument(URI, `OUTPUT Undeclared\n`);
    expect(a.diagnostics.some((d) => d.code.startsWith('C_'))).toBe(true);
  });

  it('collects symbols including locals and params', () => {
    const a = analyzeDocument(
      URI,
      `
PROCEDURE P(X : INTEGER)
  DECLARE Y : INTEGER
  Y ← X
ENDPROCEDURE
`,
    );
    const kinds = a.symbols.map((s) => `${s.kind}:${s.name}`).sort();
    expect(kinds).toContain('procedure:P');
    expect(kinds).toContain('parameter:X');
    expect(kinds).toContain('variable:Y');
  });

  it('collects each name from a Cambridge grouped parameter list', () => {
    const a = analyzeDocument(
      URI,
      `
FUNCTION F(a, b : INTEGER, c : REAL) RETURNS REAL
  RETURN a + b + c
ENDFUNCTION
`,
    );
    const kinds = a.symbols.map((s) => `${s.kind}:${s.name}`).sort();
    expect(kinds).toContain('function:F');
    expect(kinds).toContain('parameter:a');
    expect(kinds).toContain('parameter:b');
    expect(kinds).toContain('parameter:c');
  });
});

describe('grouped parameter IDE features', () => {
  const source = `
FUNCTION Mix(a, b : INTEGER, scale : REAL) RETURNS REAL
  RETURN (a + b) * scale
ENDFUNCTION
OUTPUT Mix(1, 2, 3.0)
`;

  it('hover on a grouped parameter shows its type', () => {
    const ls = open(source);
    const tip = ls.hover(URI, identPos(source, 'b', 0));
    expect(tip?.contents ?? '').toMatch(/INTEGER/i);
    expect(tip?.contents ?? '').toMatch(/\bb\b/);
  });

  it('completion inside the function body includes grouped parameters', () => {
    const bodySrc = `
FUNCTION Mix(a, b : INTEGER) RETURNS INTEGER
  RETURN 
ENDFUNCTION
`;
    const ls = open(bodySrc);
    const atReturn = identPos(bodySrc, 'RETURN', 0);
    // Character after RETURN + space
    const items = ls.completion(URI, {
      line: atReturn.line,
      character: atReturn.character + 'RETURN '.length,
    });
    expect(items.some((i) => i.label === 'a')).toBe(true);
    expect(items.some((i) => i.label === 'b')).toBe(true);
  });

  it('go to definition on a use finds the grouped parameter declaration', () => {
    const ls = open(source);
    // Second `a` is the use in RETURN (a + b)
    const loc = ls.definition(URI, identPos(source, 'a', 1));
    expect(loc).not.toBeNull();
    expect(loc!.range.start.line).toBe(identPos(source, 'a', 0).line);
  });

  it('finds references for a grouped parameter', () => {
    const ls = open(source);
    const refs = ls.references(URI, identPos(source, 'a', 0));
    expect(refs.length).toBeGreaterThanOrEqual(2);
  });

  it('renames a grouped parameter across declaration and uses', () => {
    const ls = open(source);
    const result = ls.rename(URI, identPos(source, 'b', 0), 'beta');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.edit.edits.length).toBeGreaterThanOrEqual(2);
      expect(result.edit.edits.every((e) => e.newText === 'beta')).toBe(true);
    }
  });
});

describe('DATE language service', () => {
  const source = `
DECLARE D : DATE
D ← 04/10/2003
OUTPUT YEAR(D)
`;

  it('offers DATE in DECLARE completion', () => {
    const src = `DECLARE X : `;
    const ls = open(src);
    const items = ls.completion(URI, { line: 0, character: src.length });
    expect(items.some((i) => i.label === 'DATE')).toBe(true);
    expect(items.some((i) => i.label === 'TIME')).toBe(false);
  });

  it('hovers DATE variables', () => {
    const ls = open(source);
    const dHover = ls.hover(URI, identPos(source, 'D', 0));
    expect(dHover?.contents ?? '').toMatch(/DATE/i);
  });

  it('go to definition / references / rename for DATE variables', () => {
    const ls = open(source);
    const def = ls.definition(URI, identPos(source, 'D', 1));
    expect(def).not.toBeNull();
    const refs = ls.references(URI, identPos(source, 'D', 0));
    expect(refs.length).toBeGreaterThanOrEqual(2);
    const renamed = ls.rename(URI, identPos(source, 'D', 0), 'Birth');
    expect(renamed.ok).toBe(true);
  });

  it('lists DATE variables in document symbols and classifyAt', () => {
    const ls = open(source);
    const syms = ls.documentSymbols(URI);
    expect(syms.some((s) => s.name === 'D')).toBe(true);
    expect(ls.classifyAt(URI, identPos(source, 'D', 1))?.kind).toBe('variable');
  });
});

describe('hover', () => {
  it('shows variable type and declaration location', () => {
    const source = `
DECLARE Count : INTEGER
Count ← 1
OUTPUT Count
`;
    const ls = open(source);
    const h = ls.hover(URI, identPos(source, 'Count', 1));
    expect(h).not.toBeNull();
    expect(h!.contents).toContain('VARIABLE');
    expect(h!.contents).toContain('INTEGER');
    expect(h!.contents).toContain('Declared at line');
  });

  it('shows function / procedure signatures', () => {
    const source = `
FUNCTION Add(A : INTEGER, B : INTEGER) RETURNS INTEGER
  RETURN A + B
ENDFUNCTION
OUTPUT Add(1, 2)
`;
    const ls = open(source);
    const h = ls.hover(URI, identPos(source, 'Add', 1));
    expect(h!.contents).toContain('FUNCTION');
    expect(h!.contents).toMatch(/RETURNS INTEGER/);
    expect(h!.contents).toMatch(/A: INTEGER/);
  });

  it('shows builtin summary', () => {
    const source = `OUTPUT LENGTH("hi")\n`;
    const ls = open(source);
    const h = ls.hover(URI, identPos(source, 'LENGTH'));
    expect(h!.contents.toLowerCase()).toContain('builtin');
    expect(h!.contents).toContain('LENGTH');
  });

  it('shows constant kind and value', () => {
    const source = `
CONSTANT Max = 10
OUTPUT Max
`;
    const ls = open(source);
    const h = ls.hover(URI, identPos(source, 'Max', 1));
    expect(h!.contents).toContain('CONSTANT');
    expect(h!.contents).toMatch(/Value:.*10/);
  });

  it('shows array type', () => {
    const source = `
DECLARE Scores : ARRAY[1:5] OF INTEGER
OUTPUT Scores[1]
`;
    const ls = open(source);
    const h = ls.hover(URI, identPos(source, 'Scores', 1));
    expect(h!.contents).toMatch(/ARRAY|array/i);
  });
});

describe('definition / declaration', () => {
  it('jumps to DECLARE site', () => {
    const source = `
DECLARE Name : STRING
Name ← "Ada"
OUTPUT Name
`;
    const ls = open(source);
    const loc = ls.definition(URI, identPos(source, 'Name', 2));
    expect(loc).not.toBeNull();
    expect(loc!.range.start.line).toBe(1); // DECLARE line (0-based → line 2 in 1-based)
  });

  it('jumps to PROCEDURE name', () => {
    const source = `
PROCEDURE Greet
  OUTPUT "hi"
ENDPROCEDURE
CALL Greet
`;
    const ls = open(source);
    const loc = ls.findDeclaration(URI, identPos(source, 'Greet', 1));
    expect(loc!.range.start.line).toBe(1);
  });

  it('does not jump for builtins', () => {
    const source = `OUTPUT INT(3.2)\n`;
    const ls = open(source);
    expect(ls.definition(URI, identPos(source, 'INT'))).toBeNull();
  });
});

describe('references', () => {
  it('finds all uses of a variable', () => {
    const source = `
DECLARE N : INTEGER
N ← 1
N ← N + 1
OUTPUT N
`;
    const ls = open(source);
    const refs = ls.references(URI, identPos(source, 'N', 0));
    expect(refs.length).toBeGreaterThanOrEqual(4);
  });

  it('respects nested scopes / shadowing', () => {
    const source = `
DECLARE X : INTEGER
PROCEDURE P
  DECLARE X : INTEGER
  X ← 2
ENDPROCEDURE
X ← 1
`;
    const ls = open(source);
    const globalRefs = ls.references(URI, identPos(source, 'X', 0));
    const localUse = identPos(source, 'X', 2); // assignment inside P
    const localRefs = ls.references(URI, localUse);
    expect(localRefs.length).toBeGreaterThanOrEqual(2);
    expect(globalRefs.length).toBeGreaterThanOrEqual(2);
  });
});

describe('rename', () => {
  it('rejects keywords and builtins', () => {
    const source = `OUTPUT LENGTH("a")\n`;
    const ls = open(source);
    expect(ls.prepareRename(URI, identPos(source, 'LENGTH')).ok).toBe(false);
  });

  it('rejects duplicate names in scope', () => {
    const source = `
DECLARE A : INTEGER
DECLARE B : INTEGER
A ← 1
`;
    const ls = open(source);
    const result = ls.rename(URI, identPos(source, 'A', 0), 'B');
    expect(result.ok).toBe(false);
  });

  it('returns edits for all occurrences', () => {
    const source = `
DECLARE Count : INTEGER
Count ← 1
OUTPUT Count
`;
    const ls = open(source);
    const result = ls.rename(URI, identPos(source, 'Count', 0), 'Total');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.edit.edits.length).toBeGreaterThanOrEqual(3);
      expect(result.edit.edits.every((e) => e.newText === 'Total')).toBe(true);
    }
  });
});

describe('completion', () => {
  it('includes in-scope identifiers and builtins', () => {
    const source = `
DECLARE Value : INTEGER
Value ← 
`;
    const ls = open(source);
    const atEnd = positionAt(source, source.length);
    const all = ls.completion(URI, atEnd);
    expect(all.some((i) => i.label === 'Value')).toBe(true);
    expect(all.some((i) => i.label === 'LENGTH')).toBe(true);
  });

  it('after CALL prefers procedures', () => {
    const source = `
PROCEDURE DoIt
  OUTPUT 1
ENDPROCEDURE
CALL 
`;
    const ls = open(source);
    const atEnd = positionAt(source, source.length);
    const items = ls.completion(URI, atEnd);
    expect(items.some((i) => i.label === 'DoIt' && i.kind === 'procedure')).toBe(
      true,
    );
  });
});

describe('signature help', () => {
  it('highlights active parameter for builtins', () => {
    const source = `OUTPUT LEFT("abcdef", 2)\n`;
    const ls = open(source);
    const p = identPos(source, '2');
    // '2' is not an identifier — use position of the digit
    const digit = positionAt(source, source.indexOf(', 2') + 2);
    const help = ls.signatureHelp(URI, digit);
    expect(help).not.toBeNull();
    expect(help!.label).toContain('LEFT');
    expect(help!.activeParameter).toBe(1);
    void p;
  });

  it('works for user functions with parameter names', () => {
    const source = `
FUNCTION Add(A : INTEGER, B : INTEGER) RETURNS INTEGER
  RETURN A + B
ENDFUNCTION
OUTPUT Add(1, 2)
`;
    const ls = open(source);
    const help = ls.signatureHelp(URI, positionAt(source, source.indexOf(', 2') + 2));
    expect(help!.label).toMatch(/Add/);
    expect(help!.parameters.length).toBe(2);
    expect(help!.parameters[0]!.label).toMatch(/A:/);
  });
});

describe('document / workspace symbols', () => {
  it('lists document symbols', () => {
    const source = `
DECLARE A : INTEGER
CONSTANT B = 1
PROCEDURE P
ENDPROCEDURE
`;
    const ls = open(source);
    const syms = ls.documentSymbols(URI);
    expect(syms.map((s) => s.name).sort()).toEqual(['A', 'B', 'P'].sort());
  });

  it('filters workspace symbols by query', () => {
    const ls = open(`DECLARE Alpha : INTEGER\nDECLARE Beta : INTEGER\n`);
    const hits = ls.workspaceSymbols('alp');
    expect(hits.some((s) => s.name === 'Alpha')).toBe(true);
    expect(hits.some((s) => s.name === 'Beta')).toBe(false);
  });
});

describe('classifyAt', () => {
  it('classifies identifiers', () => {
    const source = `DECLARE N : INTEGER\nOUTPUT N\n`;
    const ls = open(source);
    expect(ls.classifyAt(URI, identPos(source, 'N', 1))?.kind).toBe('variable');
  });
});

describe('caching', () => {
  it('reuses analysis for the same version', () => {
    const ls = new LanguageService();
    const a1 = ls.openDocument(URI, `DECLARE X : INTEGER\n`, 1);
    const a2 = ls.updateDocument(URI, `DECLARE X : INTEGER\n`, 1);
    expect(a1).toBe(a2);
    const a3 = ls.updateDocument(URI, `DECLARE Y : INTEGER\n`, 2);
    expect(a3).not.toBe(a1);
  });

  it('skips parse/check when content hash is unchanged across versions', () => {
    const ls = new LanguageService();
    const source = `DECLARE X : INTEGER\nOUTPUT X\n`;
    ls.openDocument(URI, source, 1);
    ls.updateDocument(URI, source, 2);
    ls.updateDocument(URI, source, 3);
    const stats = ls.getCompiler().totalStats();
    expect(stats.parseRuns).toBe(1);
    expect(stats.checkRuns).toBe(1);
    expect(stats.cacheHits).toBeGreaterThanOrEqual(2);
  });

  it('reuses hover memo for the same position until content changes', () => {
    const source = `
DECLARE Count : INTEGER
OUTPUT Count
`;
    const ls = open(source);
    const pos = identPos(source, 'Count', 1);
    const h1 = ls.hover(URI, pos);
    const h2 = ls.hover(URI, pos);
    expect(h1).toBe(h2);
  });

  it('createCompilerSession wires getHover through CompilerService', () => {
    const { compilerService, languageService } = createCompilerSession();
    const source = `DECLARE N : INTEGER\nOUTPUT N\n`;
    compilerService.openDocument(URI, source, 1);
    const tip = compilerService.getHover(URI, identPos(source, 'N', 1));
    expect(tip).toBeTruthy();
    expect((tip as { contents: string }).contents).toContain('VARIABLE');
    expect(languageService.getCompiler().totalStats().parseRuns).toBe(1);
  });

  it('CompilerService.close drops analysis shells (no leak)', () => {
    const { compilerService, languageService } = createCompilerSession();
    compilerService.openDocument(URI, `DECLARE N : INTEGER\nOUTPUT N\n`, 1);
    expect(languageService.hasAnalysis(URI)).toBe(true);
    compilerService.closeDocument(URI);
    expect(languageService.hasAnalysis(URI)).toBe(false);
  });

  it('hover stays fresh after CompilerService content update', () => {
    const { compilerService, languageService } = createCompilerSession();
    compilerService.openDocument(
      URI,
      'DECLARE Alpha : INTEGER\nOUTPUT Alpha\n',
      1,
    );
    const pos = { line: 1, character: 7 };
    expect(languageService.hover(URI, pos)?.contents).toContain('Alpha');
    compilerService.updateDocument(
      URI,
      'DECLARE Beta : INTEGER\nOUTPUT Beta\n',
      2,
    );
    const h2 = languageService.hover(URI, pos);
    expect(h2?.contents).toContain('Beta');
    expect(h2?.contents).not.toContain('Alpha');
  });
});
