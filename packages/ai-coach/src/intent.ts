import type { AIContext } from './context.js';
import { matchConcept } from './concepts.js';
import { looksLikeGeneralProgrammingTopic } from './generalProgramming.js';

/**
 * Exactly one intent before the coach generates an answer.
 * Product capability always outranks concept keyword matches
 * (e.g. "translate" must not become STRING / translation theory).
 * General programming must not be forced into Cambridge theory.
 */
export type CoachIntent =
  | 'product_capability'
  | 'cambridge_theory'
  | 'current_code'
  | 'compiler_runtime_diagnostics'
  | 'general_programming';

/** Languages / formats that are product targets (supported or not). */
const LANGUAGE_OR_FORMAT =
  /\b(html|css|javascript|typescript|java|cpp|c#|csharp|sql|rust|golang|ruby|php|swift|kotlin|matlab|assembly|wasm|pdf|docx|xml|json|yaml|markdown|python|pseudocode|pseudo[- ]?code)\b|c\+\+/i;

const PRODUCT_NAME = /\bpseudopilot\b/;

const IDE_LOCALE =
  /\b(here|pseudopilot|this (app|ide|tool|editor)|the (app|ide|editor)|in (this|the) (app|ide|tool|editor))\b/;

const CAPABILITY_ASK =
  /\b(can i|can you|can (this|it|we)|do(es)? (this|it|you|the app|the ide|pseudopilot)|is it possible|does this (app|ide|tool)|is there (a|an)|support(s|ed)?|available (in|here)|work(s)? (here|offline)|in (this|the) (app|ide|tool|editor))\b/;

const FEATURE_VERB =
  /\b(translate|export|convert|import|debug|run|compile|write|use|edit|code|author|open|create)\b/;

/**
 * Classify a student question into exactly one {@link CoachIntent}.
 * Call this **before** concept matching so product questions never become theory.
 */
export function classifyCoachIntent(
  question: string,
  context?: AIContext,
): CoachIntent {
  const q = question.trim().toLowerCase();
  if (!q) return 'general_programming';

  if (looksLikeProductCapability(q)) {
    return 'product_capability';
  }

  if (looksLikeDiagnosticsQuestion(q, context)) {
    return 'compiler_runtime_diagnostics';
  }

  if (looksLikeCurrentCodeQuestion(q, context)) {
    return 'current_code';
  }

  // Ordinary CS (HTML, Git, OOP, “recursion in Python”, …) before concept cards
  // so we never force general programming into Cambridge theory.
  if (looksLikeGeneralProgrammingTopic(q)) {
    return 'general_programming';
  }

  // Concept cards only — do not force every non-code question into theory.
  if (matchConcept(q)) {
    return 'cambridge_theory';
  }

  if (looksLikeTheoryQuestion(q) && /\b(cambridge|9618|pseudocode)\b/.test(q)) {
    return 'cambridge_theory';
  }

  return 'general_programming';
}

function looksLikeProductCapability(q: string): boolean {
  if (PRODUCT_NAME.test(q)) return true;

  if (
    /\b(offline|without\s+(an?\s+)?(internet|network|connection)|no\s+internet)\b/.test(
      q,
    )
  ) {
    return true;
  }

  if (
    /\b(export|download|save|print)\b.{0,40}\bpdf\b|\bpdf\b.{0,40}\b(export|download|support|available)\b/.test(
      q,
    )
  ) {
    return true;
  }

  // "translate / export / convert to <language-or-format>"
  if (
    /\b(translate|export|convert|compile)\s+to\b/.test(q) &&
    LANGUAGE_OR_FORMAT.test(q)
  ) {
    return true;
  }

  // "Does … support Java / SQL / …"
  if (/\bsupport(s|ed)?\b/.test(q) && LANGUAGE_OR_FORMAT.test(q)) {
    return true;
  }

  // "Can I debug Python?" / "Can I write HTML here?" / feature verbs + target
  if (
    CAPABILITY_ASK.test(q) &&
    FEATURE_VERB.test(q) &&
    (LANGUAGE_OR_FORMAT.test(q) ||
      /\b(offline|pdf|file|here)\b/.test(q))
  ) {
    // "Can Python generate HTML?" is about the language, not the IDE —
    // unless the student anchors it in this product ("here", "in PseudoPilot").
    if (
      /\bcan python\b/.test(q) &&
      !IDE_LOCALE.test(q) &&
      !PRODUCT_NAME.test(q)
    ) {
      return false;
    }
    return true;
  }

  // "Can I write HTML here?" / "… in this IDE" even if verb matching is soft
  if (
    CAPABILITY_ASK.test(q) &&
    LANGUAGE_OR_FORMAT.test(q) &&
    IDE_LOCALE.test(q)
  ) {
    return true;
  }

  // Generic "does this app / IDE …" feature questions
  if (
    /\b(this (app|ide|tool)|the (app|ide)|in (the|this) (app|ide|editor))\b/.test(
      q,
    ) &&
    CAPABILITY_ASK.test(q)
  ) {
    return true;
  }

  return false;
}

function looksLikeDiagnosticsQuestion(
  q: string,
  context?: AIContext,
): boolean {
  if (
    /\b(undeclared|diagnostic|compiler error|syntax error|fix (this|my|the)|how (do|can) i fix)\b/.test(
      q,
    ) ||
    /\b(error|errors)\b/.test(q) ||
    /\b(c_|e_|t_|r_)\w*\b/.test(q)
  ) {
    return true;
  }

  if (
    /\b(runtime|crash|exception)\b/.test(q) ||
    (/\br_\w*\b/.test(q) && /\b(error|fail|crash)\b/.test(q))
  ) {
    return true;
  }

  if (
    context &&
    context.debugger.runtimeErrors.length > 0 &&
    /\b(runtime error|crash|exception|why did (it|this) (fail|crash|error))\b/.test(
      q,
    )
  ) {
    return true;
  }

  return false;
}

function looksLikeCurrentCodeQuestion(
  q: string,
  context?: AIContext,
): boolean {
  if (
    /\b(my (code|program|variable|error|file)|this (line|variable|procedure|function|error|code|program)|why (is|does|did) (my|this)|in (my|this) (code|program)|what('s| is) wrong|wrong with my)\b/.test(
      q,
    )
  ) {
    return true;
  }

  if (
    context?.selectedText &&
    /\b(this|selection|selected|what does|explain (this|it|the code))\b/.test(q)
  ) {
    return true;
  }

  if (/\b(line.?by.?line|algorithm|walk.?through|step through)\b/.test(q)) {
    return true;
  }

  if (
    context?.debugger.paused &&
    /\b(paused|current line|where am i|call stack|stack)\b/.test(q)
  ) {
    return true;
  }

  if (
    /\b(python|pseudocode).{0,30}\b(translation|translate|pane|side)\b/.test(q) ||
    /\b(translation|translate).{0,30}\b(python|pseudocode)\b/.test(q) ||
    /\bcompare\b.{0,40}\b(python|pseudocode|translation|pane|side)\b/.test(q) ||
    /\b(python|pseudocode|translation|pane).{0,40}\b(compare|differ)\b/.test(q) ||
    (/\b(compare|differ)\b/.test(q) &&
      /\b(python|pseudocode|translation|pane|side|editors?)\b/.test(q))
  ) {
    // Comparing panes / live translation of *this* file — not product support
    // and not “how do I compare two values?” general CS.
    return true;
  }

  return false;
}

function looksLikeTheoryQuestion(q: string): boolean {
  if (
    /\b(my (code|program|variable|error|file)|this (line|variable|procedure|function|error)|why (is|does|did) (my|this)|in (my|this) (code|program)|what('s| is) wrong|wrong with my)\b/.test(
      q,
    )
  ) {
    return false;
  }
  return (
    /\b(what is|what's|whats|what are|explain|difference between|how does|how do|why (use|do we|would|is|are|choose)|when (to|should|do) (we |you )?use|define|meaning of)\b/.test(
      q,
    ) &&
    !/\b(undeclar|diagnostic|compiler error|runtime error|crash|this error|fix (this|my))\b/.test(
      q,
    )
  );
}
