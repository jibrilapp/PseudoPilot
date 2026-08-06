/**
 * Last Monaco selection for the AI Coach (updated from CodeSurface).
 * Not a React store — collectAIContext reads the latest snapshot.
 */

export type EditorSelectionSnapshot = {
  readonly text: string;
  readonly language: 'pseudocode' | 'python';
  readonly updatedAt: number;
};

let latest: EditorSelectionSnapshot | null = null;

export function setEditorSelection(
  text: string,
  language: 'pseudocode' | 'python',
): void {
  const trimmed = text;
  if (!trimmed) {
    latest = {
      text: '',
      language,
      updatedAt: Date.now(),
    };
    return;
  }
  latest = {
    text: trimmed,
    language,
    updatedAt: Date.now(),
  };
}

export function getEditorSelection(): EditorSelectionSnapshot | null {
  return latest;
}

export function clearEditorSelection(): void {
  latest = null;
}
