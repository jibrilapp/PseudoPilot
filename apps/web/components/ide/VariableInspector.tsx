'use client';

import type { RuntimeVariableRow } from '@/lib/runtime';
import type { CallStackFrameView } from '@/lib/debugger';
import { cn } from '@/lib/cn';

type VariableInspectorProps = {
  rows: readonly RuntimeVariableRow[];
  frameName?: string | null;
  executionState?: string;
  callStack?: readonly CallStackFrameView[];
};

export function VariableInspector({
  rows,
  frameName = null,
  executionState = 'idle',
  callStack = [],
}: VariableInspectorProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-pp-panel">
      <div className="border-b border-pp-line px-4 pb-3 pt-4">
        <p className="pp-section-label mb-1.5">Runtime</p>
        <h2 className="text-[13px] font-semibold tracking-[-0.02em] text-pp-ink">
          Variables
        </h2>
        <p className="mt-0.5 text-[12px] text-pp-muted">
          {frameName ? `Frame: ${frameName}` : subtitle(executionState)}
        </p>
      </div>

      {callStack.length > 0 && (
        <div className="border-b border-pp-line px-4 py-3">
          <p className="mb-1.5 text-[11px] font-semibold tracking-[0.04em] text-pp-faint">
            Call stack
          </p>
          <ul className="space-y-0.5" aria-label="Call stack summary">
            {callStack.map((frame, index) => (
              <li
                key={`${frame.id}-${index}`}
                className={cn(
                  'rounded-[6px] px-1.5 py-1 font-mono text-[11.5px]',
                  index === 0 ? 'bg-pp-accentSoft text-pp-ink' : 'text-pp-muted',
                )}
              >
                {frame.name}
                {frame.line != null && (
                  <span className="ml-2 text-pp-faint">:{frame.line}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto px-2 pb-3 pt-1">
        {rows.length === 0 ? (
          <p className="pp-empty">No variables yet — press Run.</p>
        ) : (
          <table className="w-full border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="sticky top-0 bg-pp-panel text-[11px] text-pp-faint">
                <th className="px-2.5 pb-2 pt-1 font-medium">Name</th>
                <th className="px-2.5 pb-2 pt-1 font-medium">Type</th>
                <th className="px-2.5 pb-2 pt-1 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.scope}:${row.name}`}
                  className="border-t border-pp-line transition-colors hover:bg-black/[0.025]"
                >
                  <td className="px-2.5 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12.5px] font-medium tracking-tight text-pp-ink">
                        {row.name}
                      </span>
                      <ScopePill scope={row.scope} />
                    </div>
                  </td>
                  <td className="px-2.5 py-2 font-mono text-[12px] text-pp-muted">
                    {row.type}
                  </td>
                  <td className="px-2.5 py-2 font-mono text-[12.5px] text-pp-accent">
                    {row.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function subtitle(state: string): string {
  if (state === 'paused') return 'Paused';
  if (state === 'running' || state === 'waitingForInput') return 'Live';
  if (state === 'completed') return 'After last run';
  if (state === 'runtimeError' || state === 'semanticError') return 'At error';
  return 'After last run';
}

function ScopePill({ scope }: { scope: RuntimeVariableRow['scope'] }) {
  return (
    <span
      className={cn(
        'rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wide',
        scope === 'global' && 'bg-pp-accentSoft text-pp-accent',
        scope === 'local' && 'bg-black/[0.04] text-pp-faint',
        scope === 'parameter' && 'bg-sky-500/10 text-sky-700',
        scope === 'constant' && 'bg-amber-500/10 text-amber-800',
      )}
    >
      {scope}
    </span>
  );
}
