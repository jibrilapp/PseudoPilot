import { describe, expect, it, beforeEach } from 'vitest';
import {
  collectAIContext,
  summariseAst,
  setEditorSelection,
  clearEditorSelection,
} from './index';
import {
  getIdeLanguageService,
  IDE_DOCUMENT_URI,
  resetIdeLanguageServiceForTests,
} from '@/lib/languageService';
import type { RuntimeSnapshot } from '@/lib/runtime/types';

const idleRuntime = (): RuntimeSnapshot => ({
  state: 'idle',
  consoleLines: [],
  diagnostics: [],
  variables: [],
  frameName: null,
  steps: 0,
  awaitingInput: false,
  paused: false,
  pauseLocation: null,
  callStack: [],
  breakpoints: [],
});

describe('summariseAst', () => {
  it('extracts statement kinds and lines', () => {
    const summary = summariseAst({
      kind: 'Program',
      body: [
        {
          kind: 'DeclareStatement',
          span: { start: { line: 1 } },
          names: [{ name: 'N' }],
          type: { kind: 'TypeName', name: 'INTEGER' },
        },
        {
          kind: 'OutputStatement',
          span: { start: { line: 2 } },
        },
      ],
    });
    expect(summary.map((s) => s.kind)).toEqual([
      'DeclareStatement',
      'OutputStatement',
    ]);
    expect(summary[0]?.detail).toContain('N');
    expect(summary[0]?.line).toBe(1);
  });

  it('summarises enum, pointer, set, and DEFINE nodes', () => {
    const summary = summariseAst({
      kind: 'Program',
      body: [
        {
          kind: 'EnumTypeDeclaration',
          span: { start: { line: 1 } },
          name: { name: 'Season' },
          members: [{ name: 'Spring' }, { name: 'Summer' }],
        },
        {
          kind: 'PointerTypeDeclaration',
          span: { start: { line: 2 } },
          name: { name: 'IntPtr' },
          targetType: { kind: 'TypeName', name: 'INTEGER' },
        },
        {
          kind: 'SetTypeDeclaration',
          span: { start: { line: 3 } },
          name: { name: 'Odds' },
          elementType: { kind: 'TypeName', name: 'INTEGER' },
        },
        {
          kind: 'DefineStatement',
          span: { start: { line: 4 } },
          name: { name: 'Lucky' },
        },
      ],
    });
    expect(summary[0]?.detail).toContain('Season');
    expect(summary[0]?.detail).toContain('Spring');
    expect(summary[1]?.detail).toContain('^INTEGER');
    expect(summary[2]?.detail).toContain('SET OF INTEGER');
    expect(summary[3]?.detail).toContain('Lucky');
  });
});

describe('collectAIContext', () => {
  beforeEach(() => {
    resetIdeLanguageServiceForTests();
    clearEditorSelection();
  });

  it('builds AIContext from LS + translation + selection', () => {
    const source = `
DECLARE Count : INTEGER
Count ← 1
OUTPUT Count
OUTPUT Missing
`;
    getIdeLanguageService().openDocument(IDE_DOCUMENT_URI, source, 1);
    setEditorSelection('OUTPUT Count', 'pseudocode');

    const ctx = collectAIContext({
      pseudocode: source,
      python: 'Count: int = 1\nprint(Count)\n',
      translationStatus: 'ok',
      translationErrorSide: null,
      translationDiagnostics: [],
      runtime: idleRuntime(),
    });

    expect(ctx.documentUri).toBe(IDE_DOCUMENT_URI);
    expect(ctx.pseudocode).toContain('DECLARE Count');
    expect(ctx.python).toContain('print');
    expect(ctx.symbols.some((s) => s.name === 'Count')).toBe(true);
    expect(ctx.symbols.find((s) => s.name === 'Count')?.type).toMatch(/INTEGER/i);
    expect(ctx.astSummary.some((n) => n.kind === 'DeclareStatement')).toBe(true);
    expect(
      ctx.semanticDiagnostics.length + ctx.parserDiagnostics.length,
    ).toBeGreaterThan(0);
    expect(
      [...ctx.semanticDiagnostics, ...ctx.parserDiagnostics].some((d) =>
        /UNDECL/i.test(d.code),
      ),
    ).toBe(true);
    expect(ctx.selectedText).toBe('OUTPUT Count');
    expect(ctx.selectedLanguage).toBe('pseudocode');
  });

  it('extracts debugger / runtime context when paused', () => {
    getIdeLanguageService().openDocument(
      IDE_DOCUMENT_URI,
      'DECLARE N : INTEGER\nOUTPUT N\n',
      1,
    );
    const ctx = collectAIContext({
      pseudocode: 'DECLARE N : INTEGER\nOUTPUT N\n',
      python: 'N: int\nprint(N)\n',
      translationStatus: 'ok',
      translationErrorSide: null,
      translationDiagnostics: [],
      runtime: {
        ...idleRuntime(),
        state: 'paused',
        paused: true,
        frameName: '<global>',
        pauseLocation: {
          line: 2,
          column: 1,
          step: 3,
          depth: 1,
          frameName: '<global>',
          frameKind: 'global',
        },
        variables: [
          {
            name: 'N',
            type: 'INTEGER',
            value: '0',
            kind: 'variable',
            scope: 'global',
          },
        ],
        callStack: [
          {
            id: 1,
            name: '<global>',
            kind: 'global',
            line: 2,
            args: [],
          },
        ],
        diagnostics: [
          {
            id: 'r1',
            severity: 'error',
            code: 'R_INDEX',
            message: 'Index out of bounds',
            line: 2,
          },
        ],
      },
    });

    expect(ctx.debugger.paused).toBe(true);
    expect(ctx.debugger.currentLine).toBe(2);
    expect(ctx.debugger.variables[0]?.name).toBe('N');
    expect(ctx.debugger.callStack[0]?.name).toBe('<global>');
    expect(ctx.debugger.runtimeErrors.some((d) => d.code === 'R_INDEX')).toBe(
      true,
    );
  });

  it('maps translation diagnostics without clearing compiler state', () => {
    getIdeLanguageService().openDocument(
      IDE_DOCUMENT_URI,
      'OUTPUT 1\n',
      1,
    );
    const ctx = collectAIContext({
      pseudocode: 'OUTPUT 1\n',
      python: 'lambda: 1\n',
      translationStatus: 'error',
      translationErrorSide: 'python',
      translationDiagnostics: [
        {
          id: 't1',
          severity: 'error',
          code: 'T_UNSUPPORTED',
          message: 'Unsupported Python',
          line: 1,
        },
      ],
      runtime: idleRuntime(),
    });
    expect(ctx.translation.errorSide).toBe('python');
    expect(ctx.translationDiagnostics[0]?.code).toBe('T_UNSUPPORTED');
    expect(ctx.pseudocode).toContain('OUTPUT');
  });
});
