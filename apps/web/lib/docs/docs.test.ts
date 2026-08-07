import { describe, expect, it } from 'vitest';
import {
  buildNavTree,
  categoryLabel,
  defaultDocSlug,
  extractHeadings,
  extractTitle,
  pathToSlug,
} from './discover';
import { DOC_CORPUS } from './corpus.generated';
import {
  extractRelativeMdHrefs,
  findBrokenDocLinks,
  resolveDocHref,
} from './links';
import { parseDocMarkdown } from './parseDocMarkdown';
import { highlightCode } from './highlight';
import { highlightSegments, searchDocs } from './search';
import { DOCS_COMMANDS, registerDocsCommands } from './commands';
import { getDocTree, resetDocTreeCache } from './catalog';

describe('docs discover', () => {
  it('builds categories from folder structure without a hardcoded page list', () => {
    const tree = buildNavTree(DOC_CORPUS);
    expect(DOC_CORPUS.length).toBeGreaterThan(10);
    expect(tree.categories.length).toBeGreaterThan(3);

    const labels = tree.categories.map((c) => c.label);
    expect(labels).toContain('Language');
    expect(labels).toContain('IDE');
    expect(labels).toContain('Getting Started');

    const allPaths = new Set(DOC_CORPUS.map((e) => e.path));
    for (const cat of tree.categories) {
      for (const page of cat.pages) {
        expect(allPaths.has(page.path)).toBe(true);
      }
    }
  });

  it('derives slug, title, and headings from markdown', () => {
    expect(pathToSlug('ide/UI.md')).toBe('ide/UI');
    expect(categoryLabel('ide')).toBe('IDE');
    expect(categoryLabel(null)).toBe('Getting Started');

    const md = '# Hello World\n\n## Section One\n\nBody.\n';
    expect(extractTitle(md, 'x.md')).toBe('Hello World');
    expect(extractHeadings(md).map((h) => h.id)).toEqual([
      'hello-world',
      'section-one',
    ]);
  });

  it('defaults to IDE UI when present', () => {
    const tree = buildNavTree(DOC_CORPUS);
    expect(defaultDocSlug(tree)).toBe('ide/UI');
  });
});

describe('docs search', () => {
  it('matches titles, headings, and content with highlight segments', () => {
    const tree = buildNavTree(DOC_CORPUS);
    const titleHits = searchDocs(tree, 'PseudoPilot IDE UI');
    expect(titleHits.some((h) => h.page.slug === 'ide/UI')).toBe(true);

    const contentHits = searchDocs(tree, 'Monaco');
    expect(contentHits.length).toBeGreaterThan(0);
    expect(contentHits.some((h) => h.page.slug.includes('ide/'))).toBe(true);

    const segs = highlightSegments('Monaco editor notes', 'monaco');
    expect(segs.some((s) => s.match && /monaco/i.test(s.text))).toBe(true);
  });
});

describe('docs markdown + highlight', () => {
  it('parses headings, tables, fences, and links', () => {
    const md = `# Title

| A | B |
| --- | --- |
| 1 | 2 |

\`\`\`python
print(1)
\`\`\`

See [spec](./SPEC.md) and [web](https://example.com).
`;
    const blocks = parseDocMarkdown(md);
    expect(blocks.some((b) => b.type === 'heading')).toBe(true);
    expect(blocks.some((b) => b.type === 'table')).toBe(true);
    expect(blocks.some((b) => b.type === 'code')).toBe(true);

    const para = blocks.find((b) => b.type === 'paragraph');
    expect(para?.type).toBe('paragraph');
    if (para?.type === 'paragraph') {
      const links = para.children.filter((c) => c.type === 'link');
      expect(links.length).toBe(2);
    }
  });

  it('highlights pseudocode and python keywords', () => {
    const pseudo = highlightCode('DECLARE x : INTEGER\nOUTPUT x', 'pseudocode');
    expect(pseudo.some((t) => t.type === 'keyword' && t.value === 'DECLARE')).toBe(
      true,
    );
    const py = highlightCode('def main():\n  return 1', 'python');
    expect(py.some((t) => t.type === 'keyword' && t.value === 'def')).toBe(true);
  });
});

describe('docs internal links', () => {
  it('resolves relative links within the corpus', () => {
    const tree = buildNavTree(DOC_CORPUS);
    const resolved = resolveDocHref('ide/UI.md', './MONACO.md', tree);
    expect(resolved?.slug).toBe('ide/MONACO');

    const up = resolveDocHref(
      'language/LANGUAGE_REFERENCE.md',
      './SPECIFICATION.md',
      tree,
    );
    expect(up?.slug).toBe('language/SPECIFICATION');
  });

  it('detects broken relative markdown links', () => {
    const tree = buildNavTree([
      {
        path: 'a.md',
        content: '# A\n\n[ok](./b.md) [bad](./missing.md)\n',
      },
      { path: 'b.md', content: '# B\n' },
    ]);
    const broken = findBrokenDocLinks(tree);
    expect(broken).toHaveLength(1);
    expect(broken[0]?.href).toBe('./missing.md');
    expect(extractRelativeMdHrefs('[x](./b.md)')).toEqual(['./b.md']);
  });

  it('reports zero broken links in the real docs corpus (or lists them)', () => {
    const tree = buildNavTree(DOC_CORPUS);
    const broken = findBrokenDocLinks(tree);
    // Soft assert: print context if failures appear; corpus should be clean.
    if (broken.length > 0) {
      const sample = broken
        .slice(0, 8)
        .map((b) => `${b.fromPath} → ${b.href}`)
        .join('\n');
      expect(broken, `Broken doc links:\n${sample}`).toHaveLength(0);
    } else {
      expect(broken).toHaveLength(0);
    }
  });
});

describe('docs catalog + commands', () => {
  it('caches getDocTree and exposes command palette stubs', () => {
    resetDocTreeCache();
    const a = getDocTree();
    const b = getDocTree();
    expect(a).toBe(b);
    expect(a.pagesBySlug.has('ide/UI')).toBe(true);

    expect(DOCS_COMMANDS.some((c) => c.id === 'docs.open')).toBe(true);
    const unbound = registerDocsCommands({ 'docs.open': () => undefined });
    expect(unbound).not.toContain('docs.open');
    expect(unbound.length).toBeGreaterThan(0);
  });
});
