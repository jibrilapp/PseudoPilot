'use client';

import { useCallback, useState } from 'react';
import type { DocMdBlock, DocMdInline } from '@/lib/docs/parseDocMarkdown';
import { parseDocMarkdown } from '@/lib/docs/parseDocMarkdown';
import { highlightCode } from '@/lib/docs/highlight';
import {
  isDocsCorpusHref,
  isExternalHref,
  resolveDocHref,
  resolveDocImageSrc,
} from '@/lib/docs/links';
import type { DocNavTree } from '@/lib/docs/types';
import { cn } from '@/lib/cn';

type DocMarkdownProps = {
  content: string;
  fromPath: string;
  tree: DocNavTree;
  onNavigate: (slug: string, hash?: string) => void;
  className?: string;
};

export function DocMarkdown({
  content,
  fromPath,
  tree,
  onNavigate,
  className,
}: DocMarkdownProps) {
  const blocks = parseDocMarkdown(content);
  return (
    <article
      className={cn('pp-doc-prose max-w-3xl', className)}
      data-testid="doc-markdown"
    >
      {blocks.map((block, i) => (
        <DocBlock
          key={i}
          block={block}
          fromPath={fromPath}
          tree={tree}
          onNavigate={onNavigate}
        />
      ))}
    </article>
  );
}

function DocBlock({
  block,
  fromPath,
  tree,
  onNavigate,
}: {
  block: DocMdBlock;
  fromPath: string;
  tree: DocNavTree;
  onNavigate: (slug: string, hash?: string) => void;
}) {
  switch (block.type) {
    case 'heading': {
      const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      const sizes: Record<number, string> = {
        1: 'text-[26px] font-semibold tracking-[-0.03em] mt-2 mb-3',
        2: 'text-[18px] font-semibold tracking-[-0.02em] mt-7 mb-2',
        3: 'text-[15px] font-semibold tracking-[-0.02em] mt-5 mb-1.5',
        4: 'text-[13.5px] font-semibold mt-4 mb-1',
        5: 'text-[13px] font-semibold mt-3 mb-1',
        6: 'text-[12.5px] font-semibold mt-3 mb-1 text-pp-muted',
      };
      return (
        <Tag id={block.id} className={cn('scroll-mt-4 text-pp-ink', sizes[block.level])}>
          <InlineNodes
            nodes={block.children}
            fromPath={fromPath}
            tree={tree}
            onNavigate={onNavigate}
          />
        </Tag>
      );
    }
    case 'paragraph':
      return (
        <p className="mb-3 text-[13.5px] leading-[1.65] text-pp-ink/90">
          <InlineNodes
            nodes={block.children}
            fromPath={fromPath}
            tree={tree}
            onNavigate={onNavigate}
          />
        </p>
      );
    case 'code':
      return <CodeBlock lang={block.lang} value={block.value} />;
    case 'blockquote':
      return (
        <aside
          className={cn(
            'mb-4 rounded-[10px] border border-pp-line bg-pp-shell/80 px-3.5 py-2.5',
            block.callout === 'warning' || block.callout === 'caution'
              ? 'border-amber-300/70 bg-amber-50/50'
              : block.callout === 'tip'
                ? 'border-pp-accent/30 bg-pp-accentSoft/40'
                : null,
          )}
          data-callout={block.callout ?? undefined}
        >
          {block.children.map((c, i) => (
            <DocBlock
              key={i}
              block={c}
              fromPath={fromPath}
              tree={tree}
              onNavigate={onNavigate}
            />
          ))}
        </aside>
      );
    case 'ul':
      return (
        <ul className="mb-3 list-disc space-y-1 pl-5 text-[13.5px] leading-[1.6] text-pp-ink/90">
          {block.items.map((item, i) => (
            <li key={i}>
              <InlineNodes
                nodes={item}
                fromPath={fromPath}
                tree={tree}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol className="mb-3 list-decimal space-y-1 pl-5 text-[13.5px] leading-[1.6] text-pp-ink/90">
          {block.items.map((item, i) => (
            <li key={i}>
              <InlineNodes
                nodes={item}
                fromPath={fromPath}
                tree={tree}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ol>
      );
    case 'table':
      return (
        <div className="mb-4 overflow-x-auto rounded-[10px] border border-pp-line">
          <table className="w-full border-collapse text-left text-[12.5px]">
            <thead className="bg-pp-shell">
              <tr>
                {block.header.map((cell, i) => (
                  <th
                    key={i}
                    className="border-b border-pp-line px-3 py-2 font-semibold text-pp-ink"
                  >
                    <InlineNodes
                      nodes={cell}
                      fromPath={fromPath}
                      tree={tree}
                      onNavigate={onNavigate}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="odd:bg-white even:bg-pp-shell/40">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="border-b border-pp-line/70 px-3 py-1.5 text-pp-ink/90"
                    >
                      <InlineNodes
                        nodes={cell}
                        fromPath={fromPath}
                        tree={tree}
                        onNavigate={onNavigate}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'hr':
      return <hr className="my-6 border-pp-line" />;
    default:
      return null;
  }
}

function InlineNodes({
  nodes,
  fromPath,
  tree,
  onNavigate,
}: {
  nodes: DocMdInline[];
  fromPath: string;
  tree: DocNavTree;
  onNavigate: (slug: string, hash?: string) => void;
}) {
  return (
    <>
      {nodes.map((n, i) => (
        <Inline
          key={i}
          node={n}
          fromPath={fromPath}
          tree={tree}
          onNavigate={onNavigate}
        />
      ))}
    </>
  );
}

function Inline({
  node,
  fromPath,
  tree,
  onNavigate,
}: {
  node: DocMdInline;
  fromPath: string;
  tree: DocNavTree;
  onNavigate: (slug: string, hash?: string) => void;
}) {
  switch (node.type) {
    case 'text':
      return <>{node.value}</>;
    case 'code':
      return (
        <code className="rounded-[5px] bg-black/[0.05] px-1 py-0.5 font-mono text-[12px]">
          {node.value}
        </code>
      );
    case 'strong':
      return (
        <strong className="font-semibold">
          <InlineNodes
            nodes={node.children}
            fromPath={fromPath}
            tree={tree}
            onNavigate={onNavigate}
          />
        </strong>
      );
    case 'em':
      return (
        <em>
          <InlineNodes
            nodes={node.children}
            fromPath={fromPath}
            tree={tree}
            onNavigate={onNavigate}
          />
        </em>
      );
    case 'link': {
      if (isExternalHref(node.href)) {
        return (
          <a
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-pp-accent underline decoration-pp-accent/30 underline-offset-2 hover:decoration-pp-accent"
          >
            <InlineNodes
              nodes={node.children}
              fromPath={fromPath}
              tree={tree}
              onNavigate={onNavigate}
            />
          </a>
        );
      }
      const resolved = resolveDocHref(fromPath, node.href, tree);
      if (resolved) {
        return (
          <button
            type="button"
            className="text-pp-accent underline decoration-pp-accent/30 underline-offset-2 hover:decoration-pp-accent"
            onClick={() => onNavigate(resolved.slug, resolved.hash || undefined)}
          >
            <InlineNodes
              nodes={node.children}
              fromPath={fromPath}
              tree={tree}
              onNavigate={onNavigate}
            />
          </button>
        );
      }
      // Source / package paths outside the docs corpus — show as plain reference.
      if (!isDocsCorpusHref(node.href)) {
        return (
          <code
            className="rounded-[5px] bg-black/[0.04] px-1 py-0.5 font-mono text-[12px] text-pp-muted"
            title={node.href}
          >
            <InlineNodes
              nodes={node.children}
              fromPath={fromPath}
              tree={tree}
              onNavigate={onNavigate}
            />
          </code>
        );
      }
      return (
        <span className="text-rose-600/80" title={`Broken link: ${node.href}`}>
          <InlineNodes
            nodes={node.children}
            fromPath={fromPath}
            tree={tree}
            onNavigate={onNavigate}
          />
        </span>
      );
    }
    case 'image': {
      const src = resolveDocImageSrc(fromPath, node.src);
      return (
        <img
          src={src}
          alt={node.alt}
          className="my-3 max-w-full rounded-[10px] border border-pp-line"
        />
      );
    }
    default:
      return null;
  }
}

function CodeBlock({ lang, value }: { lang: string | null; value: string }) {
  const [copied, setCopied] = useState(false);
  const tokens = highlightCode(value, lang);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }, [value]);

  const tokenClass: Record<string, string> = {
    keyword: 'text-pp-accent font-medium',
    string: 'text-emerald-700',
    comment: 'text-pp-faint italic',
    number: 'text-amber-700',
    punct: 'text-pp-muted',
    plain: 'text-pp-ink',
  };

  return (
    <div className="group relative mb-4 overflow-hidden rounded-[10px] border border-pp-line bg-pp-shell">
      <div className="flex items-center justify-between border-b border-pp-line px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-pp-faint">
          {lang || 'text'}
        </span>
        <button
          type="button"
          onClick={() => void onCopy()}
          className="rounded-[6px] px-1.5 py-0.5 text-[11px] text-pp-muted opacity-0 transition-opacity hover:bg-black/[0.04] hover:text-pp-ink group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent/45"
          aria-label="Copy code"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[12px] leading-[1.55]">
        <code>
          {tokens.map((t, i) => (
            <span key={i} className={tokenClass[t.type] ?? 'text-pp-ink'}>
              {t.value}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
