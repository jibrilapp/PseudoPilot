'use client';

import type { ReactNode } from 'react';
import { IconBook, IconBug, IconFiles, IconSearch, IconSpark } from './Icons';
import { cn } from '@/lib/cn';
import { withoutAiCoachEntry } from '@/lib/featureFlags';

export type ActivityId = 'explorer' | 'search' | 'debug' | 'ai' | 'docs';

const ALL_ITEMS: { id: ActivityId; label: string; icon: ReactNode }[] = [
  { id: 'explorer', label: 'Program', icon: <IconFiles /> },
  { id: 'search', label: 'Search', icon: <IconSearch /> },
  { id: 'debug', label: 'Debug', icon: <IconBug /> },
  { id: 'ai', label: 'AI Coach', icon: <IconSpark /> },
  { id: 'docs', label: 'Documentation', icon: <IconBook /> },
];

const ITEMS = withoutAiCoachEntry(ALL_ITEMS);

type ActivityBarProps = {
  active: ActivityId;
  onChange: (id: ActivityId) => void;
};

export function ActivityBar({ active, onChange }: ActivityBarProps) {
  return (
    <nav
      aria-label="Activity"
      className="flex w-12 shrink-0 flex-col items-center gap-0.5 border-r border-pp-line bg-pp-shell py-2.5"
      data-testid="activity-bar"
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
            data-testid={item.id === 'docs' ? 'activity-docs' : undefined}
            onClick={() => onChange(item.id)}
            className={cn(
              'relative grid h-9 w-9 place-items-center rounded-[9px] text-pp-faint',
              'transition-[color,background-color,box-shadow] duration-150 ease-apple',
              'hover:bg-black/[0.04] hover:text-pp-ink',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent/45',
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
