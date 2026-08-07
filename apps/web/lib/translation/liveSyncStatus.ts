import type { TranslationStatus } from './types';

/** Short status chip / status-bar label for live Pseudocode ↔ Python sync. */
export function liveSyncStatusLabel(status: TranslationStatus): string {
  switch (status) {
    case 'pending':
      return 'Translating…';
    case 'ok':
      return 'Synced';
    case 'error':
      return 'Translation failed';
    default:
      return 'Live Translation';
  }
}

/** Accessible description: automatic sync, no manual Translate step. */
export function liveSyncStatusDescription(status: TranslationStatus): string {
  const base =
    'Live translation — editing either editor updates the other automatically';
  switch (status) {
    case 'pending':
      return `${base}. Translating…`;
    case 'ok':
      return `${base}. Synced`;
    case 'error':
      return `${base}. Translation failed — fix the error and keep editing to retry`;
    default:
      return base;
  }
}

/** Compact badge on the Python pane header. */
export function pythonPaneSyncBadge(
  status: TranslationStatus,
  errorSide: 'pseudocode' | 'python' | null | undefined,
): string | undefined {
  if (status === 'pending') return 'Syncing…';
  if (status === 'ok') return 'Live';
  if (status !== 'error') return undefined;
  if (errorSide === 'python') return 'Showing last good Pseudocode';
  return 'Showing last good translation';
}
