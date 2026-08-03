/**
 * Shared vertical metrics for the editor (historically CodeSurface; now Monaco).
 *
 * {@link MONACO_FONT} in `lib/monaco` mirrors fontSizePx / lineHeightPx so
 * decorations and typing cadence stay consistent with the IDE chrome.
 */
export const CODE_SURFACE_LAYOUT = {
  /** Editor + gutter font size (px). */
  fontSizePx: 13,
  /**
   * Fixed line box height (px). Prefer px over unitless `em` so gutter `h-*`
   * and textarea `line-height` cannot diverge when font-size differs.
   */
  lineHeightPx: 22,
  /** Vertical padding above the first line / below the last (px). */
  padYPx: 8,
  /** Horizontal padding inside the textarea / read-only pre (px). */
  padXPx: 16,
  /** Horizontal padding inside the gutter column (px). */
  gutterPadXPx: 6,
  /** Breakpoint hit-target size (px), centered in the line box. */
  bpHitSizePx: 16,
  /** Breakpoint dot size (px). */
  bpDotSizePx: 8,
  /** Minimum width for the line-number column (ch-like via px). */
  lineNumberMinWidthPx: 24,
} as const;

export type CodeSurfaceLayout = typeof CODE_SURFACE_LAYOUT;

/** Top edge of the active-line band relative to the editor content box. */
export function activeLineTopPx(line1Based: number): number {
  const { padYPx, lineHeightPx } = CODE_SURFACE_LAYOUT;
  return padYPx + (line1Based - 1) * lineHeightPx;
}

/** Total height of the textarea / mirrored content (padding + N line boxes). */
export function editorContentHeightPx(lineCount: number): number {
  const { padYPx, lineHeightPx } = CODE_SURFACE_LAYOUT;
  const n = Math.max(lineCount, 1);
  return padYPx * 2 + n * lineHeightPx;
}

/** CSS custom-property bag applied to the code surface root. */
export function codeSurfaceCssVars(): Record<string, string> {
  const L = CODE_SURFACE_LAYOUT;
  return {
    '--cs-font-size': `${L.fontSizePx}px`,
    '--cs-line-height': `${L.lineHeightPx}px`,
    '--cs-pad-y': `${L.padYPx}px`,
    '--cs-pad-x': `${L.padXPx}px`,
    '--cs-gutter-pad-x': `${L.gutterPadXPx}px`,
  };
}
