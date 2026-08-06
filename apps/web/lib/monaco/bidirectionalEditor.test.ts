import { describe, expect, it, vi } from 'vitest';
import {
  applyExternalModelText,
  type ExternalApplyEditor,
  type ExternalApplyModel,
} from './applyExternalText';
import {
  ideDiagnosticsToMarkers,
  MARKER_SEVERITY_ERROR,
} from './mapProviders';

function mockEditor(initial: string): {
  editor: ExternalApplyEditor;
  model: ExternalApplyModel & { value: string; edits: unknown[] };
} {
  const model = {
    value: initial,
    edits: [] as unknown[],
    getValue() {
      return this.value;
    },
    getFullModelRange() {
      return {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: this.value.length + 1,
      };
    },
    getLineCount() {
      return Math.max(1, this.value.split('\n').length);
    },
    getLineMaxColumn(lineNumber: number) {
      const lines = this.value.split('\n');
      return (lines[lineNumber - 1] ?? '').length + 1;
    },
  };

  let position = { lineNumber: 2, column: 3 };
  let scrollTop = 40;
  let scrollLeft = 5;

  const editor: ExternalApplyEditor = {
    getModel: () => model,
    getPosition: () => position,
    getScrollTop: () => scrollTop,
    getScrollLeft: () => scrollLeft,
    setPosition(pos) {
      position = { ...pos };
    },
    setScrollTop(top) {
      scrollTop = top;
    },
    setScrollLeft(left) {
      scrollLeft = left;
    },
    executeEdits(source, edits) {
      model.edits.push({ source, edits });
      model.value = edits[0]?.text ?? model.value;
    },
  };

  return { editor, model };
}

describe('applyExternalModelText', () => {
  it('no-ops when text is identical (preserves undo)', () => {
    const { editor, model } = mockEditor('abc');
    const result = applyExternalModelText(editor, 'abc');
    expect(result.applied).toBe(false);
    expect(model.edits).toHaveLength(0);
  });

  it('uses executeEdits so undo/redo can reverse the sync', () => {
    const { editor, model } = mockEditor('old');
    const result = applyExternalModelText(editor, 'new text');
    expect(result.applied).toBe(true);
    expect(model.edits).toHaveLength(1);
    expect((model.edits[0] as { source: string }).source).toBe(
      'pseudopilot-sync',
    );
    expect(model.value).toBe('new text');
  });

  it('preserves cursor (clamped) and scroll', () => {
    const { editor } = mockEditor('line1\nline2');
    const result = applyExternalModelText(editor, 'only');
    expect(result.applied).toBe(true);
    expect(result.preservedScrollTop).toBe(40);
    expect(result.preservedScrollLeft).toBe(5);
    // line 2 clamped to line 1 after single-line replace
    expect(result.preservedPosition).toEqual({
      lineNumber: 1,
      column: expect.any(Number),
    });
    expect(editor.getScrollTop()).toBe(40);
  });
});

describe('ideDiagnosticsToMarkers', () => {
  it('maps translation diagnostics for the Python editor', () => {
    const markers = ideDiagnosticsToMarkers([
      {
        severity: 'error',
        message: 'Unsupported',
        code: 'T_UNSUPPORTED',
        line: 3,
        column: 5,
      },
    ]);
    expect(markers).toHaveLength(1);
    expect(markers[0]?.severity).toBe(MARKER_SEVERITY_ERROR);
    expect(markers[0]?.startLineNumber).toBe(3);
    expect(markers[0]?.startColumn).toBe(5);
    expect(markers[0]?.code).toBe('T_UNSUPPORTED');
  });

  it('defaults missing positions to 1:1', () => {
    const markers = ideDiagnosticsToMarkers([
      { severity: 'warning', message: 'x', code: 'W' },
    ]);
    expect(markers[0]?.startLineNumber).toBe(1);
    expect(markers[0]?.startColumn).toBe(1);
  });
});

describe('DualEditor badge helpers (origin-aware messaging)', () => {
  it('documents expected badge strings for error sides', () => {
    // Keep in sync with DualEditor.pythonBadge — regression for UX copy.
    const cases: Array<{
      status: 'idle' | 'ok' | 'error';
      errorSide: 'pseudocode' | 'python' | null;
      expected: string | undefined;
    }> = [
      { status: 'ok', errorSide: null, expected: 'Live' },
      {
        status: 'error',
        errorSide: 'python',
        expected: 'Showing last good Pseudocode',
      },
      {
        status: 'error',
        errorSide: 'pseudocode',
        expected: 'Showing last good translation',
      },
      { status: 'idle', errorSide: null, expected: undefined },
    ];
    for (const c of cases) {
      let badge: string | undefined;
      if (c.status === 'ok') badge = 'Live';
      else if (c.status === 'error') {
        badge =
          c.errorSide === 'python'
            ? 'Showing last good Pseudocode'
            : 'Showing last good translation';
      }
      expect(badge).toBe(c.expected);
    }
  });
});

describe('suppressChange loop guard (documented contract)', () => {
  it('external apply must not invoke onChange when suppress flag is set', () => {
    const onChange = vi.fn();
    let suppress = false;
    const simulateMonacoChange = (value: string) => {
      if (suppress) return;
      onChange(value);
    };
    suppress = true;
    simulateMonacoChange('from-peer-sync');
    suppress = false;
    expect(onChange).not.toHaveBeenCalled();
    simulateMonacoChange('user-type');
    expect(onChange).toHaveBeenCalledWith('user-type');
  });

  it('clearing suppress on microtask still blocks sync executeEdits listeners', async () => {
    const onChange = vi.fn();
    let suppress = false;
    suppress = true;
    // Monaco onDidChangeModelContent is synchronous during executeEdits.
    if (!suppress) onChange('during-apply');
    queueMicrotask(() => {
      suppress = false;
    });
    expect(onChange).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(suppress).toBe(false);
    if (!suppress) onChange('after-clear');
    expect(onChange).toHaveBeenCalledWith('after-clear');
  });
});
