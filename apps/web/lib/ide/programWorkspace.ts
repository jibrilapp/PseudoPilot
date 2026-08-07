/**
 * Single-program workspace model for the student IDE.
 * Cambridge programs are one document; Pseudocode + Python are dual views
 * of that program — not a multi-file project tree.
 */

export type ProgramPaneId = 'main-pseudo' | 'main-py';

export type ProgramPane = {
  readonly id: ProgramPaneId;
  readonly label: string;
  readonly language: 'pseudocode' | 'python';
  readonly fileLabel: string;
};

export const PROGRAM_TITLE = 'Untitled.pp';

export const PROGRAM_PANES: readonly ProgramPane[] = [
  {
    id: 'main-pseudo',
    label: 'Pseudocode',
    language: 'pseudocode',
    fileLabel: 'Untitled.pp',
  },
  {
    id: 'main-py',
    label: 'Python',
    language: 'python',
    fileLabel: 'Untitled.py',
  },
] as const;

export const DEFAULT_PROGRAM_PANE: ProgramPaneId = 'main-pseudo';

export function isProgramPaneId(id: string): id is ProgramPaneId {
  return id === 'main-pseudo' || id === 'main-py';
}

/** Autosaved in this browser — refresh restores. Download to keep a file copy. */
export const PROGRAM_PERSISTENCE_NOTE =
  'Autosaved in this browser. Refresh restores your program. Use Download for a file copy.';
