'use client';

import type { VariableRow } from '@/lib/dummy';
import { cn } from '@/lib/cn';

type VariableInspectorProps = {
  rows: VariableRow[];
};

export function VariableInspector({ rows }: VariableInspectorProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-pp-panel">
      <div className="px-4 pb-3 pt-4">
        <p className="pp-section-label mb-1.5">Runtime</p>
        <h2 className="text-[13px] font-semibold tracking-[-0.02em] text-pp-ink">Variables</h2>
        <p className="mt-0.5 text-[12px] text-pp-muted">After last preview run</p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-2 pb-3">
        <table className="w-full border-collapse text-left text-[12.5px]">
          <thead>
            <tr className="text-[11px] text-pp-faint">
              <th className="px-2.5 pb-2 font-medium">Name</th>
              <th className="px-2.5 pb-2 font-medium">Type</th>
              <th className="px-2.5 pb-2 font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.name}
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
                <td className="px-2.5 py-2 font-mono text-[12px] text-pp-muted">{row.type}</td>
                <td className="px-2.5 py-2 font-mono text-[12.5px] text-pp-accent">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScopePill({ scope }: { scope: VariableRow['scope'] }) {
  return (
    <span
      className={cn(
        'rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wide',
        scope === 'global' ? 'bg-pp-accentSoft text-pp-accent' : 'bg-black/[0.04] text-pp-faint',
      )}
    >
      {scope}
    </span>
  );
}
