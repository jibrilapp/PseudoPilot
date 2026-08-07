/**
 * Accurate PseudoPilot product capability answers.
 * Do not invent features — keep this in sync with the IDE.
 */

export type ProductCapabilityAnswer = {
  readonly message: string;
  readonly citations: readonly { readonly label: string }[];
};

/**
 * Grounded facts about what PseudoPilot actually does.
 * Heuristic coach is local; a future remote LLM provider would need network.
 */
export const PRODUCT_FACTS = {
  dialect: 'Cambridge International AS & A Level Computer Science (9618) Pseudocode',
  translation:
    'Live bidirectional translation between Pseudocode and Python only — not HTML, Java, C++, SQL, or other languages.',
  debug:
    'The debugger runs the Pseudocode interpreter (breakpoints, step, variables, call stack). It does not debug the Python pane; Python is a teaching translation. Run/Debug always executes Pseudocode.',
  exportPdf: 'PseudoPilot does not export or download answers as PDF.',
  offline:
    'Parse, run, live Pseudocode ↔ Python translation, and the default Heuristic AI Coach work offline in the browser. If you switch to a remote LLM provider later, that path needs network access.',
} as const;

const UNSUPPORTED_TARGET =
  /\b(html|css|javascript|typescript|java|cpp|c#|csharp|sql|rust|golang|ruby|php|swift|kotlin|matlab|assembly|wasm|docx|xml|json|yaml|markdown)\b|c\+\+/i;

/**
 * Build a direct product answer from the student's wording.
 */
export function answerProductCapability(
  questionLower: string,
  originalQuestion: string,
): ProductCapabilityAnswer {
  const q = questionLower;
  const citations = [{ label: 'PseudoPilot product' }];

  if (/\bpdf\b/.test(q) && /\b(export|download|save|print|support|available|can)\b/.test(q)) {
    return {
      citations,
      message: [
        '**No — PseudoPilot does not export to PDF.**',
        '',
        PRODUCT_FACTS.exportPdf,
        'You can copy code from the editors or use your browser’s print dialog if you need a printable page, but there is no built-in PDF export.',
      ].join('\n'),
    };
  }

  if (/\b(offline|without\s+(an?\s+)?(internet|network|connection)|no\s+internet)\b/.test(q)) {
    return {
      citations,
      message: [
        '**Most of PseudoPilot works offline.**',
        '',
        PRODUCT_FACTS.offline,
      ].join('\n'),
    };
  }

  if (
    /\bdebug\b/.test(q) &&
    /\bpython\b/.test(q)
  ) {
    return {
      citations,
      message: [
        '**No — you cannot debug Python in PseudoPilot.**',
        '',
        PRODUCT_FACTS.debug,
        '',
        `Language dialect: ${PRODUCT_FACTS.dialect}.`,
      ].join('\n'),
    };
  }

  if (
    /\b(translate|export|convert|compile)\s+to\b/.test(q) ||
    (/\bsupport(s|ed)?\b/.test(q) && LANGUAGE_HINT.test(q)) ||
    (/\b(translate|export|convert)\b/.test(q) && UNSUPPORTED_TARGET.test(q))
  ) {
    const target = extractTargetLabel(originalQuestion) ?? 'that target';
    const wantsPython =
      /\bpython\b/.test(q) && !UNSUPPORTED_TARGET.test(q);
    const wantsPseudo =
      /\b(pseudocode|pseudo[- ]?code)\b/.test(q) && !UNSUPPORTED_TARGET.test(q);

    if (wantsPython || wantsPseudo) {
      return {
        citations,
        message: [
          wantsPython
            ? '**Yes — PseudoPilot translates Pseudocode ↔ Python.**'
            : '**Yes — PseudoPilot’s source language is Cambridge Pseudocode, with a live Python companion pane.**',
          '',
          PRODUCT_FACTS.translation,
          '',
          PRODUCT_FACTS.debug,
        ].join('\n'),
      };
    }

    return {
      citations,
      message: [
        /\bsupport(s|ed)?\b/.test(q)
          ? `**No — PseudoPilot does not support ${target}.**`
          : `**No — PseudoPilot does not translate or export to ${target}.**`,
        '',
        PRODUCT_FACTS.translation,
        '',
        `The editors speak ${PRODUCT_FACTS.dialect} on the left and a Python teaching translation on the right.`,
        PRODUCT_FACTS.debug,
      ].join('\n'),
    };
  }

  // "Can I write / use / edit HTML here?" — language not offered as an editor.
  if (
    UNSUPPORTED_TARGET.test(q) &&
    /\b(write|use|edit|code|author|open|create|run|debug)\b/.test(q)
  ) {
    const target = extractWriteTargetLabel(originalQuestion) ?? 'that language';
    return {
      citations,
      message: [
        `**No — PseudoPilot is not a ${target} editor.**`,
        '',
        `PseudoPilot is built for ${PRODUCT_FACTS.dialect} with a live Python teaching translation.`,
        PRODUCT_FACTS.translation,
        '',
        PRODUCT_FACTS.debug,
      ].join('\n'),
    };
  }

  // Generic PseudoPilot / feature inventory
  return {
    citations,
    message: [
      '**PseudoPilot product capabilities**',
      '',
      `- **Language:** ${PRODUCT_FACTS.dialect}`,
      `- **Translation:** ${PRODUCT_FACTS.translation}`,
      `- **Debug / Run:** ${PRODUCT_FACTS.debug}`,
      `- **PDF export:** ${PRODUCT_FACTS.exportPdf}`,
      `- **Offline:** ${PRODUCT_FACTS.offline}`,
      '',
      `Asked: “${originalQuestion.trim()}” — if you meant a specific feature, ask about translate, debug, export, or offline support.`,
    ].join('\n'),
  };
}

const LANGUAGE_HINT =
  /\b(html|css|javascript|typescript|java|cpp|c#|sql|rust|go|ruby|php|python|pseudocode|pseudo|pdf)\b|c\+\+/i;

function extractTargetLabel(original: string): string | null {
  const cpp = original.match(/c\+\+/i) ?? original.match(/\bcpp\b/i);
  if (cpp?.[0]) return /cpp/i.test(cpp[0]) ? 'C++' : cpp[0]!;
  const m = original.match(
    /\b(?:to|support(?:s)?)\s+([A-Za-z][A-Za-z+#.]*)\b/i,
  );
  if (!m?.[1]) return null;
  const raw = m[1]!;
  if (/^(to|a|an|the|my|this|it)$/i.test(raw)) return null;
  return raw;
}

function extractWriteTargetLabel(original: string): string | null {
  const cpp = original.match(/c\+\+/i) ?? original.match(/\bcpp\b/i);
  if (cpp?.[0]) return /cpp/i.test(cpp[0]) ? 'C++' : cpp[0]!;
  const m = original.match(
    /\b(html|css|javascript|typescript|java|sql|rust|golang|ruby|php|swift|kotlin|matlab|assembly|wasm|docx|xml|json|yaml|markdown)\b/i,
  );
  return m?.[1] ?? null;
}
