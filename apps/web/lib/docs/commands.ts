/**
 * Future-ready command palette registry for Documentation.
 * Wire these ids into a Command Palette when one lands in the IDE.
 */

export type DocsCommandId =
  | 'docs.open'
  | 'docs.search'
  | 'docs.goHome'
  | 'docs.next'
  | 'docs.prev';

export type DocsCommand = {
  id: DocsCommandId;
  title: string;
  /** Keyboard chord hint for future palette UI. */
  keybinding?: string;
  category: 'Documentation';
};

export const DOCS_COMMANDS: readonly DocsCommand[] = [
  {
    id: 'docs.open',
    title: 'Documentation: Open',
    keybinding: 'Ctrl+Shift+D',
    category: 'Documentation',
  },
  {
    id: 'docs.search',
    title: 'Documentation: Focus Search',
    keybinding: 'Ctrl+Shift+F',
    category: 'Documentation',
  },
  {
    id: 'docs.goHome',
    title: 'Documentation: Getting Started',
    category: 'Documentation',
  },
  {
    id: 'docs.next',
    title: 'Documentation: Next Page',
    category: 'Documentation',
  },
  {
    id: 'docs.prev',
    title: 'Documentation: Previous Page',
    category: 'Documentation',
  },
] as const;

export type DocsCommandHandlers = Partial<
  Record<DocsCommandId, () => void>
>;

/**
 * Stub registry — call from IdeShell / Command Palette when available.
 * Returns the list of unbound commands for diagnostics.
 */
export function registerDocsCommands(
  handlers: DocsCommandHandlers,
): DocsCommandId[] {
  const unbound: DocsCommandId[] = [];
  for (const cmd of DOCS_COMMANDS) {
    if (!handlers[cmd.id]) unbound.push(cmd.id);
  }
  return unbound;
}
