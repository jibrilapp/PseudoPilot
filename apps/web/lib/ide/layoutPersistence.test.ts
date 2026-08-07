import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IDE_LAYOUT,
  IDE_LAYOUT_STORAGE_KEY,
  clampConsoleHeight,
  clampEditorSplit,
  clampRightWidth,
  clampSidebarWidth,
  loadIdeLayout,
  normalizeIdeLayout,
  patchIdeLayout,
  saveIdeLayout,
} from './layoutPersistence';

describe('layoutPersistence', () => {
  it('clamps panel sizes to safe bounds', () => {
    expect(clampSidebarWidth(10)).toBe(180);
    expect(clampSidebarWidth(999)).toBe(420);
    expect(clampRightWidth(10)).toBe(240);
    expect(clampRightWidth(999)).toBe(480);
    expect(clampConsoleHeight(10)).toBe(120);
    expect(clampConsoleHeight(999)).toBe(480);
    expect(clampEditorSplit(0)).toBe(0.22);
    expect(clampEditorSplit(1)).toBe(0.78);
  });

  it('normalizes partial / invalid payloads', () => {
    expect(normalizeIdeLayout(null)).toEqual(DEFAULT_IDE_LAYOUT);
    expect(normalizeIdeLayout({ sidebarWidth: Number.NaN }).sidebarWidth).toBe(
      180,
    );
    expect(
      normalizeIdeLayout({ editorSplit: 0.9, showTimestamps: true })
        .showTimestamps,
    ).toBe(true);
  });

  it('round-trips through Storage', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };
    const next = patchIdeLayout(DEFAULT_IDE_LAYOUT, {
      sidebarWidth: 280,
      consoleHeight: 240,
      welcomeDismissed: true,
    });
    saveIdeLayout(next, storage);
    expect(store.has(IDE_LAYOUT_STORAGE_KEY)).toBe(true);
    expect(loadIdeLayout(storage)).toEqual(next);
  });

  it('falls back on corrupt JSON', () => {
    const storage = {
      getItem: () => '{not-json',
      setItem: () => undefined,
    };
    expect(loadIdeLayout(storage)).toEqual(DEFAULT_IDE_LAYOUT);
  });
});
