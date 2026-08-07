'use client';

import type { ReactNode } from 'react';
import { IconFiles, IconSpark, IconTerminal, IconVars, IconSplit } from './Icons';
import { cn } from '@/lib/cn';
import { withoutAiCoachEntry } from '@/lib/featureFlags';

type MobileView = 'explorer' | 'editors' | 'console' | 'ai' | 'vars' | 'docs';

const ALL_ITEMS: {
  id: Exclude<MobileView, 'docs'>;
  label: string;
  icon: ReactNode;
}[] = [
  { id: 'explorer', label: 'Program', icon: <IconFiles /> },
  { id: 'editors', label: 'Code', icon: <IconSplit /> },
  { id: 'console', label: 'Console', icon: <IconTerminal /> },
  { id: 'ai', label: 'AI', icon: <IconSpark /> },
  { id: 'vars', label: 'Vars', icon: <IconVars /> },
];

const ITEMS = withoutAiCoachEntry(ALL_ITEMS);

type MobileDockProps = {
  active: MobileView;
  onChange: (view: MobileView) => void;
};

export function MobileDock({ active, onChange }: MobileDockProps) {
  return (
    <nav
      aria-label="Mobile views"
      className="z-30 flex shrink-0 border-t border-pp-line bg-pp-panel/95 px-1.5 py-1.5 backdrop-blur-xl md:hidden"
    >
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            'flex flex-1 flex-col items-center gap-0.5 rounded-[10px] py-1.5 text-[10px] font-medium tracking-[-0.01em]',
            'transition-colors duration-150 ease-apple',
            active === item.id ? 'bg-pp-accentSoft text-pp-accent' : 'text-pp-faint',
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  );
}
