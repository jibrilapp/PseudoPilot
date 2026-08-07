/**
 * Persist IDE chrome sizes (sidebar / right / console / editor split).
 * Presentation-only — does not affect language semantics.
 */

export const IDE_LAYOUT_STORAGE_KEY = 'pseudopilot.ide.layout.v1';

export type IdeLayoutState = {
  /** Left sidebar width in px. */
  sidebarWidth: number;
  /** Right panel width in px. */
  rightWidth: number;
  /** Bottom console height in px. */
  consoleHeight: number;
  /** Pseudocode share of the dual-editor split (0–1). */
  editorSplit: number;
  /** Show optional console timestamps. */
  showTimestamps: boolean;
  /** User dismissed the welcome landing. */
  welcomeDismissed: boolean;
};

export const DEFAULT_IDE_LAYOUT: IdeLayoutState = {
  sidebarWidth: 240,
  rightWidth: 300,
  consoleHeight: 196,
  editorSplit: 0.5,
  showTimestamps: false,
  welcomeDismissed: false,
};

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 420;
const RIGHT_MIN = 240;
const RIGHT_MAX = 480;
const CONSOLE_MIN = 120;
const CONSOLE_MAX = 480;
const EDITOR_SPLIT_MIN = 0.22;
const EDITOR_SPLIT_MAX = 0.78;

export function clampSidebarWidth(px: number): number {
  return clamp(px, SIDEBAR_MIN, SIDEBAR_MAX);
}

export function clampRightWidth(px: number): number {
  return clamp(px, RIGHT_MIN, RIGHT_MAX);
}

export function clampConsoleHeight(px: number): number {
  return clamp(px, CONSOLE_MIN, CONSOLE_MAX);
}

export function clampEditorSplit(ratio: number): number {
  return clamp(ratio, EDITOR_SPLIT_MIN, EDITOR_SPLIT_MAX);
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function normalizeIdeLayout(
  partial: Partial<IdeLayoutState> | null | undefined,
): IdeLayoutState {
  const base = { ...DEFAULT_IDE_LAYOUT, ...(partial ?? {}) };
  return {
    sidebarWidth: clampSidebarWidth(base.sidebarWidth),
    rightWidth: clampRightWidth(base.rightWidth),
    consoleHeight: clampConsoleHeight(base.consoleHeight),
    editorSplit: clampEditorSplit(base.editorSplit),
    showTimestamps: Boolean(base.showTimestamps),
    welcomeDismissed: Boolean(base.welcomeDismissed),
  };
}

export function loadIdeLayout(
  storage: Pick<Storage, 'getItem'> | null | undefined = typeof localStorage !==
  'undefined'
    ? localStorage
    : null,
): IdeLayoutState {
  if (!storage) return { ...DEFAULT_IDE_LAYOUT };
  try {
    const raw = storage.getItem(IDE_LAYOUT_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_IDE_LAYOUT };
    const parsed = JSON.parse(raw) as Partial<IdeLayoutState>;
    return normalizeIdeLayout(parsed);
  } catch {
    return { ...DEFAULT_IDE_LAYOUT };
  }
}

export function saveIdeLayout(
  layout: IdeLayoutState,
  storage: Pick<Storage, 'setItem'> | null | undefined = typeof localStorage !==
  'undefined'
    ? localStorage
    : null,
): void {
  if (!storage) return;
  try {
    storage.setItem(
      IDE_LAYOUT_STORAGE_KEY,
      JSON.stringify(normalizeIdeLayout(layout)),
    );
  } catch {
    // Quota / private mode — ignore.
  }
}

export function patchIdeLayout(
  current: IdeLayoutState,
  patch: Partial<IdeLayoutState>,
): IdeLayoutState {
  return normalizeIdeLayout({ ...current, ...patch });
}
