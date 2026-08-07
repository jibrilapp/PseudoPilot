import {
  CAMBRIDGE_DISCLAIMER,
  CAMBRIDGE_DISCLAIMER_SHORT,
} from '@/lib/ide/cambridgeDisclaimer';
import type { TranslationStatus } from '@/lib/translation/types';
import { liveSyncStatusLabel } from '@/lib/translation/liveSyncStatus';
import type { ExecutionState } from '@/lib/runtime';

type StatusBarProps = {
  translationStatus?: TranslationStatus;
  diagnosticCount?: number;
  executionState?: ExecutionState;
  pauseLine?: number | null;
  onOpenProblems?: () => void;
};

export function StatusBar({
  translationStatus = 'idle',
  diagnosticCount = 0,
  executionState = 'idle',
  pauseLine = null,
  onOpenProblems,
}: StatusBarProps) {
  const execLabel =
    executionState === 'running'
      ? 'Running'
      : executionState === 'paused'
        ? pauseLine != null
          ? `Paused · line ${pauseLine}`
          : 'Paused'
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

  const syncLabel = liveSyncStatusLabel(translationStatus);
  const label = execLabel ?? syncLabel;

  const dot =
    executionState === 'paused'
      ? 'bg-amber-500/90'
      : executionState === 'running' || executionState === 'waitingForInput'
        ? 'bg-sky-500/90'
        : executionState === 'runtimeError' || executionState === 'semanticError'
          ? 'bg-rose-500/90'
          : translationStatus === 'error'
            ? 'bg-amber-500/90'
            : translationStatus === 'pending'
              ? 'bg-sky-500/90'
              : 'bg-emerald-500/90';

  const showProblemsShortcut =
    diagnosticCount > 0 ||
    executionState === 'runtimeError' ||
    executionState === 'semanticError';

  return (
    <footer className="relative z-20 flex h-6 shrink-0 items-center gap-3 border-t border-pp-line bg-pp-shell px-3 text-[11px] text-pp-muted">
      <span className="font-medium tracking-[-0.01em] text-pp-ink/80">
        PseudoPilot
      </span>
      <span
        className="hidden truncate text-pp-faint sm:inline"
        title={CAMBRIDGE_DISCLAIMER}
        aria-label={CAMBRIDGE_DISCLAIMER}
        data-testid="status-bar-cambridge-disclaimer"
      >
        {CAMBRIDGE_DISCLAIMER_SHORT}
      </span>
      <span className="hidden text-pp-faint md:inline">Untitled.pp</span>
      <span className="hidden text-pp-faint lg:inline">Monaco</span>
      <span className="hidden text-pp-faint lg:inline">UTF-8</span>
      <div className="ml-auto flex items-center gap-3">
        {showProblemsShortcut && onOpenProblems && (
          <button
            type="button"
            onClick={onOpenProblems}
            className="hidden rounded px-1 py-0.5 text-pp-faint transition-colors hover:text-pp-ink sm:inline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pp-accent/40"
          >
            {diagnosticCount > 0
              ? `${diagnosticCount} problem${diagnosticCount === 1 ? '' : 's'}`
              : 'Problems'}
          </button>
        )}
        <span className="hidden text-pp-faint sm:inline">Run · Debugger · Live sync</span>
        <span className="tracking-[-0.01em]">ClientLocal</span>
        <span className="inline-flex items-center gap-1.5 text-pp-ink/80">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
          <span aria-live="polite" data-testid="status-bar-sync">
            {label}
          </span>
        </span>
      </div>
    </footer>
  );
}
