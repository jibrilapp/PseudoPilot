import { describe, expect, it } from 'vitest';
import {
  applyExternalModelText,
  type ExternalApplyEditor,
  type ExternalApplyModel,
} from './applyExternalText';
import { syncPeerEditorBuffer } from './syncPeerEditorBuffer';

function mockEditor(initial: string): {
  editor: ExternalApplyEditor;
  model: ExternalApplyModel & { value: string };
} {
  const model = {
    value: initial,
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

  const editor: ExternalApplyEditor = {
    getModel: () => model,
    getPosition: () => ({ lineNumber: 1, column: 1 }),
    getScrollTop: () => 0,
    getScrollLeft: () => 0,
    setPosition() {},
    setScrollTop() {},
    setScrollLeft() {},
    executeEdits(_source, edits) {
      model.value = edits[0]?.text ?? model.value;
    },
  };

  return { editor, model };
}

describe('syncPeerEditorBuffer', () => {
  it('returns applied false when editor is not mounted', () => {
    expect(syncPeerEditorBuffer(null, 'print(1)').applied).toBe(false);
  });

  it('catches up when translation finished before Monaco mounted (missed effect)', () => {
    const peerBuffer = 'print(2)\n';
    // Effect ran while editorRef was null — model still empty from defaultValue.
    const { editor, model } = mockEditor('');
    expect(syncPeerEditorBuffer(editor, peerBuffer).applied).toBe(true);
    expect(model.value).toBe(peerBuffer);
  });

  it('matches applyExternalModelText no-op when already in sync', () => {
    const text = 'x = 1\n';
    const { editor, model } = mockEditor(text);
    expect(syncPeerEditorBuffer(editor, text).applied).toBe(false);
    expect(model.value).toBe(text);
    expect(applyExternalModelText(editor, text).applied).toBe(false);
  });
});
