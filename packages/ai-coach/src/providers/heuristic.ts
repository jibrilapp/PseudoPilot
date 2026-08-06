import type {
  AIContext,
  AIDiagnostic,
  CoachCitation,
  CoachRequest,
  CoachResponse,
} from '../context.js';
import type { AIProvider } from '../provider.js';
import { AIProviderError } from '../provider.js';

/**
 * Offline educational coach — answers from structured {@link AIContext}
 * without calling a remote LLM. Suitable for tests and keyless IDE demos.
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

    if (
      capability === 'compare_pseudocode_python' ||
      /\b(compare|python|translation|differ)\b/.test(q)
    ) {
      return this.compare(ctx);
    }

    if (
      capability === 'explain_selection' ||
      (ctx.selectedText &&
        /\b(this|selection|selected|what does)\b/.test(q))
    ) {
      return this.explainSelection(ctx);
    }

    if (
      capability === 'explain_runtime_error' ||
      /\b(runtime|crash|exception|r_)\b/.test(q) ||
      ctx.debugger.runtimeErrors.length > 0 &&
        /\b(error|why|fail)\b/.test(q)
    ) {
      return this.explainRuntime(ctx);
    }

    if (
      capability === 'suggest_fix' ||
      capability === 'explain_compiler_error' ||
      /\b(undeclared|error|diagnostic|fix|c_|e_|why)\b/.test(q)
    ) {
      const explained = this.explainDiagnostics(ctx, q);
      if (explained) return explained;
    }

    if (
      capability === 'explain_algorithm' ||
      /\b(line.?by.?line|algorithm|walk.?through|step)\b/.test(q)
    ) {
      return this.explainAlgorithm(ctx);
    }

    if (
      capability === 'explain_cambridge_concept' ||
      /\b(cambridge|9618|declare|array|procedure|function|for loop|while|case|seek|getrecord|putrecord|openfile|random)\b/.test(
        q,
      )
    ) {
      return this.explainConcept(q);
    }

    // Fall through: prefer diagnostics if present, else general tip.
    const fromDiags = this.explainDiagnostics(ctx, q);
    if (fromDiags) return fromDiags;

    if (ctx.debugger.paused) {
      return this.explainPaused(ctx);
    }

    return {
      ok: true,
      providerId: this.id,
      groundedLocally: true,
      citations: [],
      message: [
        'I can help with Cambridge 9618 Pseudocode using your open file.',
        '',
        'Try asking me to:',
        '• explain a compiler or runtime error',
        '• explain the selected code',
        '• walk through the algorithm line-by-line',
        '• compare Pseudocode with the Python translation',
        '• clarify a syllabus concept (DECLARE, ARRAY, PROCEDURE, …)',
        '',
        ctx.semanticDiagnostics.length + ctx.parserDiagnostics.length > 0
          ? `You currently have ${ctx.semanticDiagnostics.length + ctx.parserDiagnostics.length} compile diagnostic(s) — ask “why is this undeclared?” to start.`
          : 'Your program currently has no compile diagnostics.',
      ].join('\n'),
    };
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

  private explainConcept(question: string): CoachResponse {
    const concepts: Array<{ re: RegExp; title: string; body: string }> = [
      {
        re: /\basc\b|\bchr\b|\bis_num\b/,
        title: 'ASC / CHR / IS_NUM',
        body: 'Paper 2 exam-insert helpers: `ASC(c)` returns the ASCII code of a CHAR; `CHR(n)` returns the CHAR for code `n`; `IS_NUM(s)` is TRUE when `s` (STRING or CHAR) looks like a signed decimal number (e.g. `"-12.36"`).',
      },
      {
        re: /seek|getrecord|putrecord|random file|randomfiles?/,
        title: 'Random files (SEEK / GETRECORD / PUTRECORD)',
        body: 'Cambridge §9.2: `OPENFILE name FOR RANDOM`, then `SEEK name, address` moves the file pointer (INTEGER record number, 0-based: records from the start of the file). `GETRECORD name, variable` reads the record at the pointer into a TYPE variable; `PUTRECORD name, expression` writes/replaces that record. Use with record `TYPE`s (including nested fields and DATE). Not for CLASS objects. Text `READFILE`/`WRITEFILE` require READ/WRITE/APPEND modes instead.',
      },
      {
        re: /openfile|readfile|writefile|closefile|text file/,
        title: 'Text files (OPENFILE / READFILE / WRITEFILE)',
        body: 'Cambridge §9.1: `OPENFILE name FOR READ|WRITE|APPEND`, then `READFILE` / `WRITEFILE` line I/O, `CLOSEFILE`, and `EOF(name)`. WRITE truncates; APPEND extends. Random access uses FOR RANDOM + SEEK/GETRECORD/PUTRECORD (§9.2).',
      },
      {
        re: /declare/,
        title: 'DECLARE',
        body: '`DECLARE name : TYPE` introduces a variable. Types include INTEGER, REAL, STRING, BOOLEAN, CHAR, DATE, ARRAY[l:u] OF T, and user-defined TYPEs such as records, enums, pointers (`^T`), and sets (`SET OF T`). Assignment uses ←, never =.',
      },
      {
        re: /enum|pointer|\^|deref|set of|define\b|\bset\b/,
        title: 'User-defined TYPE forms',
        body: 'Cambridge-style user types can be records (`TYPE Name ... ENDTYPE`), enums (`TYPE Season = (Spring, Summer, Autumn, Winter)`), pointers (`TYPE NodePtr = ^Node` with dereference `Ptr^` and address-of `^Place`), and sets (`TYPE Odds = SET OF INTEGER`, then `DEFINE Evens(2, 4) : Odds`).',
      },
      {
        re: /array/,
        title: 'ARRAY',
        body: 'Fixed-length homogeneous arrays: `DECLARE A : ARRAY[1:10] OF INTEGER`. Indices are inclusive. Cambridge indexing is typically 1-based in teaching examples.',
      },
      {
        re: /procedure|function/,
        title: 'PROCEDURE / FUNCTION',
        body: 'PROCEDURE is a subroutine without a return value (`CALL Name(...)`). FUNCTION returns a value (`RETURNS TYPE`) and is used in expressions. Parameters default to BYVAL (Cambridge §8.3). Use BYREF on PROCEDURE parameters so assignments update the caller\'s variable (e.g. SWAP). Functions must not use BYREF.',
      },
      {
        re: /for loop|for\b/,
        title: 'FOR',
        body: '`FOR i ← 1 TO n` … `NEXT i` counts inclusively. Optional `STEP`. The control variable should be INTEGER.',
      },
      {
        re: /while|repeat/,
        title: 'WHILE / REPEAT',
        body: '`WHILE cond DO` … `ENDWHILE` tests before the body. `REPEAT` … `UNTIL cond` tests after (runs at least once).',
      },
      {
        re: /case/,
        title: 'CASE OF',
        body: '`CASE OF expr` … `OTHERWISE` … `ENDCASE` selects among labels. Prefer CASE for multi-way selection instead of deep IF nesting.',
      },
    ];
    for (const c of concepts) {
      if (c.re.test(question)) {
        return {
          ok: true,
          providerId: this.id,
          groundedLocally: true,
          citations: [{ label: `Cambridge concept: ${c.title}` }],
          message: `**${c.title}** (9618 Pseudocode)\n\n${c.body}`,
        };
      }
    }
    return {
      ok: true,
      providerId: this.id,
      groundedLocally: true,
      citations: [{ label: 'Cambridge 9618' }],
      message:
        'Cambridge 9618 Pseudocode is a teaching language with DECLARE, structured IF/CASE/loops, PROCEDURE/FUNCTION, arrays, text and random files, user-defined TYPEs (records, enums, pointers, sets), CLASS OOP, and Core/insert builtins (LENGTH, MID, INT, ASC, CHR, IS_NUM, DATE helpers, …). Ask about a specific keyword for a focused explanation.',
    };
  }
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
