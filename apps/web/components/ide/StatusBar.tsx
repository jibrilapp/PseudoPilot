import type { TranslationStatus } from '@/lib/translation/types';
import type { ExecutionState } from '@/lib/runtime';

type StatusBarProps = {
  translationStatus?: TranslationStatus;
  diagnosticCount?: number;
  executionState?: ExecutionState;
};

export function StatusBar({
  translationStatus = 'idle',
  diagnosticCount = 0,
  executionState = 'idle',
}: StatusBarProps) {
  const execLabel =
    executionState === 'running'
      ? 'Running'
      : executionState === 'waitingForInput'
        ? 'Waiting for INPUT'
        : executionState === 'completed'
          ? 'Run complete'
          : executionState === 'runtimeError'
            ? 'Runtime error'
            : executionState === 'semanticError'
              ? 'Semantic error'
              : executionState === 'cancelled'
                ? 'Stopped'
                : null;

  const label =
    execLabel ??
    (translationStatus === 'ok'
      ? 'Translated'
      : translationStatus === 'error'
        ? `${diagnosticCount} diagnostic${diagnosticCount === 1 ? '' : 's'}`
        : 'Ready');

  const dot =
    executionState === 'running' || executionState === 'waitingForInput'
      ? 'bg-sky-500/90'
      : executionState === 'runtimeError' || executionState === 'semanticError'
        ? 'bg-rose-500/90'
        : translationStatus === 'error'
          ? 'bg-amber-500/90'
          : 'bg-emerald-500/90';

  return (
    <footer className="relative z-20 flex h-6 shrink-0 items-center gap-3 border-t border-pp-line bg-pp-shell px-3 text-[11px] text-pp-muted">
      <span className="font-medium tracking-[-0.01em] text-pp-ink/80">PseudoPilot</span>
      <span className="hidden text-pp-faint sm:inline">main.pseudo</span>
      <span className="hidden text-pp-faint md:inline">UTF-8</span>
      <div className="ml-auto flex items-center gap-3">
        <span className="hidden sm:inline text-pp-faint">Run · Interpreter · Live translate</span>
        <span className="tracking-[-0.01em]">ClientLocal</span>
        <span className="inline-flex items-center gap-1.5 text-pp-ink/80">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          {label}
        </span>
      </div>
    </footer>
  );
}
