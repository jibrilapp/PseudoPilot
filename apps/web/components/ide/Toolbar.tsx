'use client';

import {
  IconContinue,
  IconPanel,
  IconPause,
  IconPlay,
  IconSidebar,
  IconStepInto,
  IconStepOut,
  IconStepOver,
  IconStop,
  IconTerminal,
} from './Icons';
import type { ExecutionState } from '@/lib/runtime';
import { cn } from '@/lib/cn';

type ToolbarProps = {
  sidebarOpen: boolean;
  rightOpen: boolean;
  consoleOpen: boolean;
  onToggleSidebar: () => void;
  onToggleRight: () => void;
  onToggleConsole: () => void;
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
};

export function Toolbar({
  sidebarOpen,
  rightOpen,
  consoleOpen,
  onToggleSidebar,
  onToggleRight,
  onToggleConsole,
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
}: ToolbarProps) {
  return (
    <header className="relative z-20 flex h-11 shrink-0 items-center gap-4 border-b border-pp-line bg-pp-panel/90 px-3 backdrop-blur-xl md:px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          className="grid h-6 w-6 place-items-center rounded-[7px] bg-pp-accent text-[10px] font-bold tracking-tight text-white"
        >
          P
        </span>
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
          title="Explorer"
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

        <span className="mx-1.5 hidden h-4 w-px bg-pp-lineStrong sm:block" />

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

        <span className="mx-1.5 hidden h-4 w-px bg-pp-lineStrong sm:block" />

        <button
          type="button"
          className="pp-btn-ghost hidden gap-1.5 px-2.5 sm:inline-flex"
          onClick={onRestart}
          disabled={executionState === 'idle' && !isBusy}
          title="Restart"
        >
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
