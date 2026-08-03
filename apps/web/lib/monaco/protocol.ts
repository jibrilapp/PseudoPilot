/**
 * Monaco ↔ PseudoPilot position helpers (LSP-style 0-based).
 */

export type MonacoLikePosition = {
  readonly lineNumber: number; // 1-based
  readonly column: number; // 1-based
};

export type LsLikePosition = {
  readonly line: number; // 0-based
  readonly character: number; // 0-based
};

export type LsLikeRange = {
  readonly start: LsLikePosition;
  readonly end: LsLikePosition;
};

export function monacoToLs(pos: MonacoLikePosition): LsLikePosition {
  return {
    line: Math.max(0, pos.lineNumber - 1),
    character: Math.max(0, pos.column - 1),
  };
}

export function lsPosToMonaco(pos: LsLikePosition): MonacoLikePosition {
  return {
    lineNumber: pos.line + 1,
    column: pos.character + 1,
  };
}

export function lsRangeToMonaco(range: LsLikeRange): {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
} {
  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1,
  };
}

export const PSEUDOCODE_LANGUAGE_ID = 'pseudocode' as const;
export const PYTHON_LANGUAGE_ID = 'python' as const;

export const MONACO_FONT = {
  fontSize: 13,
  lineHeight: 22,
  fontFamily:
    "var(--font-mono), 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
} as const;

/** Debounce for language-service document updates / diagnostics. */
export const LS_DIAGNOSTICS_DEBOUNCE_MS = 200;
