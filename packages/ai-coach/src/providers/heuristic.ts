import type {
  AIContext,
  AIDiagnostic,
  CoachCitation,
  CoachRequest,
  CoachResponse,
} from '../context.js';
import type { AIProvider } from '../provider.js';
import { AIProviderError } from '../provider.js';
import { formatConceptAnswer, matchConcept } from '../concepts.js';
import {
  answerGeneralProgramming,
  isUnintelligibleQuestion,
} from '../generalProgramming.js';
import { classifyCoachIntent } from '../intent.js';
import { answerProductCapability } from '../productCapabilities.js';

/** Canned non-answer — only for genuinely unintelligible input. */
export const GENERIC_FALLBACK_PHRASE =
  'looks like a general programming question rather than Cambridge 9618 Pseudocode theory or a PseudoPilot product feature';

/**
 * Offline educational coach — answers from structured {@link AIContext}
 * without calling a remote LLM. Suitable for tests and keyless IDE demos.
 *
 * Routing: {@link classifyCoachIntent} runs first. Product capability
 * outranks concept keyword matches so “translate to HTML” never becomes
 * STRING / Cambridge theory.
 *
 * Cambridge theory answers use a fixed tutor structure via
 * {@link formatConceptAnswer} (Direct answer → Explanation → Example → …).
 */
export class HeuristicAIProvider implements AIProvider {
  readonly id = 'heuristic';

  async complete(request: CoachRequest): Promise<CoachResponse> {
    const question = request.question.trim();
    if (!question) {
      throw new AIProviderError('EMPTY_QUESTION', 'Ask a question first.');
    }

    const ctx = request.context;
    const q = question.toLowerCase();
    const capability = request.capability;

    // --- Explicit UI capabilities (quick-action chips) ---
    if (capability === 'compare_pseudocode_python') {
      return this.compare(ctx);
    }
    if (capability === 'explain_selection') {
      return this.explainSelection(ctx);
    }
    if (capability === 'explain_runtime_error') {
      return this.explainRuntime(ctx);
    }
    if (
      capability === 'suggest_fix' ||
      capability === 'explain_compiler_error'
    ) {
      return (
        this.explainDiagnostics(ctx, q) ??
        this.insufficientProjectContext(
          'There are no compiler or translation diagnostics in the current file to explain.',
        )
      );
    }
    if (capability === 'explain_algorithm') {
      return this.explainAlgorithm(ctx);
    }
    if (
      capability === 'explain_cambridge_concept' ||
      capability === 'general_cambridge_qa'
    ) {
      return this.explainConcept(q, question);
    }

    const intent = classifyCoachIntent(question, ctx);

    switch (intent) {
      case 'product_capability': {
        const answer = answerProductCapability(q, question);
        return {
          ok: true,
          providerId: this.id,
          groundedLocally: true,
          citations: answer.citations,
          message: answer.message,
        };
      }
      case 'compiler_runtime_diagnostics': {
        if (
          /\b(runtime|crash|exception)\b/.test(q) ||
          (/\br_\w*\b/.test(q) && /\b(error|fail|crash)\b/.test(q)) ||
          (ctx.debugger.runtimeErrors.length > 0 &&
            /\b(runtime error|crash|exception|why did (it|this) (fail|crash|error))\b/.test(
              q,
            ))
        ) {
          return this.explainRuntime(ctx);
        }
        return (
          this.explainDiagnostics(ctx, q) ??
          this.insufficientProjectContext(
            'There are no compiler or translation diagnostics in the current file to explain.',
          )
        );
      }
      case 'current_code': {
        if (
          ctx.debugger.paused &&
          /\b(paused|current line|where am i|call stack|stack)\b/.test(q)
        ) {
          return this.explainPaused(ctx);
        }
        if (
          /\b(python|pseudocode).{0,30}\b(translation|translate|pane|side)\b/.test(
            q,
          ) ||
          /\b(translation|translate).{0,30}\b(python|pseudocode)\b/.test(q) ||
          /\bcompare\b.{0,40}\b(python|pseudocode|translation|pane|side)\b/.test(
            q,
          ) ||
          /\b(python|pseudocode|translation|pane).{0,40}\b(compare|differ)\b/.test(
            q,
          ) ||
          (/\b(compare|differ)\b/.test(q) &&
            /\b(python|pseudocode|translation|pane|side|editors?)\b/.test(q))
        ) {
          return this.compare(ctx);
        }
        if (
          ctx.selectedText &&
          /\b(this|selection|selected|what does|explain (this|it|the code))\b/.test(
            q,
          )
        ) {
          return this.explainSelection(ctx);
        }
        if (/\b(line.?by.?line|algorithm|walk.?through|step through)\b/.test(q)) {
          return this.explainAlgorithm(ctx);
        }
        const fromDiags = this.explainDiagnosticsIfRelevant(ctx, q);
        if (fromDiags) return fromDiags;
        if (looksLikeProjectSpecificQuestion(q)) {
          const diags = this.explainDiagnostics(ctx, q);
          if (diags) return diags;
          return this.insufficientProjectContext(
            'I do not have enough project context to answer that precisely. Open the relevant Pseudocode, select the code in question, or ask about a Cambridge syllabus concept.',
          );
        }
        if (ctx.selectedText) return this.explainSelection(ctx);
        if (ctx.astSummary.length > 0) return this.explainAlgorithm(ctx);
        return this.insufficientProjectContext(
          'I do not have enough project context to answer that precisely. Open the relevant Pseudocode, select the code in question, or ask about a Cambridge syllabus concept.',
        );
      }
      case 'cambridge_theory': {
        const concept = this.explainConcept(q, question);
        return enrichWithRelevantDiagnostics(concept, ctx, q);
      }
      case 'general_programming':
      default:
        return this.generalProgramming(q, question);
    }
  }

  private generalProgramming(
    questionLower: string,
    originalQuestion: string,
  ): CoachResponse {
    // Classification only routes here — always attempt a real answer first.
    const answered = answerGeneralProgramming(questionLower, originalQuestion);
    if (answered) {
      return {
        ok: true,
        providerId: this.id,
        groundedLocally: true,
        citations: [...answered.citations],
        message: answered.message,
      };
    }

    // True fallback — only when the answerer found nothing AND the input is
    // unintelligible (gibberish / empty noise). Never stop at classification.
    if (!isUnintelligibleQuestion(originalQuestion)) {
      return {
        ok: true,
        providerId: this.id,
        groundedLocally: true,
        citations: [{ label: 'General CS' }],
        message: [
          `**Direct answer**`,
          `I can help with “${originalQuestion.trim()}” as a general programming question.`,
          '',
          'Pick one concrete operation and try a tiny Cambridge Pseudocode sketch:',
          '```pseudocode',
          'DECLARE Value : INTEGER',
          'Value ← 0',
          'OUTPUT Value',
          '```',
          '',
          'Ask “How do I add two variables?”, “How do I use a FOR loop?”, or a named 9618 concept for a fuller offline card.',
        ].join('\n'),
      };
    }

    return {
      ok: true,
      providerId: this.id,
      groundedLocally: true,
      citations: [{ label: 'PseudoPilot coach' }],
      message: [
        `“${originalQuestion.trim()}” ${GENERIC_FALLBACK_PHRASE}.`,
        '',
        'Ask about a syllabus concept (BYREF, recursion, DIV, TYPE vs CLASS), a product capability (translate targets, debug, offline), a general CS topic (HTML, Git, JSON, …), or select code in the editor for a grounded explanation.',
      ].join('\n'),
    };
  }

  private insufficientProjectContext(message: string): CoachResponse {
    return {
      ok: true,
      providerId: this.id,
      groundedLocally: true,
      citations: [],
      message,
    };
  }

  /** Diagnostics only when the question mentions them or an identifier in them. */
  private explainDiagnosticsIfRelevant(
    ctx: AIContext,
    question: string,
  ): CoachResponse | null {
    const all = [
      ...ctx.parserDiagnostics,
      ...ctx.semanticDiagnostics,
      ...ctx.translationDiagnostics,
    ];
    if (all.length === 0) return null;
    if (!/\b(error|diagnostic|undeclar|fix|why.*(fail|wrong|error|undeclar))\b/.test(question)) {
      return null;
    }
    return this.explainDiagnostics(ctx, question);
  }

  private explainDiagnostics(
    ctx: AIContext,
    question: string,
  ): CoachResponse | null {
    const all = [
      ...ctx.parserDiagnostics,
      ...ctx.semanticDiagnostics,
      ...ctx.translationDiagnostics,
    ];
    if (all.length === 0) return null;

    const undeclared = all.find((d) =>
      /UNDECL|undeclar/i.test(d.code + d.message),
    );
    if (undeclared && /undeclar|variable|why/.test(question)) {
      return {
        ok: true,
        providerId: this.id,
        groundedLocally: true,
        citations: [cite(undeclared)],
        message: [
          `**${undeclared.code}** — ${undeclared.message}`,
          undeclared.line != null ? `Location: line ${undeclared.line}.` : '',
          '',
          'In Cambridge Pseudocode every variable must be introduced with `DECLARE` (or as a PARAMETER / FOR control variable) before you use it.',
          '',
          'Suggested fix:',
          '1. Add `DECLARE Name : TYPE` near the top of the program (or inside the procedure).',
          '2. Choose a type: `INTEGER`, `REAL`, `STRING`, `BOOLEAN`, `CHAR`, `DATE`, `ARRAY[…] OF …`, or a user-defined `TYPE` such as a record, enum, pointer, or set.',
          '3. Then assign with `←` (or `<-`).',
          undeclared.help ? `\nChecker hint: ${undeclared.help}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      };
    }

    const primary = all[0]!;
    return {
      ok: true,
      providerId: this.id,
      groundedLocally: true,
      citations: all.slice(0, 5).map(cite),
      message: [
        `I see ${all.length} diagnostic(s). Focusing on **${primary.code}**:`,
        primary.message,
        primary.line != null ? `At line ${primary.line}.` : '',
        primary.help ? `Hint: ${primary.help}` : '',
        '',
        'Ask about a specific code (e.g. “explain C_UNDECLARED”) for a deeper walkthrough.',
        capabilityFixHint(primary),
      ]
        .filter(Boolean)
        .join('\n'),
    };
  }

  private explainRuntime(ctx: AIContext): CoachResponse {
    const errs = ctx.debugger.runtimeErrors;
    if (errs.length === 0) {
      return {
        ok: true,
        providerId: this.id,
        groundedLocally: true,
        citations: [],
        message:
          'There is no runtime error in the current debugger snapshot. Run the program or step until an `R_*` diagnostic appears.',
      };
    }
    const e = errs[0]!;
    return {
      ok: true,
      providerId: this.id,
      groundedLocally: true,
      citations: errs.slice(0, 5).map(cite),
      message: [
        `**Runtime ${e.code}** — ${e.message}`,
        e.line != null ? `Paused / reported near line ${e.line}.` : '',
        e.help ? `Hint: ${e.help}` : '',
        '',
        ctx.debugger.paused
          ? `Debugger is paused${ctx.debugger.currentLine != null ? ` at line ${ctx.debugger.currentLine}` : ''}. Inspect Variables and the call stack in the Debug panel.`
          : 'Use breakpoints and Step Into to see the values that led to this error.',
      ]
        .filter(Boolean)
        .join('\n'),
    };
  }

  private explainSelection(ctx: AIContext): CoachResponse {
    if (!ctx.selectedText?.trim()) {
      return {
        ok: true,
        providerId: this.id,
        groundedLocally: true,
        citations: [],
        message:
          'Select some Pseudocode or Python in the editor, then ask me to explain it.',
      };
    }
    const text = ctx.selectedText.trim();
    const lang = ctx.selectedLanguage ?? 'pseudocode';
    return {
      ok: true,
      providerId: this.id,
      groundedLocally: true,
      citations: [{ label: 'selection' }],
      message: [
        `Selected ${lang} (${text.split('\n').length} line(s)):`,
        '```',
        text.length > 800 ? `${text.slice(0, 800)}\n…` : text,
        '```',
        '',
        summariseSnippet(text, lang),
      ].join('\n'),
    };
  }

  private explainAlgorithm(ctx: AIContext): CoachResponse {
    if (ctx.astSummary.length === 0) {
      return {
        ok: true,
        providerId: this.id,
        groundedLocally: true,
        citations: [],
        message:
          'I do not have an AST summary yet (parse may have failed). Fix parser diagnostics first, then ask again.',
      };
    }
    const steps = ctx.astSummary.slice(0, 25).map((n, i) => {
      const loc = n.line != null ? ` (line ${n.line})` : '';
      const detail = n.detail ? `: ${n.detail}` : '';
      return `${i + 1}. **${n.kind}**${loc}${detail}`;
    });
    return {
      ok: true,
      providerId: this.id,
      groundedLocally: true,
      citations: ctx.astSummary
        .filter((n) => n.line != null)
        .slice(0, 8)
        .map((n) => ({ line: n.line!, label: n.kind })),
      message: [
        'Line-by-line outline from the structured AST summary:',
        '',
        ...steps,
        '',
        'This outline comes from the compiler AST — not an invented walkthrough.',
      ].join('\n'),
    };
  }

  private compare(ctx: AIContext): CoachResponse {
    return {
      ok: true,
      providerId: this.id,
      groundedLocally: true,
      citations: [],
      message: [
        '**Pseudocode ↔ Python**',
        '',
        `Translation status: **${ctx.translation.status}**` +
          (ctx.translation.errorSide
            ? ` (last error on ${ctx.translation.errorSide})`
            : ''),
        '',
        'Pseudocode (head):',
        '```',
        head(ctx.pseudocode, 12),
        '```',
        'Python (head):',
        '```',
        head(ctx.python, 12),
        '```',
        '',
        ctx.translationDiagnostics.length > 0
          ? `Translation diagnostics: ${ctx.translationDiagnostics.map((d) => d.code).join(', ')}.`
          : 'No translation diagnostics right now.',
        '',
        'Remember: Run/Debug always executes Pseudocode. Python is a teaching translation.',
      ].join('\n'),
    };
  }

  private explainPaused(ctx: AIContext): CoachResponse {
    const vars = ctx.debugger.variables
      .slice(0, 10)
      .map((v) => `- ${v.name} (${v.type}) = ${v.value}`)
      .join('\n');
    return {
      ok: true,
      providerId: this.id,
      groundedLocally: true,
      citations:
        ctx.debugger.currentLine != null
          ? [{ line: ctx.debugger.currentLine, label: 'pause location' }]
          : [],
      message: [
        `Execution is **paused**${ctx.debugger.currentLine != null ? ` at line ${ctx.debugger.currentLine}` : ''}.`,
        ctx.debugger.frameName
          ? `Frame: ${ctx.debugger.frameName}`
          : '',
        vars ? `Variables:\n${vars}` : 'No bindings in the current snapshot.',
        '',
        'Ask “explain this line” after selecting the paused statement, or continue stepping.',
      ]
        .filter(Boolean)
        .join('\n'),
    };
  }

  private explainConcept(
    questionLower: string,
    originalQuestion: string,
  ): CoachResponse {
    const matched = matchConcept(questionLower);
    if (matched) {
      return {
        ok: true,
        providerId: this.id,
        groundedLocally: true,
        citations: [{ label: `Cambridge concept: ${matched.title}` }],
        message: formatConceptAnswer(matched),
      };
    }
    return {
      ok: true,
      providerId: this.id,
      groundedLocally: true,
      citations: [{ label: 'Cambridge 9618' }],
      message: [
        '**Direct answer**',
        `I am not sure which 9618 topic you mean by “${originalQuestion.trim()}”. Ask about one concept — for example BYREF, recursion, DIV, TYPE vs CLASS, or FUNCTION vs PROCEDURE — and I will teach it step by step.`,
        '',
        '**Explanation**',
        'I tutor Cambridge Pseudocode with a short direct answer, a plain explanation, a small example, and a common mistake. I only discuss compiler diagnostics when your question is about your code or an error.',
      ].join('\n'),
    };
  }
}

function looksLikeProjectSpecificQuestion(q: string): boolean {
  return /\b(my (code|program|variable|error|file)|this (line|variable|procedure|function|error)|why (is|does|did) (my|this)|in (my|this) (code|program)|what('s| is) wrong|wrong with my)\b/.test(
    q,
  );
}

function enrichWithRelevantDiagnostics(
  response: CoachResponse,
  ctx: AIContext,
  question: string,
): CoachResponse {
  const all = [
    ...ctx.parserDiagnostics,
    ...ctx.semanticDiagnostics,
    ...ctx.translationDiagnostics,
  ];
  if (all.length === 0) return response;
  // Only append when the question also touches errors, or a diagnostic code appears.
  if (
    !/\b(error|undeclar|diagnostic|fix)\b/.test(question) &&
    !all.some((d) => question.toUpperCase().includes(d.code.toUpperCase()))
  ) {
    return response;
  }
  const primary = all[0]!;
  return {
    ...response,
    citations: [
      ...response.citations,
      ...all.slice(0, 3).map(cite),
    ],
    message: [
      response.message,
      '',
      `Related diagnostic in your file: **${primary.code}** — ${primary.message}` +
        (primary.line != null ? ` (line ${primary.line})` : '') +
        '.',
    ].join('\n'),
  };
}

function cite(d: AIDiagnostic): CoachCitation {
  return {
    code: d.code,
    label: d.code,
    ...(d.line != null ? { line: d.line } : {}),
  };
}

function capabilityFixHint(d: AIDiagnostic): string {
  if (/ASSIGN|TYPE/i.test(d.code)) {
    return 'Check that the value’s type matches the DECLARE’d type (INTEGER vs REAL, CHAR vs STRING).';
  }
  if (/INDEX|BOUND|ARRAY/i.test(d.code)) {
    return 'Confirm array bounds and that you index with the declared dimensionality.';
  }
  return 'Use the diagnostic code in the Console for the exact checker message.';
}

function summariseSnippet(text: string, lang: string): string {
  const upper = text.toUpperCase();
  if (lang === 'python') {
    return 'This is Python produced or edited beside Pseudocode. Changes reverse-translate into Pseudocode when valid; Run still uses Pseudocode.';
  }
  if (/\bDECLARE\b/.test(upper)) {
    return 'This declares storage. After DECLARE, assign with ← before you OUTPUT or use the name in expressions.';
  }
  if (/\bFOR\b/.test(upper)) {
    return 'This is a counted loop. The body repeats from the start value TO the end value (inclusive), optionally with STEP.';
  }
  if (/\bIF\b/.test(upper)) {
    return 'This is selection. Conditions use relational operators (`=`, `<>`, `<`, …) and logical `AND` / `OR` / `NOT`.';
  }
  if (/\bPROCEDURE\b|\bFUNCTION\b/.test(upper)) {
    return 'This defines a routine. PROCEDURE is invoked with CALL; FUNCTION returns a value used in expressions.';
  }
  return 'Relate this snippet to nearby DECLARE / control-flow. I can also walk the full AST summary if you ask for a line-by-line explanation.';
}

function head(text: string, maxLines: number): string {
  const lines = text.split('\n');
  if (lines.length <= maxLines) return text || '(empty)';
  return `${lines.slice(0, maxLines).join('\n')}\n…`;
}
