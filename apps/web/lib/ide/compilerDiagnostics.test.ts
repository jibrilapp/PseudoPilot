import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  checkerDiagnosticsToIde,
  collectCompilerIdeDiagnostics,
} from './compilerDiagnostics';
import { resetIdeLanguageServiceForTests } from '@/lib/languageService';
import type { CheckerDiagnostic } from '@pseudopilot/checker';

describe('compilerDiagnostics', () => {
  beforeEach(() => {
    resetIdeLanguageServiceForTests();
  });
  afterEach(() => {
    resetIdeLanguageServiceForTests();
  });

  it('maps checker spans to IdeDiagnostic rows with codes', () => {
    const diags: CheckerDiagnostic[] = [
      {
        severity: 'error',
        code: 'C_UNDECLARED',
        message: 'Name is not declared',
        help: 'Add DECLARE Name : STRING',
        span: {
          start: { offset: 0, line: 2, column: 1 },
          end: { offset: 4, line: 2, column: 5 },
        },
      },
    ];
    expect(checkerDiagnosticsToIde(diags)).toEqual([
      {
        id: 'compiler-0-C_UNDECLARED-2-1',
        severity: 'error',
        code: 'C_UNDECLARED',
        message: 'Name is not declared',
        line: 2,
        column: 1,
        help: 'Add DECLARE Name : STRING',
      },
    ]);
  });

  it('collects live C_* diagnostics from the language service', () => {
    const bad = `DECLARE X : INTEGER
OUTPUT Y
`;
    const diags = collectCompilerIdeDiagnostics(bad);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags.some((d) => d.code.startsWith('C_'))).toBe(true);
    expect(diags.every((d) => typeof d.message === 'string')).toBe(true);
    expect(diags.every((d) => d.line != null && d.line >= 1)).toBe(true);
  });

  it('returns empty for a clean Cambridge program', () => {
    const ok = `DECLARE N : INTEGER
N ← 1
OUTPUT N
`;
    const diags = collectCompilerIdeDiagnostics(ok);
    expect(diags.filter((d) => d.severity === 'error')).toEqual([]);
  });
});
