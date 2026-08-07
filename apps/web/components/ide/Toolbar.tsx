'use client';

import {
  IconContinue,
  IconPanel,
  IconPause,
  IconPlay,
  IconRestart,
  IconSidebar,
  IconSpark,
  IconStepInto,
  IconStepOut,
  IconStepOver,
  IconStop,
  IconTerminal,
} from './Icons';
import type { ExecutionState } from '@/lib/runtime';
import type { TranslationStatus } from '@/lib/translation/types';
import {
  liveSyncStatusDescription,
  liveSyncStatusLabel,
} from '@/lib/translation/liveSyncStatus';
import { cn } from '@/lib/cn';
import { ENABLE_AI_COACH } from '@/lib/featureFlags';

type ToolbarProps = {
  sidebarOpen: boolean;
  rightOpen: boolean;
  consoleOpen: boolean;
  onToggleSidebar: () => void;
  onToggleRight: () => void;
  onToggleConsole: () => void;
  onOpenCoach?: () => void;
  translationStatus: TranslationStatus;
  executionState: ExecutionState;
  isBusy: boolean;
  canPause: boolean;
  canContinue: boolean;
  canStep: boolean;
  onRun: () => void;
  onStop: () => void;
  onRestart: () => void;
  onPause: () => void;
  onContinue: () => void;
  onStepInto: () => void;
  onStepOver: () => void;
  onStepOut: () => void;
  onShowWelcome?: () => void;
};

export function Toolbar({
  sidebarOpen,
  rightOpen,
  consoleOpen,
  onToggleSidebar,
  onToggleRight,
  onToggleConsole,
  onOpenCoach,
  translationStatus,
  executionState,
  isBusy,
  canPause,
  canContinue,
  canStep,
  onRun,
  onStop,
  onRestart,
  onPause,
  onContinue,
  onStepInto,
  onStepOver,
  onStepOut,
  onShowWelcome,
}: ToolbarProps) {
  const syncLabel = liveSyncStatusLabel(translationStatus);
  const syncDescription = liveSyncStatusDescription(translationStatus);

  return (
    <header className="relative z-20 flex h-11 shrink-0 items-center gap-3 border-b border-pp-line bg-pp-panel/92 px-3 backdrop-blur-xl md:gap-4 md:px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-[7px] bg-pp-accent text-[10px] font-bold tracking-tight text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent/45 focus-visible:ring-offset-2"
          title="Welcome"
          aria-label="Show welcome screen"
          onClick={onShowWelcome}
        >
          P
        </button>
        <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-pp-ink">
          PseudoPilot
        </p>
      </div>

      <div className="ml-auto flex items-center gap-0.5">
        <button
          type="button"
          className="pp-icon-btn hidden sm:inline-flex"
          data-active={sidebarOpen}
          onClick={onToggleSidebar}
          title="Program workspace"
          aria-pressed={sidebarOpen}
        >
          <IconSidebar />
        </button>
        <button
          type="button"
          className="pp-icon-btn hidden sm:inline-flex"
          data-active={consoleOpen}
          onClick={onToggleConsole}
          title="Console"
          aria-pressed={consoleOpen}
        >
          <IconTerminal />
        </button>
        <button
          type="button"
          className="pp-icon-btn hidden sm:inline-flex"
          data-active={rightOpen}
          onClick={onToggleRight}
          title="Side panel"
          aria-pressed={rightOpen}
        >
          <IconPanel />
        </button>
        {ENABLE_AI_COACH && onOpenCoach ? (
          <button
            type="button"
            className="pp-icon-btn hidden sm:inline-flex"
            onClick={onOpenCoach}
            title="AI Coach"
            aria-label="Open AI Coach"
            data-testid="toolbar-ai-coach"
          >
            <IconSpark className="h-[14px] w-[14px]" />
          </button>
        ) : null}

        <span className="mx-1.5 hidden h-4 w-px bg-pp-lineStrong sm:block" aria-hidden />

        <span
          className={cn(
            'hidden max-w-[11rem] items-center gap-1.5 truncate rounded-md px-2 py-1 text-[11px] font-medium tracking-[-0.01em] md:inline-flex',
            translationStatus === 'error'
              ? 'bg-amber-500/10 text-amber-900/90'
              : translationStatus === 'pending'
                ? 'bg-sky-500/10 text-sky-900/90'
                : 'bg-emerald-500/10 text-emerald-800/90',
          )}
          role="status"
          aria-live="polite"
          aria-label={syncDescription}
          title={syncDescription}
          data-testid="live-sync-status"
          data-sync-status={translationStatus}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full',
              translationStatus === 'error'
                ? 'bg-amber-500/90'
                : translationStatus === 'pending'
                  ? 'bg-sky-500/90 animate-pulse'
                  : 'bg-emerald-500/90',
            )}
            aria-hidden
          />
          <span className="truncate">
            {translationStatus === 'idle'
              ? '✓ Live Translation'
              : translationStatus === 'ok'
                ? '✓ Synced'
                : syncLabel}
          </span>
        </span>

        <span className="mx-1.5 hidden h-4 w-px bg-pp-lineStrong md:block" aria-hidden />

        <button
          type="button"
          className="pp-icon-btn"
          title="Continue"
          disabled={!canContinue}
          onClick={onContinue}
        >
          <IconContinue />
        </button>
        <button
          type="button"
          className="pp-icon-btn"
          title="Pause"
          disabled={!canPause}
          onClick={onPause}
        >
          <IconPause />
        </button>
        <button
          type="button"
          className="pp-icon-btn"
          title="Step Into"
          disabled={!canStep && isBusy}
          onClick={onStepInto}
        >
          <IconStepInto />
        </button>
        <button
          type="button"
          className="pp-icon-btn"
          title="Step Over"
          disabled={!canStep}
          onClick={onStepOver}
        >
          <IconStepOver />
        </button>
        <button
          type="button"
          className="pp-icon-btn"
          title="Step Out"
          disabled={!canStep}
          onClick={onStepOut}
        >
          <IconStepOut />
        </button>

        <span className="mx-1.5 hidden h-4 w-px bg-pp-lineStrong sm:block" aria-hidden />

        <button
          type="button"
          className="pp-btn-ghost hidden gap-1.5 px-2.5 sm:inline-flex"
          onClick={onRestart}
          disabled={executionState === 'idle' && !isBusy}
          title="Restart"
        >
          <IconRestart />
          Restart
        </button>

        {isBusy ? (
          <button
            type="button"
            className={cn('pp-btn-primary gap-1.5 pl-2.5 pr-3', 'bg-rose-600 hover:bg-rose-500')}
            onClick={onStop}
            title="Stop"
          >
            <IconStop />
            Stop
          </button>
        ) : (
          <button
            type="button"
            className="pp-btn-primary gap-1.5 pl-2.5 pr-3"
            onClick={onRun}
            title="Run pseudocode"
          >
            <IconPlay />
            Run
          </button>
        )}
      </div>
    </header>
  );
}
