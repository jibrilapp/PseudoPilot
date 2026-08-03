import { describe, expect, it } from 'vitest';
import {
  CODE_SURFACE_LAYOUT,
  activeLineTopPx,
  codeSurfaceCssVars,
  editorContentHeightPx,
} from './codeSurfaceLayout';

/**
 * Contract tests for editor vertical alignment.
 * Full pixel screenshots need a browser harness; these lock the shared metrics
 * that keep gutter, code, and active-line highlight on the same grid.
 */
describe('CODE_SURFACE_LAYOUT', () => {
  it('uses identical px metrics for font and line box (no em drift)', () => {
    expect(CODE_SURFACE_LAYOUT.fontSizePx).toBe(13);
    expect(CODE_SURFACE_LAYOUT.lineHeightPx).toBe(22);
    expect(CODE_SURFACE_LAYOUT.padYPx).toBe(8);
    // Line box must be an integer number of CSS px so zoom stays aligned.
    expect(Number.isInteger(CODE_SURFACE_LAYOUT.lineHeightPx)).toBe(true);
    expect(Number.isInteger(CODE_SURFACE_LAYOUT.padYPx)).toBe(true);
  });

  it('places line 1 highlight flush with the first padded line box', () => {
    expect(activeLineTopPx(1)).toBe(CODE_SURFACE_LAYOUT.padYPx);
    expect(activeLineTopPx(2)).toBe(
      CODE_SURFACE_LAYOUT.padYPx + CODE_SURFACE_LAYOUT.lineHeightPx,
    );
    expect(activeLineTopPx(5)).toBe(
      CODE_SURFACE_LAYOUT.padYPx + 4 * CODE_SURFACE_LAYOUT.lineHeightPx,
    );
  });

  it('sizes editor content as pad + N identical line boxes', () => {
    const { padYPx, lineHeightPx } = CODE_SURFACE_LAYOUT;
    expect(editorContentHeightPx(1)).toBe(padYPx * 2 + lineHeightPx);
    expect(editorContentHeightPx(10)).toBe(padYPx * 2 + 10 * lineHeightPx);
    expect(editorContentHeightPx(0)).toBe(padYPx * 2 + lineHeightPx);
  });

  it('exposes CSS variables that match the layout constants', () => {
    const vars = codeSurfaceCssVars();
    expect(vars['--cs-font-size']).toBe(`${CODE_SURFACE_LAYOUT.fontSizePx}px`);
    expect(vars['--cs-line-height']).toBe(
      `${CODE_SURFACE_LAYOUT.lineHeightPx}px`,
    );
    expect(vars['--cs-pad-y']).toBe(`${CODE_SURFACE_LAYOUT.padYPx}px`);
    expect(vars['--cs-pad-x']).toBe(`${CODE_SURFACE_LAYOUT.padXPx}px`);
  });

  it('keeps breakpoint hit target within the line box', () => {
    expect(CODE_SURFACE_LAYOUT.bpHitSizePx).toBeLessThanOrEqual(
      CODE_SURFACE_LAYOUT.lineHeightPx,
    );
    expect(CODE_SURFACE_LAYOUT.bpDotSizePx).toBeLessThanOrEqual(
      CODE_SURFACE_LAYOUT.bpHitSizePx,
    );
  });
});
