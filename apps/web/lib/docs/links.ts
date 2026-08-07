/**
 * Resolve and validate relative markdown links against the discovered corpus.
 */

import { pathToSlug } from './discover';
import type { DocLinkCheck, DocNavTree } from './types';

const MD_LINK = /(?<!!)\[([^\]]*)\]\(([^)]+)\)/g;

export function isExternalHref(href: string): boolean {
  return /^(https?:|mailto:|tel:)/i.test(href);
}

export function splitHref(href: string): { path: string; hash: string } {
  const hashIdx = href.indexOf('#');
  if (hashIdx < 0) return { path: href, hash: '' };
  return { path: href.slice(0, hashIdx), hash: href.slice(hashIdx + 1) };
}

/**
 * Resolve a relative link from `fromPath` (docs-relative, e.g. `ide/UI.md`)
 * to a corpus path or slug.
 */
export function resolveDocHref(
  fromPath: string,
  href: string,
  tree: DocNavTree,
): { slug: string; hash: string } | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    const page = tree.pagesByPath.get(fromPath);
    if (!page) return null;
    return { slug: page.slug, hash: trimmed.replace(/^#/, '') };
  }
  if (isExternalHref(trimmed)) return null;

  const { path: rawPath, hash } = splitHref(trimmed);
  if (!rawPath) {
    const page = tree.pagesByPath.get(fromPath);
    if (!page) return null;
    return { slug: page.slug, hash };
  }

  // Absolute-from-docs root: /language/SPECIFICATION.md
  let target: string;
  if (rawPath.startsWith('/')) {
    target = rawPath.slice(1);
  } else {
    const fromDir = fromPath.includes('/')
      ? fromPath.slice(0, fromPath.lastIndexOf('/'))
      : '';
    const joined = fromDir ? `${fromDir}/${rawPath}` : rawPath;
    target = normalizePosix(joined);
  }

  if (!target.toLowerCase().endsWith('.md')) {
    // Allow linking without extension
    const withMd = `${target}.md`;
    if (tree.pagesByPath.has(withMd)) {
      return { slug: pathToSlug(withMd), hash };
    }
    const bySlug = tree.pagesBySlug.get(pathToSlug(target));
    if (bySlug) return { slug: bySlug.slug, hash };
  }

  if (tree.pagesByPath.has(target)) {
    return { slug: pathToSlug(target), hash };
  }

  // Case-insensitive fallback
  const lower = target.toLowerCase();
  for (const [p, page] of tree.pagesByPath) {
    if (p.toLowerCase() === lower) return { slug: page.slug, hash };
  }
  return null;
}

function normalizePosix(p: string): string {
  const parts = p.split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out.join('/');
}

/** Collect relative md links from a page body (docs corpus only). */
export function extractRelativeMdHrefs(markdown: string): string[] {
  const hrefs: string[] = [];
  const re = new RegExp(MD_LINK.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const href = m[2].trim();
    if (!href || isExternalHref(href) || href.startsWith('#')) continue;
    if (href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    if (/\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(href)) continue;
    // Source / package links outside docs/ are not part of the help corpus.
    if (!isDocsCorpusHref(href)) continue;
    hrefs.push(href);
  }
  return hrefs;
}

/** True when a relative href is intended to target another docs markdown page. */
export function isDocsCorpusHref(href: string): boolean {
  const { path: raw } = splitHref(href.trim());
  if (!raw) return false;
  // Escape to packages/, apps/, etc.
  if (/(^|\/)\.\.(\/|$)/.test(raw) && /(\/|^)(packages|apps|node_modules)(\/|$)/.test(raw)) {
    return false;
  }
  if (/\.(ts|tsx|js|jsx|mjs|cjs|json|css)(:\d+)?$/i.test(raw)) return false;
  // Explicit .md or extensionless / README-style paths inside docs.
  if (/\.md$/i.test(raw)) return true;
  // Extensionless relative paths are treated as doc pages.
  if (!/\.[a-z0-9]+$/i.test(raw)) return true;
  return false;
}

export function findBrokenDocLinks(tree: DocNavTree): DocLinkCheck[] {
  const broken: DocLinkCheck[] = [];
  for (const [, page] of tree.pagesByPath) {
    for (const href of extractRelativeMdHrefs(page.content)) {
      const resolved = resolveDocHref(page.path, href, tree);
      if (!resolved) {
        broken.push({
          fromPath: page.path,
          href,
          resolved: null,
          ok: false,
        });
      }
    }
  }
  return broken;
}

export function resolveDocImageSrc(fromPath: string, src: string): string {
  if (isExternalHref(src) || src.startsWith('data:')) return src;
  const { path: rawPath } = splitHref(src);
  let target: string;
  if (rawPath.startsWith('/')) {
    target = rawPath.slice(1);
  } else {
    const fromDir = fromPath.includes('/')
      ? fromPath.slice(0, fromPath.lastIndexOf('/'))
      : '';
    const joined = fromDir ? `${fromDir}/${rawPath}` : rawPath;
    target = normalizePosix(joined);
  }
  return `/api/docs-asset?path=${encodeURIComponent(target)}`;
}
