'use client';

import { useState } from 'react';
import type { FileNode } from '@/lib/dummy';
import { IconChevron, IconFile } from './Icons';
import { cn } from '@/lib/cn';

type FileExplorerProps = {
  tree: FileNode[];
  activeId: string;
  onSelect: (id: string) => void;
};

export function FileExplorer({ tree, activeId, onSelect }: FileExplorerProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 pb-3 pt-4">
        <p className="pp-section-label mb-2">Workspace</p>
        <p className="truncate text-[13px] font-semibold tracking-[-0.02em] text-pp-ink">
          loops-lab
        </p>
        <p className="mt-0.5 text-[12px] text-pp-muted">Cambridge 9618 · preview</p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-2 pb-4">
        {tree.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            activeId={activeId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function TreeNode({
  node,
  depth,
  activeId,
  onSelect,
}: {
  node: FileNode;
  depth: number;
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const isFolder = node.type === 'folder';
  const active = activeId === node.id;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (isFolder) setOpen((v) => !v);
          else onSelect(node.id);
        }}
        className={cn(
          'group flex w-full items-center gap-1.5 rounded-[8px] py-[5px] pr-2 text-left text-[13px] tracking-[-0.01em]',
          'transition-colors duration-150 ease-apple',
          active
            ? 'bg-pp-accentSoft font-medium text-pp-accent'
            : 'text-pp-ink/90 hover:bg-black/[0.035]',
        )}
        style={{ paddingLeft: 10 + depth * 12 }}
      >
        {isFolder ? (
          <IconChevron
            className={cn(
              'shrink-0 text-pp-faint transition-transform duration-150 ease-apple',
              open && 'rotate-90',
            )}
          />
        ) : (
          <IconFile className="shrink-0 text-pp-faint group-hover:text-pp-muted" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {isFolder &&
        open &&
        node.children?.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            activeId={activeId}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}
