import { describe, expect, it } from 'vitest';
import {
  WORKSPACE_STORAGE_KEY,
  WORKSPACE_MAX_CHARS,
  DEFAULT_PROGRAM_TITLE,
  clearWorkspaceSnapshot,
  createWorkspaceSnapshot,
  isWorkspaceDirty,
  loadWorkspaceSnapshot,
  normalizeWorkspaceSnapshot,
  saveWorkspaceSnapshot,
  workspaceSnapshotSize,
} from './workspacePersistence';

describe('workspacePersistence', () => {
  it('normalizes valid v1 snapshots', () => {
    const snap = normalizeWorkspaceSnapshot({
      version: 1,
      title: '  homework.pp  ',
      pseudocode: 'OUTPUT 1',
      python: 'print(1)',
      savedAt: 1000,
    });
    expect(snap).toEqual({
      version: 1,
      title: 'homework.pp',
      pseudocode: 'OUTPUT 1',
      python: 'print(1)',
      savedAt: 1000,
    });
  });

  it('rejects non-v1 or incomplete payloads', () => {
    expect(normalizeWorkspaceSnapshot(null)).toBeNull();
    expect(normalizeWorkspaceSnapshot({ version: 2 } as never)).toBeNull();
    expect(
      normalizeWorkspaceSnapshot({
        version: 1,
        pseudocode: 1 as never,
        python: '',
      }),
    ).toBeNull();
  });

  it('defaults empty title', () => {
    const snap = createWorkspaceSnapshot({
      title: '   ',
      pseudocode: 'A',
      python: 'B',
    });
    expect(snap.title).toBe(DEFAULT_PROGRAM_TITLE);
  });

  it('round-trips through Storage', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
    const result = saveWorkspaceSnapshot(
      {
        title: 'Untitled.pp',
        pseudocode: 'OUTPUT "hi"',
        python: 'print("hi")',
      },
      storage,
    );
    expect(result.ok).toBe(true);
    expect(store.has(WORKSPACE_STORAGE_KEY)).toBe(true);
    const loaded = loadWorkspaceSnapshot(storage);
    expect(loaded?.pseudocode).toBe('OUTPUT "hi"');
    expect(loaded?.python).toBe('print("hi")');
    clearWorkspaceSnapshot(storage);
    expect(loadWorkspaceSnapshot(storage)).toBeNull();
  });

  it('falls back on corrupt JSON', () => {
    const storage = {
      getItem: () => '{not-json',
      setItem: () => undefined,
    };
    expect(loadWorkspaceSnapshot(storage)).toBeNull();
  });

  it('rejects oversized payloads without writing', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };
    const huge = 'x'.repeat(WORKSPACE_MAX_CHARS + 10);
    const result = saveWorkspaceSnapshot(
      { title: 'Untitled.pp', pseudocode: huge, python: '' },
      storage,
    );
    expect(result).toEqual({ ok: false, reason: 'too_large' });
    expect(store.size).toBe(0);
  });

  it('detects dirty buffers vs last save', () => {
    const saved = createWorkspaceSnapshot(
      {
        title: 'Untitled.pp',
        pseudocode: 'A',
        python: 'B',
      },
      1,
    );
    expect(
      isWorkspaceDirty(
        { title: 'Untitled.pp', pseudocode: 'A', python: 'B' },
        saved,
      ),
    ).toBe(false);
    expect(
      isWorkspaceDirty(
        { title: 'Untitled.pp', pseudocode: 'A2', python: 'B' },
        saved,
      ),
    ).toBe(true);
    expect(
      isWorkspaceDirty(
        { title: 'Untitled.pp', pseudocode: '', python: '' },
        null,
      ),
    ).toBe(false);
  });

  it('sizes snapshots from buffer lengths', () => {
    const snap = createWorkspaceSnapshot({
      title: 'ab',
      pseudocode: 'cd',
      python: 'efg',
    });
    expect(workspaceSnapshotSize(snap)).toBe(2 + 2 + 3);
  });
});
