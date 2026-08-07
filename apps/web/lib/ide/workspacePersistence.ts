/**
 * Persist the single-program IDE buffers (Pseudocode + Python + title)
 * to browser localStorage so refresh / tab close does not lose work.
 */

export const WORKSPACE_STORAGE_KEY = 'pseudopilot.ide.workspace.v1';

/** Debounce for autosave after edits. */
export const WORKSPACE_AUTOSAVE_DEBOUNCE_MS = 400;

/** Soft cap — skip write rather than blow localStorage quota. */
export const WORKSPACE_MAX_CHARS = 400_000;

export const DEFAULT_PROGRAM_TITLE = 'Untitled.pp';

export type WorkspaceSnapshot = {
  readonly version: 1;
  readonly title: string;
  readonly pseudocode: string;
  readonly python: string;
  /** Epoch ms when last written. */
  readonly savedAt: number;
};

export type WorkspaceBuffers = {
  readonly title: string;
  readonly pseudocode: string;
  readonly python: string;
};

export function normalizeWorkspaceSnapshot(
  partial: Partial<WorkspaceSnapshot> | null | undefined,
): WorkspaceSnapshot | null {
  if (!partial || typeof partial !== 'object') return null;
  if (partial.version !== 1) return null;
  if (typeof partial.pseudocode !== 'string') return null;
  if (typeof partial.python !== 'string') return null;
  const title =
    typeof partial.title === 'string' && partial.title.trim().length > 0
      ? partial.title.trim()
      : DEFAULT_PROGRAM_TITLE;
  const savedAt =
    typeof partial.savedAt === 'number' && Number.isFinite(partial.savedAt)
      ? partial.savedAt
      : Date.now();
  return {
    version: 1,
    title,
    pseudocode: partial.pseudocode,
    python: partial.python,
    savedAt,
  };
}

export function createWorkspaceSnapshot(
  buffers: WorkspaceBuffers,
  savedAt: number = Date.now(),
): WorkspaceSnapshot {
  return {
    version: 1,
    title:
      buffers.title.trim().length > 0
        ? buffers.title.trim()
        : DEFAULT_PROGRAM_TITLE,
    pseudocode: buffers.pseudocode,
    python: buffers.python,
    savedAt,
  };
}

export function workspaceSnapshotSize(snapshot: WorkspaceSnapshot): number {
  return (
    snapshot.title.length +
    snapshot.pseudocode.length +
    snapshot.python.length
  );
}

export function loadWorkspaceSnapshot(
  storage: Pick<Storage, 'getItem'> | null | undefined = typeof localStorage !==
  'undefined'
    ? localStorage
    : null,
): WorkspaceSnapshot | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WorkspaceSnapshot>;
    return normalizeWorkspaceSnapshot(parsed);
  } catch {
    return null;
  }
}

export type SaveWorkspaceResult =
  | { readonly ok: true; readonly snapshot: WorkspaceSnapshot }
  | { readonly ok: false; readonly reason: 'quota' | 'too_large' | 'unavailable' };

export function saveWorkspaceSnapshot(
  buffers: WorkspaceBuffers,
  storage: Pick<Storage, 'setItem'> | null | undefined = typeof localStorage !==
  'undefined'
    ? localStorage
    : null,
): SaveWorkspaceResult {
  if (!storage) return { ok: false, reason: 'unavailable' };
  const snapshot = createWorkspaceSnapshot(buffers);
  if (workspaceSnapshotSize(snapshot) > WORKSPACE_MAX_CHARS) {
    return { ok: false, reason: 'too_large' };
  }
  try {
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot));
    return { ok: true, snapshot };
  } catch {
    return { ok: false, reason: 'quota' };
  }
}

export function clearWorkspaceSnapshot(
  storage: Pick<Storage, 'removeItem'> | null | undefined = typeof localStorage !==
  'undefined'
    ? localStorage
    : null,
): void {
  if (!storage) return;
  try {
    storage.removeItem(WORKSPACE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** True when saved buffers differ from the given live buffers. */
export function isWorkspaceDirty(
  live: WorkspaceBuffers,
  lastSaved: WorkspaceSnapshot | null,
): boolean {
  if (!lastSaved) {
    return live.pseudocode.length > 0 || live.python.length > 0;
  }
  return (
    live.pseudocode !== lastSaved.pseudocode ||
    live.python !== lastSaved.python ||
    (live.title.trim() || DEFAULT_PROGRAM_TITLE) !== lastSaved.title
  );
}
