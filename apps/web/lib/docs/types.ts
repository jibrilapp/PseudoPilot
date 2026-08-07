/** Documentation catalog types — built from docs markdown at build time. */

export type DocHeading = {
  id: string;
  text: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
};

export type DocPage = {
  /** Path relative to `docs/`, e.g. `ide/UI.md`. */
  path: string;
  /** Stable route id, e.g. `ide/UI`. */
  slug: string;
  title: string;
  /** Top-level folder under docs/, or null for root files. */
  categoryId: string | null;
  categoryLabel: string;
  content: string;
  headings: DocHeading[];
  /** Plain text for search (no markdown syntax). */
  searchText: string;
};

export type DocCategory = {
  id: string;
  label: string;
  pages: DocPage[];
};

export type DocNavTree = {
  categories: DocCategory[];
  pagesBySlug: ReadonlyMap<string, DocPage>;
  pagesByPath: ReadonlyMap<string, DocPage>;
};

export type DocSearchHit = {
  page: DocPage;
  /** Matched field for ranking / display. */
  field: 'title' | 'heading' | 'content';
  snippet: string;
  headingId?: string;
};

export type DocLinkCheck = {
  fromPath: string;
  href: string;
  resolved: string | null;
  ok: boolean;
};
