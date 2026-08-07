/**
 * Independent IDE chrome open/closed flags (left sidebar, right panel, console).
 * Presentation-only — keeps toolbar toggles from sharing one boolean.
 */

export type IdeChromeVisibility = {
  sidebarOpen: boolean;
  rightOpen: boolean;
  consoleOpen: boolean;
};

export const DEFAULT_IDE_CHROME_VISIBILITY: IdeChromeVisibility = {
  sidebarOpen: true,
  rightOpen: true,
  consoleOpen: true,
};

export function toggleSidebar(
  state: IdeChromeVisibility,
): IdeChromeVisibility {
  return { ...state, sidebarOpen: !state.sidebarOpen };
}

export function toggleRight(state: IdeChromeVisibility): IdeChromeVisibility {
  return { ...state, rightOpen: !state.rightOpen };
}

export function toggleConsole(
  state: IdeChromeVisibility,
): IdeChromeVisibility {
  return { ...state, consoleOpen: !state.consoleOpen };
}

export type AutoRevealRightInput = {
  showDocs: boolean;
  isBusy: boolean;
  paused: boolean;
  variableCount: number;
  /** User explicitly closed the right panel; honor until runtime goes idle. */
  userCollapsed: boolean;
};

/**
 * Whether IdeShell should force the right panel open.
 * Returns false when the user has collapsed it, so toolbar toggles stay independent.
 */
export function shouldAutoRevealRight(input: AutoRevealRightInput): boolean {
  if (input.showDocs || input.userCollapsed) return false;
  return input.isBusy || input.paused || input.variableCount > 0;
}

export type AutoRevealConsoleInput = {
  showDocs: boolean;
  hasProblems: boolean;
  hasConsoleOutput: boolean;
  awaitingInput: boolean;
  paused: boolean;
  userCollapsed: boolean;
};

export function shouldAutoRevealConsole(
  input: AutoRevealConsoleInput,
): boolean {
  if (input.showDocs || input.userCollapsed) return false;
  return (
    input.hasProblems ||
    input.hasConsoleOutput ||
    input.awaitingInput ||
    input.paused
  );
}

export type AutoRevealSidebarInput = {
  paused: boolean;
  userCollapsed: boolean;
};

export function shouldAutoRevealSidebar(
  input: AutoRevealSidebarInput,
): boolean {
  if (input.userCollapsed) return false;
  return input.paused;
}

/** Clear user-collapse locks once runtime no longer needs the panel. */
export function shouldClearRightCollapse(input: {
  isBusy: boolean;
  paused: boolean;
  variableCount: number;
}): boolean {
  return !input.isBusy && !input.paused && input.variableCount === 0;
}

export function shouldClearConsoleCollapse(input: {
  hasProblems: boolean;
  hasConsoleOutput: boolean;
  awaitingInput: boolean;
  paused: boolean;
}): boolean {
  return (
    !input.hasProblems &&
    !input.hasConsoleOutput &&
    !input.awaitingInput &&
    !input.paused
  );
}

export function shouldClearSidebarCollapse(input: { paused: boolean }): boolean {
  return !input.paused;
}
