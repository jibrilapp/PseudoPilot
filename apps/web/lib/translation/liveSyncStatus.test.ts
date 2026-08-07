import { describe, expect, it } from 'vitest';
import {
  liveSyncStatusDescription,
  liveSyncStatusLabel,
  pythonPaneSyncBadge,
} from './liveSyncStatus';
import type { TranslationStatus } from './types';

describe('liveSyncStatusLabel', () => {
  it('covers all TranslationStatus values', () => {
    const cases: Array<[TranslationStatus, string]> = [
      ['idle', 'Live Translation'],
      ['pending', 'Translating…'],
      ['ok', 'Synced'],
      ['error', 'Translation failed'],
    ];
    for (const [status, expected] of cases) {
      expect(liveSyncStatusLabel(status)).toBe(expected);
    }
  });
});

describe('liveSyncStatusDescription', () => {
  it('mentions automatic sync and never a manual Translate step', () => {
    for (const status of [
      'idle',
      'pending',
      'ok',
      'error',
    ] as TranslationStatus[]) {
      const desc = liveSyncStatusDescription(status);
      expect(desc.toLowerCase()).toContain('automatically');
      expect(desc.toLowerCase()).not.toContain('click translate');
    }
  });
});

describe('pythonPaneSyncBadge', () => {
  it('documents expected badge strings for sync states', () => {
    expect(pythonPaneSyncBadge('ok', null)).toBe('Live');
    expect(pythonPaneSyncBadge('pending', null)).toBe('Syncing…');
    expect(pythonPaneSyncBadge('idle', null)).toBeUndefined();
    expect(pythonPaneSyncBadge('error', 'python')).toBe(
      'Showing last good Pseudocode',
    );
    expect(pythonPaneSyncBadge('error', 'pseudocode')).toBe(
      'Showing last good translation',
    );
  });
});
