/**
 * Apply an external buffer into a Monaco model without fighting the user:
 * preserves cursor (clamped), scroll, and records one undoable edit.
 */

export type EditorPosition = {
  readonly lineNumber: number;
  readonly column: number;
};

export type ExternalApplyEditor = {
  getModel(): ExternalApplyModel | null;
  getPosition(): EditorPosition | null;
  getScrollTop(): number;
  getScrollLeft(): number;
  setPosition(pos: EditorPosition): void;
  setScrollTop(top: number): void;
  setScrollLeft(left: number): void;
  executeEdits(
    source: string,
    edits: readonly { range: ExternalApplyRange; text: string }[],
  ): unknown;
};

export type ExternalApplyModel = {
  getValue(): string;
  getFullModelRange(): ExternalApplyRange;
  getLineCount(): number;
  getLineMaxColumn(lineNumber: number): number;
};

export type ExternalApplyRange = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

export type ApplyExternalResult = {
  readonly applied: boolean;
  readonly preservedPosition: EditorPosition | null;
  readonly preservedScrollTop: number;
  readonly preservedScrollLeft: number;
};

/**
 * Replace model text when it differs from `next`.
 * Uses `executeEdits` so undo/redo remains available on the peer pane.
 */
export function applyExternalModelText(
  editor: ExternalApplyEditor,
  next: string,
  source = 'pseudopilot-sync',
): ApplyExternalResult {
  const model = editor.getModel();
  if (!model) {
    return {
      applied: false,
      preservedPosition: null,
      preservedScrollTop: 0,
      preservedScrollLeft: 0,
    };
  }
  if (model.getValue() === next) {
    return {
      applied: false,
      preservedPosition: editor.getPosition(),
      preservedScrollTop: editor.getScrollTop(),
      preservedScrollLeft: editor.getScrollLeft(),
    };
  }

  const position = editor.getPosition();
  const scrollTop = editor.getScrollTop();
  const scrollLeft = editor.getScrollLeft();

  editor.executeEdits(source, [
    { range: model.getFullModelRange(), text: next },
  ]);

  let preserved: EditorPosition | null = null;
  if (position) {
    const lineCount = Math.max(1, model.getLineCount());
    const line = Math.min(Math.max(1, position.lineNumber), lineCount);
    const maxCol = model.getLineMaxColumn(line);
    preserved = {
      lineNumber: line,
      column: Math.min(Math.max(1, position.column), maxCol),
    };
    editor.setPosition(preserved);
  }
  editor.setScrollTop(scrollTop);
  editor.setScrollLeft(scrollLeft);

  return {
    applied: true,
    preservedPosition: preserved,
    preservedScrollTop: scrollTop,
    preservedScrollLeft: scrollLeft,
  };
}
