'use client';

import {
  PROGRAM_PANES,
  PROGRAM_PERSISTENCE_NOTE,
  PROGRAM_TITLE,
  type ProgramPaneId,
} from '@/lib/ide/programWorkspace';
import { cn } from '@/lib/cn';
import { IconFile } from './Icons';

type ProgramWorkspaceProps = {
  activePaneId: ProgramPaneId;
  onSelectPane: (id: ProgramPaneId) => void;
  onNewFile: () => void;
  onOpenExample: () => void;
  onSaveLocal?: () => void;
  onDownloadPseudocode?: () => void;
  onDownloadPython?: () => void;
  saveHint?: string | null;
};

export function ProgramWorkspace({
  activePaneId,
  onSelectPane,
  onNewFile,
  onOpenExample,
  onSaveLocal,
  onDownloadPseudocode,
  onDownloadPython,
  saveHint = null,
}: ProgramWorkspaceProps) {
  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-testid="program-workspace"
    >
      <div className="px-4 pb-3 pt-4">
        <p className="pp-section-label mb-2">Workspace</p>
        <p className="truncate text-[13px] font-semibold tracking-[-0.02em] text-pp-ink">
          Current program
        </p>
        <p className="mt-0.5 font-mono text-[12px] text-pp-muted">
          {PROGRAM_TITLE}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-pp-faint">
          Single Cambridge program — Pseudocode and Python are dual views, not
          separate project files.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-2 pb-3">
        <p className="mb-1.5 px-2 text-[11px] font-medium tracking-[-0.01em] text-pp-faint">
          Views
        </p>
        <ul className="flex flex-col gap-0.5" role="list">
          {PROGRAM_PANES.map((pane) => {
            const active = activePaneId === pane.id;
            return (
              <li key={pane.id}>
                <button
                  type="button"
                  data-testid={`program-pane-${pane.id}`}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => onSelectPane(pane.id)}
                  className={cn(
                    'group flex w-full items-center gap-2 rounded-[8px] px-2.5 py-[7px] text-left text-[13px] tracking-[-0.01em]',
                    'transition-colors duration-150 ease-apple',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent/40',
                    active
                      ? 'bg-pp-accentSoft font-medium text-pp-accent'
                      : 'text-pp-ink/90 hover:bg-black/[0.035]',
                  )}
                >
                  <IconFile
                    className={cn(
                      'shrink-0',
                      active
                        ? 'text-pp-accent'
                        : 'text-pp-faint group-hover:text-pp-muted',
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{pane.label}</span>
                  <span className="shrink-0 font-mono text-[11px] text-pp-faint">
                    {pane.fileLabel}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 space-y-1.5 px-1">
          <button
            type="button"
            className="pp-btn-ghost w-full justify-center border border-pp-line bg-white px-3 py-1.5 text-[12.5px]"
            onClick={onNewFile}
          >
            New program
          </button>
          <button
            type="button"
            className="pp-btn-ghost w-full justify-center px-3 py-1.5 text-[12.5px]"
            onClick={onOpenExample}
          >
            Open example
          </button>
        </div>

        {(onSaveLocal || onDownloadPseudocode || onDownloadPython) && (
          <div className="mt-4 space-y-1.5 px-1">
            <p className="mb-1.5 px-1 text-[11px] font-medium tracking-[-0.01em] text-pp-faint">
              Save / Export
            </p>
            {onSaveLocal && (
              <button
                type="button"
                data-testid="workspace-save-local"
                className="pp-btn-ghost w-full justify-center border border-pp-line bg-white px-3 py-1.5 text-[12.5px]"
                onClick={onSaveLocal}
              >
                Save locally
              </button>
            )}
            {onDownloadPseudocode && (
              <button
                type="button"
                data-testid="workspace-download-pp"
                className="pp-btn-ghost w-full justify-center px-3 py-1.5 text-[12.5px]"
                onClick={onDownloadPseudocode}
              >
                Download Pseudocode (.pp)
              </button>
            )}
            {onDownloadPython && (
              <button
                type="button"
                data-testid="workspace-download-py"
                className="pp-btn-ghost w-full justify-center px-3 py-1.5 text-[12.5px]"
                onClick={onDownloadPython}
              >
                Download Python (.py)
              </button>
            )}
            {saveHint && (
              <p
                className="px-1 pt-1 text-[11px] text-pp-muted"
                data-testid="workspace-save-hint"
                role="status"
              >
                {saveHint}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-pp-line px-4 py-3">
        <p
          className="text-[11px] leading-relaxed text-pp-faint"
          data-testid="program-persistence-note"
        >
          {PROGRAM_PERSISTENCE_NOTE}
        </p>
      </div>
    </div>
  );
}
