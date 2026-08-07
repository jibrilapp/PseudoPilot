import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IDE_CHROME_VISIBILITY,
  shouldAutoRevealConsole,
  shouldAutoRevealRight,
  shouldAutoRevealSidebar,
  shouldClearConsoleCollapse,
  shouldClearRightCollapse,
  shouldClearSidebarCollapse,
  toggleConsole,
  toggleRight,
  toggleSidebar,
} from './ideChromeVisibility';

describe('ideChromeVisibility', () => {
  it('toggles left sidebar without changing right or console', () => {
    const next = toggleSidebar(DEFAULT_IDE_CHROME_VISIBILITY);
    expect(next).toEqual({
      sidebarOpen: false,
      rightOpen: true,
      consoleOpen: true,
    });
    expect(toggleSidebar(next).sidebarOpen).toBe(true);
    expect(toggleSidebar(next).rightOpen).toBe(true);
    expect(toggleSidebar(next).consoleOpen).toBe(true);
  });

  it('toggles right panel without changing left or console', () => {
    const next = toggleRight(DEFAULT_IDE_CHROME_VISIBILITY);
    expect(next).toEqual({
      sidebarOpen: true,
      rightOpen: false,
      consoleOpen: true,
    });
    const bothClosed = toggleSidebar(next);
    expect(bothClosed).toEqual({
      sidebarOpen: false,
      rightOpen: false,
      consoleOpen: true,
    });
    expect(toggleRight(bothClosed)).toEqual({
      sidebarOpen: false,
      rightOpen: true,
      consoleOpen: true,
    });
  });

  it('allows both sidebars open or closed independently', () => {
    let state = DEFAULT_IDE_CHROME_VISIBILITY;
    state = toggleSidebar(state);
    state = toggleRight(state);
    expect(state.sidebarOpen).toBe(false);
    expect(state.rightOpen).toBe(false);

    state = toggleSidebar(state);
    expect(state.sidebarOpen).toBe(true);
    expect(state.rightOpen).toBe(false);

    state = toggleRight(state);
    expect(state.sidebarOpen).toBe(true);
    expect(state.rightOpen).toBe(true);

    state = toggleConsole(state);
    expect(state).toEqual({
      sidebarOpen: true,
      rightOpen: true,
      consoleOpen: false,
    });
  });

  it('cycles right panel close → reopen → close → reopen independently', () => {
    let state = DEFAULT_IDE_CHROME_VISIBILITY;
    let userCollapsed = false;

    const manualToggle = () => {
      state = toggleRight(state);
      userCollapsed = !state.rightOpen;
    };

    manualToggle(); // close
    expect(state.rightOpen).toBe(false);
    expect(userCollapsed).toBe(true);
    expect(
      shouldAutoRevealRight({
        showDocs: false,
        isBusy: true,
        paused: false,
        variableCount: 2,
        userCollapsed,
      }),
    ).toBe(false);

    manualToggle(); // reopen — clears collapse lock
    expect(state.rightOpen).toBe(true);
    expect(userCollapsed).toBe(false);

    manualToggle(); // close again
    expect(state.rightOpen).toBe(false);
    expect(userCollapsed).toBe(true);

    manualToggle(); // reopen again
    expect(state.rightOpen).toBe(true);
    expect(userCollapsed).toBe(false);
    expect(state.sidebarOpen).toBe(true);
    expect(state.consoleOpen).toBe(true);
  });

  it('does not auto-reveal right when the user collapsed it', () => {
    expect(
      shouldAutoRevealRight({
        showDocs: false,
        isBusy: true,
        paused: false,
        variableCount: 3,
        userCollapsed: true,
      }),
    ).toBe(false);

    expect(
      shouldAutoRevealRight({
        showDocs: false,
        isBusy: true,
        paused: false,
        variableCount: 3,
        userCollapsed: false,
      }),
    ).toBe(true);
  });

  it('does not auto-reveal console or sidebar when user collapsed them', () => {
    expect(
      shouldAutoRevealConsole({
        showDocs: false,
        hasProblems: true,
        hasConsoleOutput: true,
        awaitingInput: false,
        paused: false,
        userCollapsed: true,
      }),
    ).toBe(false);

    expect(
      shouldAutoRevealSidebar({ paused: true, userCollapsed: true }),
    ).toBe(false);
    expect(
      shouldAutoRevealSidebar({ paused: true, userCollapsed: false }),
    ).toBe(true);
  });

  it('clears collapse locks only when runtime no longer needs the panel', () => {
    expect(
      shouldClearRightCollapse({
        isBusy: false,
        paused: false,
        variableCount: 0,
      }),
    ).toBe(true);
    expect(
      shouldClearRightCollapse({
        isBusy: false,
        paused: false,
        variableCount: 1,
      }),
    ).toBe(false);

    expect(
      shouldClearConsoleCollapse({
        hasProblems: false,
        hasConsoleOutput: false,
        awaitingInput: false,
        paused: false,
      }),
    ).toBe(true);
    expect(shouldClearSidebarCollapse({ paused: false })).toBe(true);
    expect(shouldClearSidebarCollapse({ paused: true })).toBe(false);
  });
});
