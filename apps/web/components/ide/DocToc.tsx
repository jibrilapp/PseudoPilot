'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DocHeading, DocPage } from '@/lib/docs/types';
import { cn } from '@/lib/cn';

type DocTocProps = {
  page: DocPage;
  className?: string;
};

export function DocToc({ page, className }: DocTocProps) {
  const headings = useMemo(
    () => page.headings.filter((h) => h.level >= 2 && h.level <= 3),
    [page.headings],
  );
  const [activeId, setActiveId] = useState<string | null>(
    headings[0]?.id ?? null,
  );
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current?.disconnect();
    if (headings.length === 0) return;

    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          if (entry.isIntersecting) {
            visible.set(id, entry.boundingClientRect.top);
          } else {
            visible.delete(id);
          }
        }
        if (visible.size === 0) return;
        let best: string | null = null;
        let bestTop = Infinity;
        for (const [id, top] of visible) {
          const abs = Math.abs(top);
          if (abs < bestTop) {
            bestTop = abs;
            best = id;
          }
        }
        if (best) setActiveId(best);
      },
      { rootMargin: '-12% 0px -70% 0px', threshold: [0, 1] },
    );
    observerRef.current = observer;

    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [headings, page.slug]);

  if (headings.length === 0) return null;

  return (
    <nav
      aria-label="On this page"
      className={cn('hidden xl:block', className)}
      data-testid="doc-toc"
    >
      <p className="pp-section-label mb-2 px-1">On this page</p>
      <ul className="space-y-0.5 border-l border-pp-line">
        {headings.map((h) => (
          <TocItem
            key={h.id}
            heading={h}
            active={activeId === h.id}
          />
        ))}
      </ul>
    </nav>
  );
}

function TocItem({
  heading,
  active,
}: {
  heading: DocHeading;
  active: boolean;
}) {
  return (
    <li>
      <a
        href={`#${heading.id}`}
        onClick={(e) => {
          e.preventDefault();
          document.getElementById(heading.id)?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }}
        className={cn(
          'block border-l-2 py-1 text-[12px] leading-snug transition-colors',
          heading.level === 3 ? 'pl-4' : 'pl-2.5',
          active
            ? '-ml-px border-pp-accent font-medium text-pp-accent'
            : 'border-transparent text-pp-muted hover:text-pp-ink',
        )}
      >
        {heading.text}
      </a>
    </li>
  );
}
