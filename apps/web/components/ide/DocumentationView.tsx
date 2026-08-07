'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getDefaultDocSlug,
  getDocTree,
  registerDocsCommands,
} from '@/lib/docs';
import { DocMarkdown } from './DocMarkdown';
import { DocSidebar } from './DocSidebar';
import { DocToc } from './DocToc';
import { cn } from '@/lib/cn';

type DocumentationViewProps = {
  /** Initial slug override (e.g. from URL). */
  initialSlug?: string;
  className?: string;
  /** Compact mode when embedded in mobile full-bleed. */
  compact?: boolean;
};

export function DocumentationView({
  initialSlug,
  className,
  compact = false,
}: DocumentationViewProps) {
  const tree = useMemo(() => getDocTree(), []);
  const [activeSlug, setActiveSlug] = useState(
    () => initialSlug || getDefaultDocSlug(),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingHash, setPendingHash] = useState<string | undefined>();

  const page = tree.pagesBySlug.get(activeSlug) ?? tree.categories[0]?.pages[0];

  useEffect(() => {
    registerDocsCommands({
      'docs.open': () => undefined,
      'docs.search': () => {
        const el = document.querySelector<HTMLInputElement>(
          '[data-testid="doc-search"]',
        );
        el?.focus();
      },
      'docs.goHome': () => setActiveSlug(getDefaultDocSlug()),
    });
  }, []);

  useEffect(() => {
    if (!pendingHash) return;
    const id = pendingHash;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'start' });
      setPendingHash(undefined);
    }, 40);
    return () => window.clearTimeout(t);
  }, [pendingHash, activeSlug]);

  const navigate = useCallback((slug: string, hash?: string) => {
    setActiveSlug(slug);
    setSearchQuery('');
    if (hash) setPendingHash(hash);
  }, []);

  if (!page) {
    return (
      <div className="grid h-full place-items-center text-[13px] text-pp-muted">
        No documentation pages found.
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-full min-h-0 bg-pp-editor',
        className,
      )}
      data-testid="documentation-view"
      role="region"
      aria-label="Documentation viewer"
    >
      {!compact && (
        <aside className="flex w-[240px] shrink-0 flex-col border-r border-pp-line bg-pp-shell md:w-[260px]">
          <DocSidebar
            tree={tree}
            activeSlug={page.slug}
            onSelect={(slug) => navigate(slug)}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
          />
        </aside>
      )}

      <div className="flex min-w-0 flex-1">
        <div className="min-h-0 flex-1 overflow-auto px-5 py-5 md:px-8 md:py-7">
          {compact && (
            <div className="mb-4">
              <DocSidebar
                tree={tree}
                activeSlug={page.slug}
                onSelect={(slug) => navigate(slug)}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
              />
            </div>
          )}
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.05em] text-pp-faint">
            {page.categoryLabel}
          </p>
          <DocMarkdown
            content={page.content}
            fromPath={page.path}
            tree={tree}
            onNavigate={navigate}
          />
        </div>
        {!compact && (
          <div className="hidden w-[180px] shrink-0 overflow-auto py-7 pr-4 xl:block">
            <DocToc page={page} />
          </div>
        )}
      </div>
    </div>
  );
}
