import { describe, expect, it, beforeEach } from 'vitest';
import {
  getIdeLanguageService,
  getIdeCompilerService,
  resetIdeLanguageServiceForTests,
  IDE_DOCUMENT_URI,
} from './index';

describe('IDE language service bridge', () => {
  beforeEach(() => {
    resetIdeLanguageServiceForTests();
  });

  it('analyzes the open buffer without executing', () => {
    const ls = getIdeLanguageService();
    const source = `DECLARE N : INTEGER\nOUTPUT N\n`;
    ls.openDocument(IDE_DOCUMENT_URI, source, 1);
    const tip = ls.hover(IDE_DOCUMENT_URI, { line: 1, character: 7 });
    expect(tip?.contents).toContain('VARIABLE');
    expect(ls.diagnostics(IDE_DOCUMENT_URI).every((d) => d.code !== 'R_')).toBe(
      true,
    );
  });

  it('shares incremental cache between language + compiler services', () => {
    const ls = getIdeLanguageService();
    const cs = getIdeCompilerService();
    const source = `DECLARE N : INTEGER\nOUTPUT N\n`;
    ls.openDocument(IDE_DOCUMENT_URI, source, 1);
    expect(cs.compile(IDE_DOCUMENT_URI).cacheHit).toBe(true);
    expect(ls.getCompiler().totalStats().parseRuns).toBe(1);
  });
});
