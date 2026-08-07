import { describe, expect, it } from 'vitest';
import {
  AICoachService,
  HeuristicAIProvider,
  UnconfiguredAIProvider,
  buildCoachPrompt,
  buildSystemPrompt,
  classifyCoachIntent,
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
    expect(PACKAGE_VERSION).toBe('1.0.0-beta.0');
  });
});

describe('prompt construction', () => {
  it('includes system preamble and structured sections', () => {
    const system = buildSystemPrompt();
    expect(system).toMatch(/Cambridge/);
    expect(system).toMatch(/never claim authority/i);
    expect(system).toMatch(/Direct answer/i);
    expect(system).toMatch(/patient Cambridge/i);
    expect(system).toMatch(/product_capability/);
    expect(system).toMatch(/Pseudocode ↔ Python only/);

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
    expect(res.message).toMatch(/\*\*Direct answer\*\*/);
    expect(res.message).toMatch(/```pseudocode/);
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
    expect(res.message).toMatch(/\*\*Direct answer\*\*/);
  });

  describe('Cambridge tutor response structure', () => {
    const placeholder =
      /I can help with Cambridge 9618 Pseudocode using your open file|I can give a full syllabus-style explanation/;

    const tutorSections = [
      /\*\*Direct answer\*\*/,
      /\*\*Explanation\*\*/,
      /\*\*Example\*\*/,
      /\*\*Common mistake\*\*/,
    ];

    const theoryPrompts: Array<{
      question: string;
      mustMatch: RegExp[];
      mustNotMatch?: RegExp[];
    }> = [
      {
        question: 'How do I change a variable inside a procedure?',
        mustMatch: [/BYREF/, /BYVAL|copy/i, /Increment|N ← N \+ 1/],
      },
      {
        question: 'Why use BYREF?',
        mustMatch: [/BYREF/, /caller|alias|in-place|update/i],
      },
      {
        question: 'Explain recursion.',
        mustMatch: [/recursion/i, /base case/i, /calls itself|Factorial/i],
      },
      {
        question: 'What is DIV?',
        mustMatch: [/\bDIV\b/, /quotient|integer division/i],
      },
      {
        question: 'Difference between TYPE and CLASS.',
        mustMatch: [/\bTYPE\b/, /\bCLASS\b/, /record|object|OOP|blueprint/i],
      },
      {
        question: 'When should I use a function instead of a procedure?',
        mustMatch: [
          /\bFUNCTION\b/,
          /\bPROCEDURE\b/,
          /return|RETURNS|expression/i,
        ],
      },
      {
        question: 'Why use BYREF instead of BYVAL?',
        mustMatch: [/BYREF/, /BYVAL/, /alias|copy|caller/i],
      },
      {
        question: 'What is recursion?',
        mustMatch: [/recursion/i, /base case/i, /calls itself/i],
      },
      {
        question: 'Explain DIV vs MOD.',
        mustMatch: [/\bDIV\b/, /\bMOD\b/, /quotient|remainder/i],
      },
      {
        question: 'What is the difference between TYPE and CLASS?',
        mustMatch: [/\bTYPE\b/, /\bCLASS\b/, /record|object|OOP/i],
      },
      {
        question: 'Explain binary search.',
        mustMatch: [/binary search|sorted/i, /Low|High|Mid/i],
      },
      {
        question: 'How does RAND work?',
        mustMatch: [/\bRAND\b/, /random/i, /REAL/i],
      },
    ];

    for (const { question, mustMatch, mustNotMatch = [] } of theoryPrompts) {
      it(`tutors: ${question}`, async () => {
        const res = await service.ask({
          question,
          context: baseContext(),
        });
        expect(res.ok).toBe(true);
        expect(res.message).not.toMatch(placeholder);
        expect(res.message).toMatch(/```pseudocode/);
        expect(res.message.length).toBeGreaterThan(120);
        for (const section of tutorSections) {
          expect(res.message).toMatch(section);
        }
        for (const re of mustMatch) {
          expect(res.message).toMatch(re);
        }
        for (const re of mustNotMatch) {
          expect(res.message).not.toMatch(re);
        }
      });
    }

    it('does not let unrelated diagnostics replace a theory answer', async () => {
      const res = await service.ask({
        question: 'Why use BYREF instead of BYVAL?',
        context: baseContext({
          semanticDiagnostics: [
            {
              id: 'd1',
              severity: 'error',
              code: 'C_UNDECL_IDENT',
              message: 'Undeclared identifier Count',
              line: 3,
              source: 'semantic',
            },
          ],
        }),
      });
      expect(res.message).toMatch(/BYREF/);
      expect(res.message).toMatch(/BYVAL/);
      expect(res.message).not.toMatch(placeholder);
      expect(res.message).not.toMatch(/C_UNDECL_IDENT/);
      expect(res.message).not.toMatch(/I see \d+ diagnostic/);
    });

    it('still explains undeclared when the question is about that error', async () => {
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
      });
      expect(res.message).toMatch(/C_UNDECL/);
      expect(res.message).toMatch(/DECLARE/);
    });

    it('admits missing project context only for project-specific questions', async () => {
      const res = await service.ask({
        question: 'What is wrong with my program on line 12?',
        context: baseContext({
          pseudocode: '',
          python: '',
          symbols: [],
          astSummary: [],
        }),
      });
      expect(res.message).toMatch(/enough project context|enough context/i);
      expect(res.message).not.toMatch(placeholder);
    });
  });

  describe('product capability intent', () => {
    const placeholder =
      /I can help with Cambridge 9618 Pseudocode using your open file|I can give a full syllabus-style explanation/;

    const tutorForced =
      /\*\*Direct answer\*\*[\s\S]*\*\*Explanation\*\*[\s\S]*\*\*Example\*\*[\s\S]*\*\*Common mistake\*\*/;

    const productPrompts: Array<{
      question: string;
      mustMatch: RegExp[];
      mustNotMatch?: RegExp[];
    }> = [
      {
        question: 'Can I translate to HTML?',
        mustMatch: [
          /not|no/i,
          /HTML/i,
          /Pseudocode\s*↔\s*Python|Pseudocode.*Python/i,
        ],
        mustNotMatch: [/LENGTH|MID\(|STRING routines/i],
      },
      {
        question: 'Does PseudoPilot support Java?',
        mustMatch: [/not|no/i, /Java/i, /Python|Pseudocode/i],
      },
      {
        question: 'Can I export to C++?',
        mustMatch: [/not|no/i, /C\+\+/i, /Python|Pseudocode/i],
      },
      {
        question: 'Does PseudoPilot support SQL?',
        mustMatch: [/not|no/i, /SQL/i, /Python|Pseudocode/i],
      },
    ];

    for (const { question, mustMatch, mustNotMatch = [] } of productPrompts) {
      it(`answers product question: ${question}`, async () => {
        expect(classifyCoachIntent(question)).toBe('product_capability');
        const res = await service.ask({
          question,
          context: baseContext(),
        });
        expect(res.ok).toBe(true);
        expect(res.message).not.toMatch(placeholder);
        expect(res.message).not.toMatch(tutorForced);
        expect(res.message).not.toMatch(/not sure which 9618 topic/i);
        for (const re of mustMatch) {
          expect(res.message).toMatch(re);
        }
        for (const re of mustNotMatch) {
          expect(res.message).not.toMatch(re);
        }
      });
    }

    it('classifies theory prompts as cambridge_theory', () => {
      expect(classifyCoachIntent('Why use BYREF?')).toBe('cambridge_theory');
      expect(classifyCoachIntent('Explain recursion.')).toBe(
        'cambridge_theory',
      );
    });
  });

  describe('general programming answers (no shrug fallback)', () => {
    const genericFallback =
      /looks like a general programming question rather than Cambridge 9618 Pseudocode theory or a PseudoPilot product feature/;

    const cases: Array<{
      question: string;
      intent: ReturnType<typeof classifyCoachIntent>;
      mustMatch: RegExp[];
    }> = [
      {
        question: 'Can I write HTML here?',
        intent: 'product_capability',
        mustMatch: [
          /not|no/i,
          /HTML/i,
          /Pseudocode|Python/i,
        ],
      },
      {
        question: 'What is HTML?',
        intent: 'general_programming',
        mustMatch: [/HyperText Markup Language|HTML/i, /tag/i],
      },
      {
        question: 'Can Python generate HTML?',
        intent: 'general_programming',
        mustMatch: [/yes/i, /Python/i, /HTML/i],
      },
      {
        question: 'What is JavaScript?',
        intent: 'general_programming',
        mustMatch: [/JavaScript/i, /browser|Node/i],
      },
      {
        question: 'What is Git?',
        intent: 'general_programming',
        mustMatch: [/version[- ]control|Git/i, /commit/i],
      },
      {
        question: 'Can I translate to HTML?',
        intent: 'product_capability',
        mustMatch: [
          /not|no/i,
          /HTML/i,
          /Pseudocode\s*↔\s*Python|Pseudocode.*Python/i,
        ],
      },
    ];

    for (const { question, intent, mustMatch } of cases) {
      it(`answers: ${question}`, async () => {
        expect(classifyCoachIntent(question)).toBe(intent);
        const res = await service.ask({
          question,
          context: baseContext(),
        });
        expect(res.ok).toBe(true);
        expect(res.message).not.toMatch(genericFallback);
        expect(res.message.length).toBeGreaterThan(40);
        for (const re of mustMatch) {
          expect(res.message).toMatch(re);
        }
      });
    }

    it('keeps OOP / recursion-in-Python out of Cambridge tutor template', async () => {
      expect(classifyCoachIntent('What is OOP?')).toBe('general_programming');
      expect(classifyCoachIntent('What is recursion in Python?')).toBe(
        'general_programming',
      );
      const oop = await service.ask({
        question: 'What is OOP?',
        context: baseContext(),
      });
      expect(oop.message).not.toMatch(genericFallback);
      expect(oop.message).toMatch(/object-oriented|OOP/i);
      expect(oop.message).not.toMatch(
        /\*\*Direct answer\*\*[\s\S]*\*\*Example\*\*[\s\S]*```pseudocode/,
      );

      const rec = await service.ask({
        question: 'What is recursion in Python?',
        context: baseContext(),
      });
      expect(rec.message).not.toMatch(genericFallback);
      expect(rec.message).toMatch(/recursion|factorial/i);
      expect(rec.message).toMatch(/python/i);
    });

    const codingHowTos: Array<{
      question: string;
      mustMatch: RegExp[];
    }> = [
      {
        question: 'How do I add 2 variables together?',
        mustMatch: [/\+|add/i, /DECLARE|←|Total|A \+ B/i, /```/],
      },
      {
        question: 'How do I multiply numbers?',
        mustMatch: [/\*|multipl/i, /DECLARE|Product|←/i, /```/],
      },
      {
        question: 'How do I concatenate strings?',
        mustMatch: [/&|concatenat|join/i, /STRING|DECLARE/i, /```/],
      },
      {
        question: 'How do I compare two values?',
        mustMatch: [/>|compar|BOOLEAN|IF /i, /DECLARE|ENDIF/i, /```/],
      },
      {
        question: 'How do I call a procedure?',
        mustMatch: [/\bCALL\b/, /PROCEDURE/i, /```/],
      },
      {
        question: 'How do I return a value from a function?',
        mustMatch: [/\bRETURN\b/, /FUNCTION|RETURNS/i, /```/],
      },
      {
        question: 'How do I create an array?',
        mustMatch: [/ARRAY/i, /DECLARE/i, /```/],
      },
      {
        question: 'How do I use a FOR loop?',
        mustMatch: [/\bFOR\b/, /\bNEXT\b|\bTO\b/, /```/],
      },
    ];

    for (const { question, mustMatch } of codingHowTos) {
      it(`answers coding how-to (no shrug): ${question}`, async () => {
        expect(classifyCoachIntent(question)).toBe('general_programming');
        const res = await service.ask({
          question,
          context: baseContext(),
        });
        expect(res.ok).toBe(true);
        expect(res.message).not.toMatch(genericFallback);
        expect(res.message.length).toBeGreaterThan(60);
        expect(res.message).toMatch(/pseudocode|DECLARE|CALL|FOR|RETURN|\+|←/i);
        for (const re of mustMatch) {
          expect(res.message).toMatch(re);
        }
      });
    }

    it('still routes BYREF how-tos to Cambridge theory', () => {
      expect(
        classifyCoachIntent('How do I change a variable inside a procedure?'),
      ).toBe('cambridge_theory');
    });
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
