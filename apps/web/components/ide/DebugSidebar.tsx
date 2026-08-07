'use client';

import type { Breakpoint, CallStackFrameView } from '@/lib/debugger';
import { cn } from '@/lib/cn';

type DebugSidebarProps = {
  breakpoints: readonly Breakpoint[];
  callStack: readonly CallStackFrameView[];
  pausedLine: number | null;
  onRemoveBreakpoint: (line: number) => void;
  onSetBreakpointEnabled: (line: number, enabled: boolean) => void;
  onRevealLine?: (line: number) => void;
};

/**
 * Breakpoints + call stack panel (Activity → Debug).
 * Frame click-to-select is reserved for a future milestone.
 */
export function DebugSidebar({
  breakpoints,
  callStack,
  pausedLine,
  onRemoveBreakpoint,
  onSetBreakpointEnabled,
  onRevealLine,
}: DebugSidebarProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-pp-panel">
      <div className="border-b border-pp-line px-4 pb-3 pt-4">
        <p className="pp-section-label mb-1.5">Debugger</p>
        <h2 className="text-[13px] font-semibold tracking-[-0.02em] text-pp-ink">
          Breakpoints
        </h2>
        <p className="mt-0.5 text-[12px] text-pp-muted">
          Click a gutter dot in the editor, or manage them here.
        </p>
        {pausedLine != null && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-400/15 px-2 py-1 text-[11px] font-medium text-amber-900/80">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
            Paused at line {pausedLine}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        {breakpoints.length === 0 ? (
          <p className="pp-empty">No breakpoints yet.</p>
        ) : (
          <ul className="space-y-0.5" aria-label="Breakpoints">
            {breakpoints.map((bp) => (
              <li
                key={bp.id}
                className={cn(
                  'group flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-[12.5px]',
                  'transition-colors duration-150',
                  pausedLine === bp.line
                    ? 'bg-amber-400/15'
                    : 'hover:bg-black/[0.03]',
                )}
              >
                <button
                  type="button"
                  className={cn(
                    'h-2.5 w-2.5 shrink-0 rounded-full transition-shadow',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent/40',
                    bp.enabled
                      ? 'bg-rose-500'
                      : 'bg-transparent ring-1 ring-rose-400/50',
                  )}
                  title={bp.enabled ? 'Disable breakpoint' : 'Enable breakpoint'}
                  aria-pressed={bp.enabled}
                  onClick={() => onSetBreakpointEnabled(bp.line, !bp.enabled)}
                />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left font-mono text-pp-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent/40"
                  onClick={() => onRevealLine?.(bp.line)}
                >
                  Line {bp.line}
                  {!bp.enabled && (
                    <span className="ml-2 text-[11px] text-pp-faint">disabled</span>
                  )}
                </button>
                <button
                  type="button"
                  className="rounded px-1 text-[11px] text-pp-faint opacity-0 transition-opacity hover:text-pp-ink group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent/40"
                  onClick={() => onRemoveBreakpoint(bp.line)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-pp-line px-4 pb-2 pt-3">
        <h2 className="text-[13px] font-semibold tracking-[-0.02em] text-pp-ink">
          Call stack
        </h2>
        <p className="mt-0.5 text-[12px] text-pp-muted">
          Top frame is current.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-3">
        {callStack.length === 0 ? (
          <p className="pp-empty">Empty — pause or hit a breakpoint to inspect.</p>
        ) : (
          <ol className="space-y-0.5" aria-label="Call stack">
            {callStack.map((frame, index) => (
              <li
                key={`${frame.id}-${index}`}
                className={cn(
                  'rounded-[8px] px-2.5 py-2 transition-colors',
                  index === 0
                    ? 'bg-pp-accentSoft shadow-[inset_0_0_0_1px_rgba(13,115,112,0.12)]'
                    : 'hover:bg-black/[0.025]',
                )}
              >
                <div className="flex items-baseline gap-2 font-mono text-[12.5px] font-medium text-pp-ink">
                  {index === 0 && (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-pp-accent">
                      Current
                    </span>
                  )}
                  <span>{frame.name}</span>
                  <span className="text-[11px] font-normal text-pp-faint">
                    {frame.kind}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-pp-muted">
                  {frame.line != null ? (
                    <button
                      type="button"
                      className="font-mono hover:text-pp-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent/40"
                      onClick={() => onRevealLine?.(frame.line!)}
                    >
                      Line {frame.line}
                    </button>
                  ) : (
                    '—'
                  )}
                  {frame.args.length > 0 && (
                    <span className="ml-2 font-mono">
                      (
                      {frame.args.map((a) => `${a.name}=${a.value}`).join(', ')}
                      )
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
