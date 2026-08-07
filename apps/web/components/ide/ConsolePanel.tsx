'use client';

import { useEffect, useState } from 'react';
import type { IdeDiagnostic } from '@/lib/translation/types';
import type {
  ExecutionState,
  RuntimeConsoleLine,
  RuntimeDiagnosticView,
} from '@/lib/runtime';
import { formatConsoleTimestamp } from '@/lib/ide/coachMarkdown';
import { cn } from '@/lib/cn';
import { IconProblems } from './Icons';

export type ConsoleTab = 'output' | 'problems';

type ConsolePanelProps = {
  lines?: readonly RuntimeConsoleLine[];
  runtimeDiagnostics?: readonly RuntimeDiagnosticView[];
  translationDiagnostics?: IdeDiagnostic[];
  /** Language-service / checker diagnostics (includes `C_*` codes). */
  compilerDiagnostics?: readonly IdeDiagnostic[];
  executionState?: ExecutionState;
  awaitingInput?: boolean;
  inputDraft?: string;
  onInputDraftChange?: (value: string) => void;
  onSubmitInput?: () => void;
  onClear?: () => void;
  showTimestamps?: boolean;
  onToggleTimestamps?: () => void;
  activeTab?: ConsoleTab;
  onTabChange?: (tab: ConsoleTab) => void;
  onRevealDiagnostic?: (line: number, column?: number) => void;
};

export function ConsolePanel({
  lines = [],
  runtimeDiagnostics = [],
  translationDiagnostics = [],
  compilerDiagnostics = [],
  executionState = 'idle',
  awaitingInput = false,
  inputDraft = '',
  onInputDraftChange,
  onSubmitInput,
  onClear,
  showTimestamps = false,
  onToggleTimestamps,
  activeTab: controlledTab,
  onTabChange,
  onRevealDiagnostic,
}: ConsolePanelProps) {
  const problemCount =
    runtimeDiagnostics.length +
    translationDiagnostics.length +
    compilerDiagnostics.length;
  const [internalTab, setInternalTab] = useState<ConsoleTab>('output');
  const activeTab = controlledTab ?? internalTab;
  const setTab = (tab: ConsoleTab) => {
    onTabChange?.(tab);
    if (controlledTab == null) setInternalTab(tab);
  };

  useEffect(() => {
    if (problemCount > 0 && lines.length === 0 && executionState === 'idle') {
      setTab('problems');
    }
    // Only auto-switch when diagnostics first appear without output.
  }, [problemCount]);

  const problems: Array<{
    id: string;
    severity: 'error' | 'warning';
    code: string;
    line?: number;
    column?: number;
    message: string;
    help?: string;
    source: string;
  }> = [
    ...compilerDiagnostics.map((d) => ({ ...d, source: 'Compiler' })),
    ...runtimeDiagnostics.map((d) => ({ ...d, source: 'Runtime' })),
    ...translationDiagnostics.map((d) => ({ ...d, source: 'Translation' })),
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-pp-console text-pp-consoleFg">
      <div className="flex h-8 items-center gap-1 border-b border-white/[0.06] px-2">
        <TabButton
          active={activeTab === 'output'}
          onClick={() => setTab('output')}
          label="Output"
        />
        <TabButton
          active={activeTab === 'problems'}
          onClick={() => setTab('problems')}
          label="Problems"
          count={problemCount}
          icon
        />
        <span className="ml-1 text-[11px] text-white/30">
          {activeTab === 'problems' ? 'Diagnostics' : stateLabel(executionState)}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {onToggleTimestamps && activeTab === 'output' && (
            <button
              type="button"
              className={cn(
                'rounded px-1.5 py-0.5 text-[11px] transition-colors',
                showTimestamps
                  ? 'text-emerald-300/80'
                  : 'text-white/35 hover:text-white/60',
              )}
              onClick={onToggleTimestamps}
              aria-pressed={showTimestamps}
              title="Toggle timestamps"
            >
              Ts
            </button>
          )}
          {onClear && activeTab === 'output' && (
            <button
              type="button"
              className="rounded px-1.5 py-0.5 text-[11px] text-white/40 transition-colors hover:text-white/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
              onClick={onClear}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3.5 py-2.5 font-mono text-[12.5px] leading-[1.65]">
        {activeTab === 'problems' ? (
          problems.length === 0 ? (
            <div className="flex gap-3 text-white/35">
              <IconProblems className="mt-0.5 shrink-0 text-white/25" />
              <span>No problems — Pseudocode looks clean.</span>
            </div>
          ) : (
            problems.map((d) => (
              <DiagRow
                key={d.id}
                severity={d.severity}
                code={d.code}
                line={d.line}
                column={d.column}
                message={d.message}
                help={d.help}
                source={d.source}
                onReveal={
                  d.line != null && onRevealDiagnostic
                    ? () => onRevealDiagnostic(d.line!, d.column)
                    : undefined
                }
              />
            ))
          )
        ) : (
          <>
            {runtimeDiagnostics.map((d) => (
              <DiagRow
                key={d.id}
                severity={d.severity}
                code={d.code}
                line={d.line}
                column={d.column}
                message={d.message}
                help={d.help}
                onReveal={
                  d.line != null && onRevealDiagnostic
                    ? () => onRevealDiagnostic(d.line!, d.column)
                    : undefined
                }
              />
            ))}
            {lines.map((line) => (
              <div key={line.id} className="flex gap-3">
                {showTimestamps && line.at != null && (
                  <span className="w-[58px] shrink-0 select-none text-[11px] text-white/25">
                    {formatConsoleTimestamp(line.at)}
                  </span>
                )}
                <span
                  className={cn(
                    'w-4 shrink-0 select-none',
                    line.kind === 'info' && 'text-emerald-300/55',
                    line.kind === 'error' && 'text-rose-300/70',
                    line.kind === 'in' && 'text-sky-300/70',
                    line.kind === 'out' && 'text-white/25',
                  )}
                >
                  {line.kind === 'info'
                    ? '·'
                    : line.kind === 'error'
                      ? '!'
                      : line.kind === 'in'
                        ? '‹'
                        : '›'}
                </span>
                <span
                  className={cn(
                    line.kind === 'info' && 'text-emerald-300/85',
                    line.kind === 'error' && 'text-rose-300/95',
                    line.kind === 'in' && 'text-sky-200/90',
                    line.kind === 'out' && 'text-pp-consoleFg',
                  )}
                >
                  {line.kind === 'in' ? `INPUT ${line.text}` : line.text}
                </span>
              </div>
            ))}
            {lines.length === 0 && runtimeDiagnostics.length === 0 && (
              <div className="flex gap-3 text-white/35">
                <span className="w-4 shrink-0">·</span>
                <span>Press Run to execute Cambridge pseudocode.</span>
              </div>
            )}

            {awaitingInput ? (
              <form
                className="mt-2 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  onSubmitInput?.();
                }}
              >
                <span className="w-4 shrink-0 text-sky-300/80">›</span>
                <input
                  autoFocus
                  value={inputDraft}
                  onChange={(e) => onInputDraftChange?.(e.target.value)}
                  className="min-w-0 flex-1 rounded-[6px] border border-white/10 bg-white/5 px-2 py-1 text-[12.5px] text-white outline-none transition-colors focus:border-sky-400/50 focus:ring-1 focus:ring-sky-400/30"
                  placeholder="Enter INPUT value…"
                  aria-label="Program INPUT"
                />
                <button
                  type="submit"
                  className="rounded-[6px] bg-sky-500/80 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-sky-500"
                >
                  Send
                </button>
              </form>
            ) : (
              <div className="mt-1.5 flex gap-3 text-white/40">
                <span className="w-4 shrink-0">›</span>
                <span className="inline-block h-[14px] w-[7px] bg-emerald-300/70 animate-caret" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  icon?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[12px] font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40',
        active ? 'bg-white/[0.08] text-white/90' : 'text-white/45 hover:text-white/70',
      )}
      aria-pressed={active}
    >
      {icon && <IconProblems className="opacity-70" />}
      {label}
      {count != null && count > 0 && (
        <span
          className={cn(
            'rounded-full px-1.5 text-[10px] font-semibold',
            active ? 'bg-rose-500/80 text-white' : 'bg-white/10 text-white/60',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function stateLabel(state: ExecutionState): string {
  switch (state) {
    case 'running':
      return 'Running';
    case 'paused':
      return 'Paused';
    case 'waitingForInput':
      return 'Waiting for INPUT';
    case 'completed':
      return 'Completed';
    case 'runtimeError':
      return 'Runtime error';
    case 'semanticError':
      return 'Semantic error';
    case 'cancelled':
      return 'Stopped';
    default:
      return 'Ready';
  }
}

function DiagRow({
  severity,
  code,
  line,
  column,
  message,
  help,
  source,
  onReveal,
}: {
  severity: 'error' | 'warning';
  code: string;
  line?: number;
  column?: number;
  message: string;
  help?: string;
  source?: string;
  onReveal?: () => void;
}) {
  const body = (
    <>
      <span className="text-white/40">[{code}]</span>{' '}
      {source ? <span className="text-white/30">{source} · </span> : null}
      {line != null ? `Line ${line}${column != null ? `:${column}` : ''}: ` : ''}
      {message}
      {help ? <span className="text-white/45"> — {help}</span> : null}
    </>
  );

  return (
    <div className="mb-0.5 flex gap-3">
      <span
        className={cn(
          'w-4 shrink-0 select-none',
          severity === 'warning' ? 'text-amber-300/70' : 'text-rose-300/70',
        )}
      >
        {severity === 'warning' ? '~' : '!'}
      </span>
      {onReveal ? (
        <button
          type="button"
          onClick={onReveal}
          className={cn(
            'min-w-0 flex-1 text-left transition-colors hover:underline',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40',
            severity === 'warning' ? 'text-amber-200/90' : 'text-rose-300/90',
          )}
        >
          {body}
        </button>
      ) : (
        <span
          className={severity === 'warning' ? 'text-amber-200/90' : 'text-rose-300/90'}
        >
          {body}
        </span>
      )}
    </div>
  );
}
