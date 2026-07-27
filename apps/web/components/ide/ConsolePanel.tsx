'use client';

import type { ConsoleLine } from '@/lib/dummy';
import type { IdeDiagnostic } from '@/lib/translation/types';
import { cn } from '@/lib/cn';

type ConsolePanelProps = {
  lines?: ConsoleLine[];
  diagnostics?: IdeDiagnostic[];
};

export function ConsolePanel({ lines = [], diagnostics = [] }: ConsolePanelProps) {
  const hasDiagnostics = diagnostics.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-pp-console text-pp-consoleFg">
      <div className="flex h-8 items-center gap-2.5 border-b border-white/[0.06] px-3.5">
        <h2 className="text-[12px] font-medium tracking-[-0.01em] text-white/55">
          {hasDiagnostics ? 'Diagnostics' : 'Console'}
        </h2>
        <span className="text-[11px] text-white/30">
          {hasDiagnostics ? 'Translation' : 'Output'}
        </span>
        {hasDiagnostics && (
          <span
            className={cn(
              'ml-auto text-[11px]',
              diagnostics.some((d) => d.severity === 'error')
                ? 'text-rose-300/80'
                : 'text-amber-300/80',
            )}
          >
            {diagnostics.length} issue{diagnostics.length === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3.5 py-2.5 font-mono text-[12.5px] leading-[1.65]">
        {hasDiagnostics ? (
          diagnostics.map((d) => (
            <div key={d.id} className="flex gap-3">
              <span
                className={cn(
                  'w-4 shrink-0 select-none',
                  d.severity === 'warning' ? 'text-amber-300/70' : 'text-rose-300/70',
                )}
              >
                {d.severity === 'warning' ? '~' : '!'}
              </span>
              <span
                className={
                  d.severity === 'warning' ? 'text-amber-200/90' : 'text-rose-300/90'
                }
              >
                <span className="text-white/40">[{d.code}]</span>{' '}
                {d.line != null ? `Line ${d.line}: ` : ''}
                {d.message}
                {d.help ? (
                  <span className="text-white/45"> — {d.help}</span>
                ) : null}
              </span>
            </div>
          ))
        ) : lines.length > 0 ? (
          lines.map((line) => (
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
          ))
        ) : (
          <div className="flex gap-3 text-white/35">
            <span className="w-4 shrink-0">·</span>
            <span>No translation issues. Edit pseudocode to update Python.</span>
          </div>
        )}
        <div className="mt-1.5 flex gap-3 text-white/40">
          <span className="w-4 shrink-0">›</span>
          <span className="inline-block h-[14px] w-[7px] bg-emerald-300/70 animate-caret" />
        </div>
      </div>
    </div>
  );
}
