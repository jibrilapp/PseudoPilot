/**
 * Persistence / autosave stress — unit-level (no browser Monaco).
 * Measures serialize+write latency for large buffers and rapid dirty checks.
 */

import { describe, expect, it } from 'vitest';
import {
  WORKSPACE_MAX_CHARS,
  createWorkspaceSnapshot,
  isWorkspaceDirty,
  saveWorkspaceSnapshot,
  workspaceSnapshotSize,
} from './workspacePersistence';

function makeStorage() {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
}

function largePseudocode(lines: number): string {
  const out: string[] = ['DECLARE Total : INTEGER', 'Total ← 0'];
  for (let i = 0; i < lines; i += 1) {
    out.push(`Total ← Total + ${i % 17}`);
  }
  out.push('OUTPUT Total');
  return out.join('\n');
}

describe('workspacePersistence stress', () => {
  it(
    'autosave 5000-line buffer latency',
    () => {
      const storage = makeStorage();
      const pseudocode = largePseudocode(5000);
      const python = `# ${pseudocode.length} chars\n` + 'x = 0\n'.repeat(5000);
      const buffers = {
        title: 'stress.pp',
        pseudocode,
        python,
      };
      const size = workspaceSnapshotSize(createWorkspaceSnapshot(buffers));
      expect(size).toBeLessThan(WORKSPACE_MAX_CHARS);

      const t0 = performance.now();
      const result = saveWorkspaceSnapshot(buffers, storage);
      const ms = performance.now() - t0;

      expect(result.ok).toBe(true);
      console.log(
        JSON.stringify({
          kind: 'stress-row',
          area: 'editor',
          scenario: 'autosave 5000-line buffers',
          pass: result.ok,
          ms: +ms.toFixed(3),
          size: `${size} chars payload`,
        }),
      );
      // Soft latency budget for in-memory Storage mock (not real localStorage I/O)
      expect(ms).toBeLessThan(500);
    },
    30_000,
  );

  it(
    'continuous autosave spam 1000 writes',
    () => {
      const storage = makeStorage();
      let pseudocode = 'OUTPUT 1';
      const t0 = performance.now();
      for (let i = 0; i < 1000; i += 1) {
        pseudocode = `OUTPUT ${i}\n` + pseudocode.slice(0, 200);
        const r = saveWorkspaceSnapshot(
          { title: 'spam.pp', pseudocode, python: `print(${i})` },
          storage,
        );
        expect(r.ok).toBe(true);
      }
      const ms = performance.now() - t0;
      console.log(
        JSON.stringify({
          kind: 'stress-row',
          area: 'editor',
          scenario: '1000 continuous autosaves',
          pass: true,
          ms: +ms.toFixed(3),
          detail: `avgMs=${(ms / 1000).toFixed(3)}`,
        }),
      );
      expect(ms).toBeLessThan(5_000);
    },
    30_000,
  );

  it('rapid dirty checks on large buffers', () => {
    const saved = createWorkspaceSnapshot({
      title: 'big.pp',
      pseudocode: largePseudocode(3000),
      python: 'print(1)\n'.repeat(3000),
    });
    const live = {
      title: 'big.pp',
      pseudocode: saved.pseudocode,
      python: saved.python,
    };
    const t0 = performance.now();
    let dirtyCount = 0;
    for (let i = 0; i < 10_000; i += 1) {
      if (isWorkspaceDirty(live, saved)) dirtyCount += 1;
      // mutate one char periodically
      if (i % 100 === 0) {
        (live as { python: string }).python = saved.python + String(i % 10);
      }
    }
    const ms = performance.now() - t0;
    expect(dirtyCount).toBeGreaterThan(0);
    console.log(
      JSON.stringify({
        kind: 'stress-row',
        area: 'editor',
        scenario: '10000 dirty checks large buffers',
        pass: true,
        ms: +ms.toFixed(3),
        detail: `dirtyCount=${dirtyCount}`,
      }),
    );
  });

  it('rejects near-quota paste without corrupting storage', () => {
    const storage = makeStorage();
    saveWorkspaceSnapshot(
      { title: 'ok.pp', pseudocode: 'OUTPUT 1', python: 'print(1)' },
      storage,
    );
    const huge = 'x'.repeat(WORKSPACE_MAX_CHARS);
    const bad = saveWorkspaceSnapshot(
      { title: 'huge.pp', pseudocode: huge, python: '' },
      storage,
    );
    expect(bad.ok).toBe(false);
    expect(storage.getItem('pseudopilot.ide.workspace.v1')).toContain('OUTPUT 1');
    console.log(
      JSON.stringify({
        kind: 'stress-row',
        area: 'editor',
        scenario: 'oversized paste rejected',
        pass: !bad.ok,
        ms: 0,
      }),
    );
  });
});
