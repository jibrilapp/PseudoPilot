import {
  applyExternalModelText,
  type ExternalApplyEditor,
} from './applyExternalText';

export type SyncPeerEditorBufferResult = {
  readonly applied: boolean;
};

/**
 * Apply the latest peer translation buffer into Monaco when the model differs.
 * Returns `{ applied: false }` when the editor is not mounted yet.
 */
export function syncPeerEditorBuffer(
  editor: ExternalApplyEditor | null,
  next: string,
): SyncPeerEditorBufferResult {
  if (!editor) {
    return { applied: false };
  }
  const result = applyExternalModelText(editor, next);
  return { applied: result.applied };
}
