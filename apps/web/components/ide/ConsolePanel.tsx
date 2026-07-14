'use client';

import type { ConsoleLine } from '@/lib/dummy';
import { cn } from '@/lib/cn';

type ConsolePanelProps = {
  lines: ConsoleLine[];
};

export function ConsolePanel({ lines }: ConsolePanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-pp-console text-pp-consoleFg">
      <div className="flex h-8 items-center gap-2.5 border-b border-white/[0.06] px-3.5">
        <h2 className="text-[12px] font-medium tracking-[-0.01em] text-white/55">Console</h2>
        <span className="text-[11px] text-white/30">Output</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3.5 py-2.5 font-mono text-[12.5px] leading-[1.65]">
        {lines.map((line) => (
          <div key={line.id} className="flex gap-3">
            <span className="w-4 shrink-0 select-none text-white/25">
              {line.kind === 'info' ? '·' : line.kind === 'error' ? '!' : ''}
            </span>
            <span
              className={cn(
                line.kind === 'info' && 'text-emerald-300/80',
                line.kind === 'error' && 'text-rose-300/90',
                line.kind === 'in' && 'text-sky-200/90',
                line.kind === 'out' && 'text-pp-consoleFg',
              )}
            >
              {line.text}
            </span>
          </div>
        ))}
        <div className="mt-1.5 flex gap-3 text-white/40">
          <span className="w-4 shrink-0">›</span>
          <span className="inline-block h-[14px] w-[7px] bg-emerald-300/70 animate-caret" />
        </div>
      </div>
    </div>
  );
}
