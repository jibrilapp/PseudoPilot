'use client';

import type { IdeDiagnostic } from '@/lib/translation/types';
import type {
  ExecutionState,
  RuntimeConsoleLine,
  RuntimeDiagnosticView,
} from '@/lib/runtime';
import { cn } from '@/lib/cn';

type ConsolePanelProps = {
  lines?: readonly RuntimeConsoleLine[];
  runtimeDiagnostics?: readonly RuntimeDiagnosticView[];
  translationDiagnostics?: IdeDiagnostic[];
  executionState?: ExecutionState;
  awaitingInput?: boolean;
  inputDraft?: string;
  onInputDraftChange?: (value: string) => void;
  onSubmitInput?: () => void;
  onClear?: () => void;
};

export function ConsolePanel({
  lines = [],
  runtimeDiagnostics = [],
  translationDiagnostics = [],
  executionState = 'idle',
  awaitingInput = false,
  inputDraft = '',
  onInputDraftChange,
  onSubmitInput,
  onClear,
}: ConsolePanelProps) {
  const showRuntime = lines.length > 0 || runtimeDiagnostics.length > 0 || awaitingInput;
  const showTranslation =
    !showRuntime && translationDiagnostics.length > 0 && executionState === 'idle';

  return (
    <div className="flex h-full min-h-0 flex-col bg-pp-console text-pp-consoleFg">
      <div className="flex h-8 items-center gap-2.5 border-b border-white/[0.06] px-3.5">
        <h2 className="text-[12px] font-medium tracking-[-0.01em] text-white/55">
          {showTranslation ? 'Diagnostics' : 'Console'}
        </h2>
        <span className="text-[11px] text-white/30">
          {showTranslation ? 'Translation' : stateLabel(executionState)}
        </span>
        {onClear && (
          <button
            type="button"
            className="ml-auto text-[11px] text-white/40 transition-colors hover:text-white/70"
            onClick={onClear}
          >
            Clear
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3.5 py-2.5 font-mono text-[12.5px] leading-[1.65]">
        {showTranslation ? (
          translationDiagnostics.map((d) => (
            <DiagRow
              key={d.id}
              severity={d.severity}
              code={d.code}
              line={d.line}
              message={d.message}
              help={d.help}
            />
          ))
        ) : (
          <>
            {runtimeDiagnostics.map((d) => (
              <DiagRow
                key={d.id}
                severity={d.severity}
                code={d.code}
                line={d.line}
                message={d.message}
                help={d.help}
              />
            ))}
            {lines.map((line) => (
              <div key={line.id} className="flex gap-3">
                <span className="w-4 shrink-0 select-none text-white/25">
                  {line.kind === 'info' ? '·' : line.kind === 'error' ? '!' : line.kind === 'in' ? '‹' : ''}
                </span>
                <span
                  className={cn(
                    line.kind === 'info' && 'text-emerald-300/80',
                    line.kind === 'error' && 'text-rose-300/90',
                    line.kind === 'in' && 'text-sky-200/90',
                    line.kind === 'out' && 'text-pp-consoleFg',
                  )}
                >
                  {line.kind === 'in' ? `INPUT ${line.text}` : line.text}
                </span>
              </div>
            ))}
            {!showRuntime && (
              <div className="flex gap-3 text-white/35">
                <span className="w-4 shrink-0">·</span>
                <span>Press Run to execute Cambridge pseudocode.</span>
              </div>
            )}
          </>
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
              className="min-w-0 flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-[12.5px] text-white outline-none focus:border-sky-400/50"
              placeholder="Enter INPUT value…"
              aria-label="Program INPUT"
            />
            <button
              type="submit"
              className="rounded bg-sky-500/80 px-2.5 py-1 text-[11px] font-medium text-white"
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
      </div>
    </div>
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
      return 'Output';
  }
}

function DiagRow({
  severity,
  code,
  line,
  message,
  help,
}: {
  severity: 'error' | 'warning';
  code: string;
  line?: number;
  message: string;
  help?: string;
}) {
  return (
    <div className="flex gap-3">
      <span
        className={cn(
          'w-4 shrink-0 select-none',
          severity === 'warning' ? 'text-amber-300/70' : 'text-rose-300/70',
        )}
      >
        {severity === 'warning' ? '~' : '!'}
      </span>
      <span className={severity === 'warning' ? 'text-amber-200/90' : 'text-rose-300/90'}>
        <span className="text-white/40">[{code}]</span>{' '}
        {line != null ? `Line ${line}: ` : ''}
        {message}
        {help ? <span className="text-white/45"> — {help}</span> : null}
      </span>
    </div>
  );
}
