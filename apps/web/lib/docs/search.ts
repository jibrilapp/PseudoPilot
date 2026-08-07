/**
 * Full-text search over doc titles, headings, and body content.
 */

import type { DocNavTree, DocSearchHit } from './types';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function tokenizeQuery(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

export function highlightMatches(text: string, query: string): string {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return text;
  const re = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'gi');
  return text.replace(re, '«$1»');
}

/** Split text into plain / match segments for React rendering. */
export function highlightSegments(
  text: string,
  query: string,
): { text: string; match: boolean }[] {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0 || !text) return [{ text, match: false }];
  const re = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'gi');
  const parts: { text: string; match: boolean }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push({ text: text.slice(last, m.index), match: false });
    }
    parts.push({ text: m[0], match: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), match: false });
  return parts.length > 0 ? parts : [{ text, match: false }];
}

function snippetAround(text: string, query: string, radius = 48): string {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return text.slice(0, radius * 2);
  const lower = text.toLowerCase();
  let idx = -1;
  for (const t of tokens) {
    const i = lower.indexOf(t);
    if (i >= 0 && (idx < 0 || i < idx)) idx = i;
  }
  if (idx < 0) return text.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + radius);
  let s = text.slice(start, end).trim();
  if (start > 0) s = `…${s}`;
  if (end < text.length) s = `${s}…`;
  return s;
}

export function searchDocs(
  tree: DocNavTree,
  query: string,
  limit = 40,
): DocSearchHit[] {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return [];

  const hits: DocSearchHit[] = [];

  for (const cat of tree.categories) {
    for (const page of cat.pages) {
      const titleLower = page.title.toLowerCase();
      if (tokens.every((t) => titleLower.includes(t))) {
        hits.push({
          page,
          field: 'title',
          snippet: page.title,
        });
        continue;
      }

      let headingHit: DocSearchHit | null = null;
      for (const h of page.headings) {
        const hl = h.text.toLowerCase();
        if (tokens.every((t) => hl.includes(t))) {
          headingHit = {
            page,
            field: 'heading',
            snippet: h.text,
            headingId: h.id,
          };
          break;
        }
      }
      if (headingHit) {
        hits.push(headingHit);
        continue;
      }

      const body = page.searchText.toLowerCase();
      if (tokens.every((t) => body.includes(t))) {
        hits.push({
          page,
          field: 'content',
          snippet: snippetAround(page.searchText, query),
        });
      }
    }
  }

  const rank = (f: DocSearchHit['field']) =>
    f === 'title' ? 0 : f === 'heading' ? 1 : 2;

  hits.sort((a, b) => {
    const r = rank(a.field) - rank(b.field);
    if (r !== 0) return r;
    return a.page.title.localeCompare(b.page.title);
  });

  return hits.slice(0, limit);
}
