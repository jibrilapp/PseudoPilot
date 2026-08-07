import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROGRAM_PANE,
  isProgramPaneId,
  PROGRAM_PANES,
  PROGRAM_PERSISTENCE_NOTE,
  PROGRAM_TITLE,
} from './programWorkspace';

describe('programWorkspace', () => {
  it('exposes exactly two panes mapped to the dual buffers', () => {
    expect(PROGRAM_PANES).toHaveLength(2);
    expect(PROGRAM_PANES.map((p) => p.id)).toEqual([
      'main-pseudo',
      'main-py',
    ]);
    expect(PROGRAM_PANES.map((p) => p.language)).toEqual([
      'pseudocode',
      'python',
    ]);
  });

  it('defaults to the Pseudocode pane', () => {
    expect(DEFAULT_PROGRAM_PANE).toBe('main-pseudo');
  });

  it('validates pane ids without accepting decoy tree ids', () => {
    expect(isProgramPaneId('main-pseudo')).toBe(true);
    expect(isProgramPaneId('main-py')).toBe(true);
    expect(isProgramPaneId('helpers-pseudo')).toBe(false);
    expect(isProgramPaneId('ex01')).toBe(false);
    expect(isProgramPaneId('readme')).toBe(false);
  });

  it('uses an honest untitled title and autosave persistence copy', () => {
    expect(PROGRAM_TITLE).toBe('Untitled.pp');
    expect(PROGRAM_PERSISTENCE_NOTE.toLowerCase()).toMatch(/autosaved/);
    expect(PROGRAM_PERSISTENCE_NOTE.toLowerCase()).toMatch(/download/);
    expect(PROGRAM_PERSISTENCE_NOTE.toLowerCase()).not.toMatch(/resets the program/);
  });
});
