import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Regression: right panel toggle looked broken in the IDE (worked on welcome)
 * because Monaco expanded into the freed width and the desktop flex row lacked
 * min-w-0/overflow-hidden — remounted aside laid out past innerWidth while
 * aria-pressed flipped correctly.
 */
describe('IdeShell desktop chrome layout', () => {
  it('constrains the desktop row so remounted side panels stay on-screen', () => {
    const src = readFileSync(
      join(root, 'components/ide/IdeShell.tsx'),
      'utf8',
    );
    expect(src).toMatch(
      /relative flex min-h-0 min-w-0 flex-1 overflow-hidden/,
    );
    expect(src).toMatch(
      /flex min-h-0 min-w-0 w-full flex-1 overflow-hidden/,
    );
    expect(src).toMatch(/flex h-full min-h-0 min-w-0 flex-col/);
  });

  it('lets DualEditor shrink inside the main flex slot', () => {
    const src = readFileSync(
      join(root, 'components/ide/DualEditor.tsx'),
      'utf8',
    );
    expect(src).toMatch(/flex h-full min-h-0 min-w-0 flex-col bg-pp-editor/);
  });
});
