/**
 * Clean, serialisable context for the AI Coach.
 * Assembled from CompilerService / LanguageService / Runtime / translator
 * outputs — never from raw Monaco internals or package private APIs.
 */

/** Severity shared by compile / translate / runtime diagnostics. */
export type AIDiagnosticSeverity = 'error' | 'warning';

export type AIDiagnostic = {
  readonly id: string;
  readonly severity: AIDiagnosticSeverity;
  /** Stable engine code (`C_*`, `E_*`, `T_*`, `R_*`, …). */
  readonly code: string;
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
  /** Optional remediation hint from the checker/translator. */
  readonly help?: string;
  readonly source: 'parser' | 'semantic' | 'translation' | 'runtime';
};

export type AISymbol = {
  readonly name: string;
  readonly kind: string;
  /** Human-readable type (e.g. `INTEGER`, `ARRAY[1:10] OF STRING`). */
  readonly type: string;
  readonly line?: number;
  readonly column?: number;
  readonly builtin?: boolean;
  readonly containerName?: string;
};

/** Compact AST outline — kinds + spans only (no full node trees). */
export type AIAstNodeSummary = {
  readonly kind: string;
  readonly line?: number;
  readonly detail?: string;
};

export type AIVariable = {
  readonly name: string;
  readonly type: string;
  readonly value: string;
  readonly scope: string;
};

export type AIStackFrame = {
  readonly id: number;
  readonly name: string;
  readonly kind: string;
  readonly line?: number;
};

export type AIDebuggerState = {
  readonly executionState: string;
  readonly paused: boolean;
  readonly currentLine: number | null;
  readonly currentColumn: number | null;
  readonly frameName: string | null;
  readonly step: number | null;
  readonly depth: number | null;
  readonly variables: readonly AIVariable[];
  readonly callStack: readonly AIStackFrame[];
  readonly runtimeErrors: readonly AIDiagnostic[];
};

export type AITranslationState = {
  readonly status: 'idle' | 'ok' | 'error';
  readonly errorSide: 'pseudocode' | 'python' | null;
};

/**
 * Grounding payload for educational coaching.
 * Deliberately omits IR internals, checker maps, and Monaco handles.
 */
export type AIContext = {
  readonly documentUri: string;
  readonly pseudocode: string;
  readonly python: string;
  readonly translation: AITranslationState;
  readonly parserDiagnostics: readonly AIDiagnostic[];
  readonly semanticDiagnostics: readonly AIDiagnostic[];
  readonly translationDiagnostics: readonly AIDiagnostic[];
  readonly symbols: readonly AISymbol[];
  readonly astSummary: readonly AIAstNodeSummary[];
  readonly debugger: AIDebuggerState;
  /** Non-empty when the user has a non-collapsed editor selection. */
  readonly selectedText: string | null;
  readonly selectedLanguage: 'pseudocode' | 'python' | null;
};

export type CoachCapability =
  | 'explain_compiler_error'
  | 'explain_runtime_error'
  | 'explain_selection'
  | 'explain_algorithm'
  | 'explain_cambridge_concept'
  | 'suggest_fix'
  | 'compare_pseudocode_python'
  | 'general_cambridge_qa';

export type CoachRequest = {
  readonly question: string;
  readonly context: AIContext;
  /** Optional hint from the UI (quick-action buttons). */
  readonly capability?: CoachCapability;
};

export type CoachCitation = {
  readonly code?: string;
  readonly line?: number;
  readonly label: string;
};

export type CoachResponse = {
  readonly ok: boolean;
  readonly message: string;
  readonly citations: readonly CoachCitation[];
  readonly providerId: string;
  /** True when the answer came from a local heuristic (no remote LLM). */
  readonly groundedLocally: boolean;
};
