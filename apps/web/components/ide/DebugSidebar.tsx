'use client';

import type { Breakpoint, CallStackFrameView } from '@/lib/debugger';
import { cn } from '@/lib/cn';

type DebugSidebarProps = {
  breakpoints: readonly Breakpoint[];
  callStack: readonly CallStackFrameView[];
  pausedLine: number | null;
  onToggleBreakpoint: (line: number) => void;
  onRemoveBreakpoint: (line: number) => void;
  onSetBreakpointEnabled: (line: number, enabled: boolean) => void;
};

/**
 * Breakpoints + call stack panel (Activity → Debug).
 * Frame click-to-select is reserved for a future milestone.
 */
export function DebugSidebar({
  breakpoints,
  callStack,
  pausedLine,
  onToggleBreakpoint,
  onRemoveBreakpoint,
  onSetBreakpointEnabled,
}: DebugSidebarProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-pp-panel">
      <div className="px-4 pb-2 pt-4">
        <p className="pp-section-label mb-1.5">Debugger</p>
        <h2 className="text-[13px] font-semibold tracking-[-0.02em] text-pp-ink">
          Breakpoints
        </h2>
        <p className="mt-0.5 text-[12px] text-pp-muted">
          Click a gutter dot in the editor, or manage them here.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
        {breakpoints.length === 0 ? (
          <p className="px-2.5 py-2 text-[12px] text-pp-faint">No breakpoints.</p>
        ) : (
          <ul className="space-y-0.5">
            {breakpoints.map((bp) => (
              <li
                key={bp.id}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px]',
                  pausedLine === bp.line && 'bg-amber-400/15',
                )}
              >
                <button
                  type="button"
                  className={cn(
                    'h-2.5 w-2.5 shrink-0 rounded-full',
                    bp.enabled ? 'bg-rose-500' : 'bg-rose-300/60 ring-1 ring-rose-400/40',
                  )}
                  title={bp.enabled ? 'Disable' : 'Enable'}
                  onClick={() => onSetBreakpointEnabled(bp.line, !bp.enabled)}
                />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left font-mono text-pp-ink"
                  onClick={() => onToggleBreakpoint(bp.line)}
                >
                  Line {bp.line}
                  {!bp.enabled && (
                    <span className="ml-2 text-[11px] text-pp-faint">disabled</span>
                  )}
                </button>
                <button
                  type="button"
                  className="text-[11px] text-pp-faint hover:text-pp-ink"
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
          Top frame is current. Frame selection comes later.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-3">
        {callStack.length === 0 ? (
          <p className="px-2.5 py-2 text-[12px] text-pp-faint">Empty — pause to inspect.</p>
        ) : (
          <ul className="space-y-0.5">
            {callStack.map((frame, index) => (
              <li
                key={`${frame.id}-${index}`}
                className={cn(
                  'rounded-md px-2.5 py-2',
                  index === 0 && 'bg-pp-accentSoft',
                )}
              >
                <div className="font-mono text-[12.5px] font-medium text-pp-ink">
                  {frame.name}
                  <span className="ml-2 text-[11px] font-normal text-pp-faint">
                    {frame.kind}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-pp-muted">
                  {frame.line != null ? `Line ${frame.line}` : '—'}
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
          </ul>
        )}
      </div>
    </div>
  );
}
