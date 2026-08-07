'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { DocCategory, DocNavTree, DocPage, DocSearchHit } from '@/lib/docs/types';
import { highlightSegments, searchDocs } from '@/lib/docs/search';
import { IconChevron, IconSearch } from './Icons';
import { cn } from '@/lib/cn';

type DocSidebarProps = {
  tree: DocNavTree;
  activeSlug: string;
  onSelect: (slug: string) => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
};

export function DocSidebar({
  tree,
  activeSlug,
  onSelect,
  searchQuery,
  onSearchQueryChange,
}: DocSidebarProps) {
  const searchId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const hits = useMemo(
    () => (searchQuery.trim() ? searchDocs(tree, searchQuery) : []),
    [tree, searchQuery],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f' && e.shiftKey) {
        // Docs search focus — palette stub companion
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-testid="doc-sidebar"
      role="navigation"
      aria-label="Documentation"
    >
      <div className="px-3 pb-2 pt-4">
        <p className="pp-section-label mb-2">Documentation</p>
        <label htmlFor={searchId} className="sr-only">
          Search documentation
        </label>
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-pp-faint" />
          <input
            ref={inputRef}
            id={searchId}
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search docs…"
            data-testid="doc-search"
            className={cn(
              'w-full rounded-[9px] border border-pp-line bg-white py-1.5 pl-8 pr-2.5',
              'text-[13px] text-pp-ink placeholder:text-pp-faint',
              'outline-none transition-[border-color,box-shadow] duration-150',
              'focus:border-pp-accent/40 focus:ring-2 focus:ring-pp-accent/25',
            )}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-2 pb-4">
        {searchQuery.trim() ? (
          <SearchResults
            hits={hits}
            query={searchQuery}
            activeSlug={activeSlug}
            onSelect={onSelect}
          />
        ) : (
          tree.categories.map((cat) => (
            <CategoryGroup
              key={cat.id}
              category={cat}
              activeSlug={activeSlug}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

function SearchResults({
  hits,
  query,
  activeSlug,
  onSelect,
}: {
  hits: DocSearchHit[];
  query: string;
  activeSlug: string;
  onSelect: (slug: string) => void;
}) {
  if (hits.length === 0) {
    return (
      <p className="px-2 py-3 text-[12.5px] text-pp-muted" data-testid="doc-search-empty">
        No matches for “{query.trim()}”.
      </p>
    );
  }
  return (
    <ul className="space-y-0.5" data-testid="doc-search-results" role="listbox">
      {hits.map((hit) => {
        const active = hit.page.slug === activeSlug;
        return (
          <li key={`${hit.page.slug}:${hit.field}:${hit.headingId ?? ''}`}>
            <button
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onSelect(hit.page.slug)}
              className={cn(
                'flex w-full flex-col gap-0.5 rounded-[8px] px-2.5 py-2 text-left',
                'transition-colors duration-150 ease-apple',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent/40',
                active
                  ? 'bg-pp-accentSoft text-pp-accent'
                  : 'hover:bg-black/[0.035]',
              )}
            >
              <span className="text-[12.5px] font-medium tracking-[-0.01em]">
                <Highlight text={hit.page.title} query={query} />
              </span>
              <span className="text-[11px] text-pp-muted">
                {hit.page.categoryLabel}
                {hit.field !== 'title' ? ` · ${hit.field}` : ''}
              </span>
              {hit.field !== 'title' && (
                <span className="line-clamp-2 text-[11.5px] text-pp-faint">
                  <Highlight text={hit.snippet} query={query} />
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightSegments(text, query).map((seg, i) =>
        seg.match ? (
          <mark
            key={i}
            className="rounded-[2px] bg-amber-200/80 px-0.5 text-inherit"
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}

function CategoryGroup({
  category,
  activeSlug,
  onSelect,
}: {
  category: DocCategory;
  activeSlug: string;
  onSelect: (slug: string) => void;
}) {
  const containsActive = category.pages.some((p) => p.slug === activeSlug);
  const [open, setOpen] = useState(containsActive || category.id === '_root');

  useEffect(() => {
    if (containsActive) setOpen(true);
  }, [containsActive]);

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-1 rounded-[8px] px-2 py-1.5 text-left',
          'text-[11px] font-semibold uppercase tracking-[0.05em] text-pp-faint',
          'hover:bg-black/[0.03] hover:text-pp-muted',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent/40',
        )}
      >
        <IconChevron
          className={cn(
            'shrink-0 transition-transform duration-150',
            open && 'rotate-90',
          )}
        />
        {category.label}
      </button>
      {open && (
        <ul className="mt-0.5 space-y-0.5 pb-1">
          {category.pages.map((page) => (
            <PageLink
              key={page.slug}
              page={page}
              active={page.slug === activeSlug}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PageLink({
  page,
  active,
  onSelect,
}: {
  page: DocPage;
  active: boolean;
  onSelect: (slug: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(page.slug)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'w-full rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] tracking-[-0.01em]',
          'transition-colors duration-150 ease-apple',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent/40',
          active
            ? 'bg-pp-accentSoft font-medium text-pp-accent'
            : 'text-pp-ink/90 hover:bg-black/[0.035]',
        )}
      >
        {page.title}
      </button>
    </li>
  );
}
