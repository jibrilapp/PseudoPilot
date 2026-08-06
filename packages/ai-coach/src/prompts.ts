import type { AIContext, CoachRequest } from './context.js';

const SYSTEM_PREAMBLE = `You are PseudoPilot AI Coach — an educational assistant for Cambridge International AS & A Level Computer Science (9618) Pseudocode.

Rules:
- Explain concepts, diagnostics, and algorithms clearly for students.
- Prefer teaching over writing full solutions; do not invent runtime results.
- Ground answers in the structured CONTEXT (diagnostics, symbols, debugger).
- Cite diagnostic codes (C_*, E_*, T_*, R_*) when relevant.
- Pseudocode is the source of truth for Run/Debug; Python is a translation.
- Never claim authority over the interpreter or translator.`;

/**
 * Build the text prompt sent to an {@link AIProvider}.
 * Kept pure for unit testing — no I/O.
 */
export function buildSystemPrompt(): string {
  return SYSTEM_PREAMBLE;
}

export function summariseContextForPrompt(ctx: AIContext): string {
  const lines: string[] = [];
  lines.push('## Pseudocode');
  lines.push(truncate(ctx.pseudocode, 4_000) || '(empty)');
  lines.push('');
  lines.push('## Python translation');
  lines.push(truncate(ctx.python, 4_000) || '(empty)');
  lines.push('');
  lines.push(
    `## Translation status: ${ctx.translation.status}` +
      (ctx.translation.errorSide
        ? ` (error side: ${ctx.translation.errorSide})`
        : ''),
  );

  lines.push('');
  lines.push('## Parser diagnostics');
  lines.push(formatDiags(ctx.parserDiagnostics));
  lines.push('');
  lines.push('## Semantic diagnostics');
  lines.push(formatDiags(ctx.semanticDiagnostics));
  lines.push('');
  lines.push('## Translation diagnostics');
  lines.push(formatDiags(ctx.translationDiagnostics));

  lines.push('');
  lines.push('## Symbols');
  if (ctx.symbols.length === 0) lines.push('(none)');
  else {
    for (const s of ctx.symbols.slice(0, 40)) {
      lines.push(
        `- ${s.kind} ${s.name}: ${s.type}` +
          (s.line != null ? ` @L${s.line}` : '') +
          (s.builtin ? ' (builtin)' : ''),
      );
    }
  }

  lines.push('');
  lines.push('## AST summary');
  if (ctx.astSummary.length === 0) lines.push('(none)');
  else {
    for (const n of ctx.astSummary.slice(0, 60)) {
      lines.push(
        `- ${n.kind}` +
          (n.line != null ? ` @L${n.line}` : '') +
          (n.detail ? ` — ${n.detail}` : ''),
      );
    }
  }

  const d = ctx.debugger;
  lines.push('');
  lines.push('## Debugger / runtime');
  lines.push(`state: ${d.executionState}; paused: ${d.paused}`);
  if (d.currentLine != null) {
    lines.push(
      `current line: ${d.currentLine}` +
        (d.currentColumn != null ? `:${d.currentColumn}` : ''),
    );
  }
  if (d.frameName) lines.push(`frame: ${d.frameName}`);
  if (d.callStack.length > 0) {
    lines.push('call stack:');
    for (const f of d.callStack.slice(0, 12)) {
      lines.push(
        `  - ${f.kind} ${f.name}` + (f.line != null ? ` @L${f.line}` : ''),
      );
    }
  }
  if (d.variables.length > 0) {
    lines.push('variables:');
    for (const v of d.variables.slice(0, 30)) {
      lines.push(`  - ${v.name}: ${v.type} = ${v.value} (${v.scope})`);
    }
  }
  lines.push('runtime errors:');
  lines.push(formatDiags(d.runtimeErrors));

  if (ctx.selectedText) {
    lines.push('');
    lines.push(
      `## Selected text (${ctx.selectedLanguage ?? 'unknown'})`,
    );
    lines.push(truncate(ctx.selectedText, 1_500));
  }

  return lines.join('\n');
}

export function buildCoachPrompt(request: CoachRequest): {
  readonly system: string;
  readonly user: string;
} {
  const capability =
    request.capability != null
      ? `\nRequested focus: ${request.capability.replace(/_/g, ' ')}\n`
      : '';
  return {
    system: buildSystemPrompt(),
    user:
      summariseContextForPrompt(request.context) +
      '\n\n## Student question\n' +
      request.question.trim() +
      capability,
  };
}

function formatDiags(
  diags: readonly {
    readonly code: string;
    readonly severity: string;
    readonly message: string;
    readonly line?: number;
    readonly help?: string;
  }[],
): string {
  if (diags.length === 0) return '(none)';
  return diags
    .slice(0, 25)
    .map((d) => {
      const loc = d.line != null ? ` L${d.line}` : '';
      const help = d.help ? ` — ${d.help}` : '';
      return `- [${d.severity}] ${d.code}${loc}: ${d.message}${help}`;
    })
    .join('\n');
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n… [truncated ${text.length - max} chars]`;
}
