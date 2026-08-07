'use client';

import type { CoachMdInline, CoachMdNode } from '@/lib/ide/coachMarkdown';
import { parseCoachMarkdown } from '@/lib/ide/coachMarkdown';
import { cn } from '@/lib/cn';

type CoachMarkdownProps = {
  content: string;
  className?: string;
};

export function CoachMarkdown({ content, className }: CoachMarkdownProps) {
  const nodes = parseCoachMarkdown(content);
  return (
    <div className={cn('space-y-2.5', className)}>
      {nodes.map((node, i) => (
        <CoachBlock key={i} node={node} />
      ))}
    </div>
  );
}

function CoachBlock({ node }: { node: CoachMdNode }) {
  if (node.type === 'code') {
    return (
      <pre
        className={cn(
          'overflow-x-auto rounded-[10px] border border-pp-line bg-pp-shell px-3 py-2.5',
          'font-mono text-[12px] leading-[1.55] text-pp-ink',
        )}
      >
        {node.lang && (
          <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.06em] text-pp-faint">
            {node.lang}
          </span>
        )}
        <code>{node.value}</code>
      </pre>
    );
  }
  return (
    <p className="text-[13px] leading-[1.55] tracking-[-0.01em]">
      {node.children.map((c, i) => (
        <Inline key={i} node={c} />
      ))}
    </p>
  );
}

function Inline({ node }: { node: CoachMdInline }) {
  switch (node.type) {
    case 'code':
      return (
        <code className="rounded-[5px] bg-black/[0.05] px-1 py-0.5 font-mono text-[12px]">
          {node.value}
        </code>
      );
    case 'strong':
      return <strong className="font-semibold">{node.value}</strong>;
    case 'em':
      return <em>{node.value}</em>;
    default:
      return <>{node.value}</>;
  }
}
