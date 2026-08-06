import { describe, expect, it } from 'vitest';
import {
  AICoachService,
  HeuristicAIProvider,
  UnconfiguredAIProvider,
  buildCoachPrompt,
  buildSystemPrompt,
  summariseContextForPrompt,
  PACKAGE_NAME,
  PACKAGE_VERSION,
  type AIContext,
  type AIProvider,
  type CoachRequest,
  type CoachResponse,
} from './index.js';

function emptyDebugger(): AIContext['debugger'] {
  return {
    executionState: 'idle',
    paused: false,
    currentLine: null,
    currentColumn: null,
    frameName: null,
    step: null,
    depth: null,
    variables: [],
    callStack: [],
    runtimeErrors: [],
  };
}

function baseContext(over: Partial<AIContext> = {}): AIContext {
  return {
    documentUri: 'ide://main',
    pseudocode: 'DECLARE N : INTEGER\nOUTPUT N\n',
    python: 'N: int\nprint(N)\n',
    translation: { status: 'ok', errorSide: null },
    parserDiagnostics: [],
    semanticDiagnostics: [],
    translationDiagnostics: [],
    symbols: [
      {
        name: 'N',
        kind: 'variable',
        type: 'INTEGER',
        line: 1,
        column: 9,
      },
    ],
    astSummary: [
      { kind: 'DeclareStatement', line: 1, detail: 'N : INTEGER' },
      { kind: 'OutputStatement', line: 2 },
    ],
    debugger: emptyDebugger(),
    selectedText: null,
    selectedLanguage: null,
    ...over,
  };
}

describe('ai-coach package identity', () => {
  it('exports package identity', () => {
    expect(PACKAGE_NAME).toBe('@pseudopilot/ai-coach');
    expect(PACKAGE_VERSION).toBe('0.1.0');
  });
});

describe('prompt construction', () => {
  it('includes system preamble and structured sections', () => {
    const system = buildSystemPrompt();
    expect(system).toMatch(/Cambridge/);
    expect(system).toMatch(/never claim authority/i);

    const { user } = buildCoachPrompt({
      question: 'Why is N undeclared?',
      context: baseContext({
        semanticDiagnostics: [
          {
            id: '1',
            severity: 'error',
            code: 'C_UNDECL_IDENT',
            message: 'Undeclared identifier N',
            line: 2,
            source: 'semantic',
          },
        ],
      }),
      capability: 'explain_compiler_error',
    });
    expect(user).toContain('## Pseudocode');
    expect(user).toContain('## Semantic diagnostics');
    expect(user).toContain('C_UNDECL_IDENT');
    expect(user).toContain('Why is N undeclared?');
    expect(user).toContain('explain compiler error');
  });

  it('summarises debugger and selection', () => {
    const text = summariseContextForPrompt(
      baseContext({
        selectedText: 'OUTPUT N',
        selectedLanguage: 'pseudocode',
        debugger: {
          ...emptyDebugger(),
          paused: true,
          executionState: 'paused',
          currentLine: 2,
          variables: [
            {
              name: 'N',
              type: 'INTEGER',
              value: '3',
              scope: 'global',
            },
          ],
          callStack: [{ id: 1, name: '<global>', kind: 'global', line: 2 }],
        },
      }),
    );
    expect(text).toContain('## Selected text');
    expect(text).toContain('OUTPUT N');
    expect(text).toContain('paused: true');
    expect(text).toContain('N: INTEGER = 3');
  });
});

describe('provider abstraction', () => {
  it('swaps providers on AICoachService', async () => {
    const calls: string[] = [];
    const a: AIProvider = {
      id: 'a',
      async complete(): Promise<CoachResponse> {
        calls.push('a');
        return {
          ok: true,
          message: 'from-a',
          citations: [],
          providerId: 'a',
          groundedLocally: true,
        };
      },
    };
    const b: AIProvider = {
      id: 'b',
      async complete(): Promise<CoachResponse> {
        calls.push('b');
        return {
          ok: true,
          message: 'from-b',
          citations: [],
          providerId: 'b',
          groundedLocally: false,
        };
      },
    };
    const service = new AICoachService({ provider: a });
    expect(service.getProviderId()).toBe('a');
    await service.ask({ question: 'hi', context: baseContext() });
    service.setProvider(b);
    const res = await service.ask({ question: 'hi', context: baseContext() });
    expect(calls).toEqual(['a', 'b']);
    expect(res.message).toBe('from-b');
  });

  it('maps UnconfiguredAIProvider to a soft failure response', async () => {
    const service = new AICoachService({
      provider: new UnconfiguredAIProvider('openai'),
    });
    const res = await service.ask({
      question: 'Explain DECLARE',
      context: baseContext(),
    });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/not configured/i);
  });
});

describe('HeuristicAIProvider', () => {
  const provider = new HeuristicAIProvider();
  const service = new AICoachService({ provider });

  it('explains undeclared from semantic diagnostics', async () => {
    const res = await service.ask({
      question: 'Why is this variable undeclared?',
      context: baseContext({
        semanticDiagnostics: [
          {
            id: 'd1',
            severity: 'error',
            code: 'C_UNDECL_IDENT',
            message: 'Undeclared identifier Count',
            line: 3,
            help: 'Add DECLARE Count : INTEGER',
            source: 'semantic',
          },
        ],
      }),
      capability: 'explain_compiler_error',
    });
    expect(res.ok).toBe(true);
    expect(res.groundedLocally).toBe(true);
    expect(res.message).toMatch(/C_UNDECL/);
    expect(res.message).toMatch(/DECLARE/);
    expect(res.citations.some((c) => c.code === 'C_UNDECL_IDENT')).toBe(true);
  });

  it('explains runtime errors from debugger context', async () => {
    const res = await service.ask({
      question: 'Why did it crash at runtime?',
      context: baseContext({
        debugger: {
          ...emptyDebugger(),
          executionState: 'runtimeError',
          runtimeErrors: [
            {
              id: 'r1',
              severity: 'error',
              code: 'R_INDEX',
              message: 'Index out of bounds',
              line: 5,
              source: 'runtime',
            },
          ],
        },
      }),
      capability: 'explain_runtime_error',
    });
    expect(res.message).toMatch(/R_INDEX/);
    expect(res.citations[0]?.code).toBe('R_INDEX');
  });

  it('explains selection', async () => {
    const res = await service.ask({
      question: 'What does this mean?',
      context: baseContext({
        selectedText: 'FOR I ← 1 TO 10\n  OUTPUT I\nNEXT I',
        selectedLanguage: 'pseudocode',
      }),
      capability: 'explain_selection',
    });
    expect(res.message).toMatch(/FOR/);
    expect(res.message).toMatch(/counted loop/i);
  });

  it('walks AST summary line-by-line', async () => {
    const res = await service.ask({
      question: 'Explain the algorithm line by line',
      context: baseContext(),
      capability: 'explain_algorithm',
    });
    expect(res.message).toMatch(/DeclareStatement/);
    expect(res.message).toMatch(/OutputStatement/);
  });

  it('compares Pseudocode and Python', async () => {
    const res = await service.ask({
      question: 'Compare the Python translation',
      context: baseContext(),
      capability: 'compare_pseudocode_python',
    });
    expect(res.message).toMatch(/Pseudocode ↔ Python/);
    expect(res.message).toContain('print');
  });

  it('answers Cambridge concept questions', async () => {
    const res = await service.ask({
      question: 'What is a Cambridge ARRAY?',
      context: baseContext(),
      capability: 'explain_cambridge_concept',
    });
    expect(res.message).toMatch(/ARRAY/);
    expect(res.message).toMatch(/9618|inclusive/i);
  });

  it('answers questions about enum, pointer, and set TYPE forms', async () => {
    const res = await service.ask({
      question: 'How do enum, pointer, and set TYPE forms work?',
      context: baseContext(),
      capability: 'explain_cambridge_concept',
    });
    expect(res.message).toMatch(/enum/i);
    expect(res.message).toMatch(/pointer/i);
    expect(res.message).toMatch(/SET OF/i);
    expect(res.message).toMatch(/DEFINE/i);
  });
});

describe('AIContext construction shape', () => {
  it('keeps a clean serialisable surface (no Monaco / IR fields)', () => {
    const ctx = baseContext();
    const keys = Object.keys(ctx).sort();
    expect(keys).toEqual([
      'astSummary',
      'debugger',
      'documentUri',
      'parserDiagnostics',
      'pseudocode',
      'python',
      'selectedLanguage',
      'selectedText',
      'semanticDiagnostics',
      'symbols',
      'translation',
      'translationDiagnostics',
    ]);
    expect(JSON.parse(JSON.stringify(ctx))).toEqual(ctx);
  });
});

describe('CoachRequest prompt capability', () => {
  it('rejects empty questions softly via service', async () => {
    const service = new AICoachService({ provider: new HeuristicAIProvider() });
    const res = await service.ask({
      question: '   ',
      context: baseContext(),
    } satisfies CoachRequest);
    expect(res.ok).toBe(false);
  });
});
