import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  monacoToLs,
  lsPosToMonaco,
  lsRangeToMonaco,
  diagnosticsToMarkers,
  mapCompletions,
  mapSignatureHelp,
  hoverToMarkdown,
  mergeEditorDecorations,
  MARKER_SEVERITY_ERROR,
  createGenerationDebouncer,
  nextDocumentVersion,
} from './index';
import {
  getIdeLanguageService,
  IDE_DOCUMENT_URI,
  resetIdeLanguageServiceForTests,
} from '@/lib/languageService';

describe('monaco protocol mapping', () => {
  it('converts Monaco ↔ LS positions', () => {
    expect(monacoToLs({ lineNumber: 2, column: 5 })).toEqual({
      line: 1,
      character: 4,
    });
    expect(lsPosToMonaco({ line: 1, character: 4 })).toEqual({
      lineNumber: 2,
      column: 5,
    });
  });

  it('maps ranges', () => {
    expect(
      lsRangeToMonaco({
        start: { line: 0, character: 0 },
        end: { line: 0, character: 3 },
      }),
    ).toEqual({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 4,
    });
  });
});

describe('monaco provider adapters', () => {
  it('maps hover markdown', () => {
    expect(
      hoverToMarkdown({
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 1 },
        },
        contents: '**VARIABLE** `N`',
        symbol: null,
      }),
    ).toContain('VARIABLE');
    expect(hoverToMarkdown(null)).toBeNull();
  });

  it('maps completions', () => {
    const items = mapCompletions([
      { label: 'LENGTH', kind: 'function', detail: 'builtin' },
      { label: 'IF', kind: 'keyword' },
    ]);
    expect(items.map((i) => i.label)).toEqual(['LENGTH', 'IF']);
  });

  it('maps signature help', () => {
    const help = mapSignatureHelp({
      label: 'LEFT(s, n)',
      parameters: [
        { label: 's: STRING' },
        { label: 'n: INTEGER' },
      ],
      activeParameter: 1,
    });
    expect(help?.activeParameter).toBe(1);
    expect(help?.signatures[0]?.parameters).toHaveLength(2);
  });

  it('maps checker diagnostics to markers (1-based spans)', () => {
    const markers = diagnosticsToMarkers([
      {
        severity: 'error',
        code: 'C_UNDECLARED',
        message: 'Undeclared',
        span: {
          start: { line: 2, column: 8 },
          end: { line: 2, column: 15 },
        },
      },
    ]);
    expect(markers[0]?.severity).toBe(MARKER_SEVERITY_ERROR);
    expect(markers[0]?.startLineNumber).toBe(2);
    expect(markers[0]?.startColumn).toBe(8);
  });
});

describe('monaco decorations', () => {
  it('builds breakpoint + exec-line decorations', () => {
    const deco = mergeEditorDecorations(
      [
        { id: '1', line: 3, enabled: true },
        { id: '2', line: 5, enabled: false },
      ],
      3,
    );
    expect(deco.some((d) => d.options.glyphMarginClassName === 'pp-bp-glyph')).toBe(
      true,
    );
    expect(
      deco.some((d) => d.options.glyphMarginClassName === 'pp-bp-glyph-disabled'),
    ).toBe(true);
    expect(deco.some((d) => d.options.className === 'pp-exec-line')).toBe(true);
  });

  it('drops exec-line decoration when activeLine is null (no leak)', () => {
    const deco = mergeEditorDecorations(
      [{ id: '1', line: 2, enabled: true }],
      null,
    );
    expect(deco.every((d) => d.options.className !== 'pp-exec-line')).toBe(true);
    expect(deco).toHaveLength(1);
  });
});

describe('generation debouncer (marker races)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs only the latest scheduled callback', () => {
    const d = createGenerationDebouncer(200);
    const calls: number[] = [];
    d.schedule(() => calls.push(1));
    d.schedule(() => calls.push(2));
    d.schedule(() => calls.push(3));
    vi.advanceTimersByTime(200);
    expect(calls).toEqual([3]);
  });

  it('cancel prevents a pending callback', () => {
    const d = createGenerationDebouncer(200);
    let ran = false;
    d.schedule(() => {
      ran = true;
    });
    d.cancel();
    vi.advanceTimersByTime(500);
    expect(ran).toBe(false);
  });

  it('rapid typing schedule stress does not pile up callbacks', () => {
    const d = createGenerationDebouncer(50);
    let runs = 0;
    for (let i = 0; i < 200; i++) {
      d.schedule(() => {
        runs += 1;
      });
      vi.advanceTimersByTime(5);
    }
    vi.advanceTimersByTime(50);
    expect(runs).toBe(1);
  });
});

describe('document version sync (LSP stale-update)', () => {
  beforeEach(() => {
    resetIdeLanguageServiceForTests();
  });

  it('bumps past stored analysis version after remount-style reset', () => {
    const ls = getIdeLanguageService();
    ls.openDocument(IDE_DOCUMENT_URI, 'DECLARE A : INTEGER\n', 10);
    // Simulate React remount resetting local counter to 0.
    const next = nextDocumentVersion(ls, IDE_DOCUMENT_URI, 0);
    expect(next).toBe(11);
    ls.updateDocument(IDE_DOCUMENT_URI, 'DECLARE B : INTEGER\n', next);
    expect(ls.getAnalysis(IDE_DOCUMENT_URI)?.source).toContain('DECLARE B');
  });

  it('rejects would-be stale versions without nextDocumentVersion', () => {
    const ls = getIdeLanguageService();
    ls.openDocument(IDE_DOCUMENT_URI, 'DECLARE A : INTEGER\n', 5);
    // Remount bug: local version resets to 1 → ignored by compiler.
    ls.updateDocument(IDE_DOCUMENT_URI, 'DECLARE Z : INTEGER\n', 1);
    expect(ls.getAnalysis(IDE_DOCUMENT_URI)?.source).toContain('DECLARE A');
  });
});

describe('sync LS buffer vs debounced markers (stale hover regression)', () => {
  beforeEach(() => {
    resetIdeLanguageServiceForTests();
  });

  it('hover sees sync updateDocument before any marker debounce', () => {
    const ls = getIdeLanguageService();
    ls.openDocument(IDE_DOCUMENT_URI, 'DECLARE A : INTEGER\n', 1);
    // Immediate sync (what CodeSurface does on keystroke):
    ls.updateDocument(IDE_DOCUMENT_URI, 'DECLARE AB : INTEGER\n', 2);
    const tip = ls.hover(IDE_DOCUMENT_URI, { line: 0, character: 9 });
    expect(tip?.contents ?? '').toMatch(/AB|VARIABLE/);
  });

  it('rename after rapid edits uses latest buffer', () => {
    const ls = getIdeLanguageService();
    ls.openDocument(IDE_DOCUMENT_URI, 'DECLARE X : INTEGER\nOUTPUT X\n', 1);
    ls.updateDocument(IDE_DOCUMENT_URI, 'DECLARE Y : INTEGER\nOUTPUT Y\n', 2);
    ls.updateDocument(IDE_DOCUMENT_URI, 'DECLARE Z : INTEGER\nOUTPUT Z\n', 3);
    const result = ls.rename(IDE_DOCUMENT_URI, { line: 0, character: 8 }, 'W');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.edit.edits.every((e) => e.newText === 'W')).toBe(true);
      expect(result.edit.edits.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('diagnostics after rapid edits reflect final source', () => {
    const ls = getIdeLanguageService();
    ls.openDocument(IDE_DOCUMENT_URI, 'OUTPUT Missing\n', 1);
    expect(ls.diagnostics(IDE_DOCUMENT_URI).length).toBeGreaterThan(0);
    for (let v = 2; v <= 40; v++) {
      ls.updateDocument(
        IDE_DOCUMENT_URI,
        `DECLARE N : INTEGER\nOUTPUT N // v${v}\n`,
        v,
      );
    }
    const diags = ls.diagnostics(IDE_DOCUMENT_URI);
    expect(diags.every((d) => d.code !== 'C_UNDECLARED')).toBe(true);
  });

  it('large file sync update stays bounded', () => {
    const ls = getIdeLanguageService();
    const lines = Array.from(
      { length: 800 },
      (_, i) => `DECLARE V${i} : INTEGER`,
    ).join('\n');
    ls.openDocument(IDE_DOCUMENT_URI, `${lines}\nOUTPUT V0\n`, 1);
    const t0 = performance.now();
    ls.updateDocument(
      IDE_DOCUMENT_URI,
      `${lines}\nOUTPUT V0\nOUTPUT V1\n`,
      2,
    );
    const tip = ls.hover(IDE_DOCUMENT_URI, { line: 0, character: 9 });
    const elapsed = performance.now() - t0;
    expect(tip).not.toBeNull();
    expect(elapsed).toBeLessThan(5_000);
  });
});
