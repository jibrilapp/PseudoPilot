'use client';

import type { ReactNode } from 'react';
import { IconBug, IconFiles, IconSearch, IconSpark } from './Icons';
import { cn } from '@/lib/cn';

export type ActivityId = 'explorer' | 'search' | 'debug' | 'ai';

const ITEMS: { id: ActivityId; label: string; icon: ReactNode }[] = [
  { id: 'explorer', label: 'Explorer', icon: <IconFiles /> },
  { id: 'search', label: 'Search', icon: <IconSearch /> },
  { id: 'debug', label: 'Debug', icon: <IconBug /> },
  { id: 'ai', label: 'AI Coach', icon: <IconSpark /> },
];

type ActivityBarProps = {
  active: ActivityId;
  onChange: (id: ActivityId) => void;
};

export function ActivityBar({ active, onChange }: ActivityBarProps) {
  return (
    <nav
      aria-label="Activity"
      className="flex w-12 shrink-0 flex-col items-center gap-0.5 border-r border-pp-line bg-pp-shell py-2.5"
    >
      {ITEMS.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            title={item.label}
            aria-label={item.label}
            aria-current={isActive ? 'true' : undefined}
            onClick={() => onChange(item.id)}
            className={cn(
              'relative grid h-9 w-9 place-items-center rounded-[9px] text-pp-faint',
              'transition-[color,background-color] duration-150 ease-apple',
              'hover:bg-black/[0.04] hover:text-pp-ink',
              isActive && 'bg-white text-pp-ink shadow-[0_1px_2px_rgba(15,23,42,0.06)]',
            )}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-pp-accent" />
            )}
            {item.icon}
          </button>
        );
      })}
    </nav>
  );
}
