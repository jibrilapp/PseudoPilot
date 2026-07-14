'use client';

import { IconPanel, IconPlay, IconSidebar, IconTerminal } from './Icons';

type ToolbarProps = {
  sidebarOpen: boolean;
  rightOpen: boolean;
  consoleOpen: boolean;
  onToggleSidebar: () => void;
  onToggleRight: () => void;
  onToggleConsole: () => void;
};

export function Toolbar({
  sidebarOpen,
  rightOpen,
  consoleOpen,
  onToggleSidebar,
  onToggleRight,
  onToggleConsole,
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

        <button type="button" className="pp-btn-primary gap-1.5 pl-2.5 pr-3" title="Run (preview)">
          <IconPlay />
          Run
        </button>
      </div>
    </header>
  );
}
