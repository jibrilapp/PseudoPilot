/**
 * Derive slugs, titles, categories, and nav trees from raw corpus entries.
 * No hardcoded page lists — only folder→label niceties for category names.
 */

import type { DocCategory, DocHeading, DocNavTree, DocPage } from './types';

/** Optional friendly labels for top-level `docs/` folders. New folders fall back to title-case. */
const CATEGORY_LABELS: Record<string, string> = {
  'cambridge-syntax': 'Cambridge Pseudocode Syntax',
  'library-routines': 'Library Routines',
  language: 'Language',
  ide: 'IDE',
  ai: 'AI',
  adr: 'Architecture Decisions',
  api: 'API',
  architecture: 'Architecture',
  grammar: 'Grammar',
};

const ROOT_CATEGORY_ID = '_root';
const ROOT_CATEGORY_LABEL = 'Getting Started';

/** Preferred sort order for known categories; unknown categories sort after. */
const CATEGORY_ORDER = [
  ROOT_CATEGORY_ID,
  'cambridge-syntax',
  'library-routines',
  'language',
  'ide',
  'ai',
  'grammar',
  'architecture',
  'adr',
  'api',
];

export function pathToSlug(docPath: string): string {
  return docPath.replace(/\.md$/i, '');
}

export function categoryIdFromPath(docPath: string): string | null {
  const slash = docPath.indexOf('/');
  if (slash < 0) return null;
  return docPath.slice(0, slash);
}

export function categoryLabel(categoryId: string | null): string {
  if (categoryId == null) return ROOT_CATEGORY_LABEL;
  return (
    CATEGORY_LABELS[categoryId] ??
    categoryId
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
}

export function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function extractHeadings(markdown: string): DocHeading[] {
  const headings: DocHeading[] = [];
  const seen = new Map<string, number>();
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const level = m[1].length as DocHeading['level'];
    const text = m[2].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
    let id = slugifyHeading(text) || 'section';
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    if (n > 0) id = `${id}-${n}`;
    headings.push({ id, text, level });
  }
  return headings;
}

export function extractTitle(markdown: string, fallbackPath: string): string {
  const headings = extractHeadings(markdown);
  const h1 = headings.find((h) => h.level === 1);
  if (h1) return h1.text;
  const base = fallbackPath.split('/').pop() ?? fallbackPath;
  return base.replace(/\.md$/i, '').replace(/[-_]/g, ' ');
}

/** Strip markdown-ish syntax for search indexing. */
export function toSearchText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`~|>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type RawDocEntry = { path: string; content: string };

export function buildDocPage(entry: RawDocEntry): DocPage {
  const categoryId = categoryIdFromPath(entry.path);
  const headings = extractHeadings(entry.content);
  return {
    path: entry.path,
    slug: pathToSlug(entry.path),
    title: extractTitle(entry.content, entry.path),
    categoryId,
    categoryLabel: categoryLabel(categoryId),
    content: entry.content,
    headings,
    searchText: toSearchText(entry.content),
  };
}

export function buildNavTree(entries: readonly RawDocEntry[]): DocNavTree {
  const pages = entries.map(buildDocPage);
  const byCategory = new Map<string, DocPage[]>();

  for (const page of pages) {
    const key = page.categoryId ?? ROOT_CATEGORY_ID;
    const list = byCategory.get(key) ?? [];
    list.push(page);
    byCategory.set(key, list);
  }

  const categories: DocCategory[] = [...byCategory.entries()]
    .map(([id, catPages]) => ({
      id,
      label: id === ROOT_CATEGORY_ID ? ROOT_CATEGORY_LABEL : categoryLabel(id),
      pages: catPages.sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a.id);
      const bi = CATEGORY_ORDER.indexOf(b.id);
      const ao = ai === -1 ? CATEGORY_ORDER.length : ai;
      const bo = bi === -1 ? CATEGORY_ORDER.length : bi;
      if (ao !== bo) return ao - bo;
      return a.label.localeCompare(b.label);
    });

  return {
    categories,
    pagesBySlug: new Map(pages.map((p) => [p.slug, p])),
    pagesByPath: new Map(pages.map((p) => [p.path, p])),
  };
}

export function defaultDocSlug(tree: DocNavTree): string {
  const ideUi = tree.pagesBySlug.get('ide/UI');
  if (ideUi) return ideUi.slug;
  const first = tree.categories[0]?.pages[0];
  return first?.slug ?? '';
}
