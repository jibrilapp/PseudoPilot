'use client';

import type { EditorTab } from '@/lib/dummy';
import type { Breakpoint } from '@/lib/debugger';
import type { IdeDiagnostic, TranslationStatus } from '@/lib/translation/types';
import type { EditOrigin } from '@/lib/translation/bidirectionalSync';
import { pythonPaneSyncBadge } from '@/lib/translation/liveSyncStatus';
import { ideDiagnosticsToMarkers } from '@/lib/monaco';
import { cn } from '@/lib/cn';
import { CodeSurface } from './CodeSurface';
import { RatioSplitPane } from './SplitPane';

export type RevealRequest = {
  line: number;
  column?: number;
  /** Bump to re-trigger reveal of the same line. */
  nonce: number;
};

type DualEditorProps = {
  tabs: EditorTab[];
  activeFileId: string;
  onSelectTab: (id: string) => void;
  pseudocode: string;
  python: string;
  onPseudocodeChange: (value: string) => void;
  onPythonChange: (value: string) => void;
  onPseudocodeSelectionChange?: (text: string) => void;
  onPythonSelectionChange?: (text: string) => void;
  stacked?: boolean;
  translationStatus?: TranslationStatus;
  /** Which pane's last translate attempt failed. */
  translationErrorSide?: EditOrigin | null;
  translationDiagnostics?: readonly IdeDiagnostic[];
  activeLine?: number | null;
  breakpoints?: readonly Breakpoint[];
  onToggleBreakpoint?: (line: number) => void;
  /** Pseudocode share of the split (0–1). */
  editorSplit?: number;
  onEditorSplitChange?: (ratio: number) => void;
  revealRequest?: RevealRequest | null;
};

export function DualEditor({
  tabs,
  activeFileId,
  onSelectTab,
  pseudocode,
  python,
  onPseudocodeChange,
  onPythonChange,
  onPseudocodeSelectionChange,
  onPythonSelectionChange,
  stacked = false,
  translationStatus = 'idle',
  translationErrorSide = null,
  translationDiagnostics = [],
  activeLine = null,
  breakpoints = [],
  onToggleBreakpoint,
  editorSplit = 0.5,
  onEditorSplitChange,
  revealRequest = null,
}: DualEditorProps) {
  const pythonMarkers =
    translationStatus === 'error' && translationErrorSide === 'python'
      ? ideDiagnosticsToMarkers(translationDiagnostics)
      : [];

  const pseudoEmphasis = activeFileId === 'main-pseudo';
  const pythonEmphasis = activeFileId === 'main-py';

  const syncBadge = pythonPaneSyncBadge(
    translationStatus,
    translationErrorSide,
  );

  const pseudoPane = (
    <EditorColumn
      title="Pseudocode"
      path="Untitled.pp"
      code={pseudocode}
      language="pseudocode"
      editable
      onChange={onPseudocodeChange}
      onSelectionChange={onPseudocodeSelectionChange}
      emphasis={pseudoEmphasis || (!pythonEmphasis && !stacked)}
      activeLine={activeLine}
      breakpoints={breakpoints}
      onToggleBreakpoint={onToggleBreakpoint}
      revealRequest={revealRequest}
    />
  );

  const pythonPane = (
    <EditorColumn
      title="Python"
      path="Untitled.py"
      code={python}
      language="python"
      editable
      onChange={onPythonChange}
      onSelectionChange={onPythonSelectionChange}
      emphasis={pythonEmphasis}
      bordered
      badge={syncBadge}
      externalMarkers={pythonMarkers}
    />
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-pp-editor">
      <div className="flex items-end overflow-x-auto border-b border-pp-line bg-pp-shell/70 px-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="pp-tab whitespace-nowrap"
            data-active={activeFileId === tab.id}
            onClick={() => onSelectTab(tab.id)}
          >
            <span className="font-mono text-[12.5px]">{tab.name}</span>
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {onEditorSplitChange ? (
          <RatioSplitPane
            orientation={stacked ? 'vertical' : 'horizontal'}
            ratio={editorSplit}
            onRatioChange={onEditorSplitChange}
            primary={pseudoPane}
            secondary={pythonPane}
            label="Resize editor split"
            className="h-full"
          />
        ) : (
          <div
            className={cn(
              'grid h-full min-h-0',
              stacked ? 'grid-rows-2' : 'grid-rows-2 lg:grid-cols-2 lg:grid-rows-1',
            )}
          >
            {pseudoPane}
            {pythonPane}
          </div>
        )}
      </div>
    </div>
  );
}

function EditorColumn({
  title,
  path,
  code,
  language,
  emphasis,
  bordered,
  editable,
  onChange,
  onSelectionChange,
  badge,
  activeLine,
  breakpoints,
  onToggleBreakpoint,
  externalMarkers,
  revealRequest,
}: {
  title: string;
  path: string;
  code: string;
  language: 'pseudocode' | 'python';
  emphasis?: boolean;
  bordered?: boolean;
  editable?: boolean;
  onChange?: (value: string) => void;
  onSelectionChange?: (text: string) => void;
  badge?: string;
  activeLine?: number | null;
  breakpoints?: readonly Breakpoint[];
  onToggleBreakpoint?: (line: number) => void;
  externalMarkers?: ReturnType<typeof ideDiagnosticsToMarkers>;
  revealRequest?: RevealRequest | null;
}) {
  return (
    <section
      className={cn(
        'flex h-full min-h-0 flex-col transition-[background-color,box-shadow] duration-200 ease-apple',
        bordered && 'border-t border-pp-line lg:border-l lg:border-t-0',
        emphasis
          ? 'bg-pp-editor shadow-[inset_0_0_0_1px_rgba(13,115,112,0.08)]'
          : 'bg-[#f8f8fa]',
      )}
      data-active-editor={emphasis || undefined}
      aria-label={`${title} editor`}
    >
      <div
        className={cn(
          'flex h-8 items-center justify-between gap-2 border-b px-3.5',
          emphasis
            ? 'border-pp-accent/20 bg-pp-accentSoft/40'
            : 'border-pp-line/80 bg-pp-shell/30',
        )}
      >
        <h3
          className={cn(
            'text-[12px] font-medium tracking-[-0.01em]',
            emphasis ? 'text-pp-ink' : 'text-pp-muted',
          )}
        >
          {title}
        </h3>
        <div className="flex min-w-0 items-center gap-2">
          {badge && (
            <span
              className={cn(
                'truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-[-0.01em]',
                badge === 'Live'
                  ? 'bg-emerald-500/10 text-emerald-700/90'
                  : badge === 'Syncing…'
                    ? 'bg-sky-500/10 text-sky-800/90'
                    : 'bg-amber-500/10 text-amber-800/90',
              )}
            >
              {badge}
            </span>
          )}
          <span className="font-mono text-[11px] text-pp-faint">{path}</span>
        </div>
      </div>
      <CodeSurface
        code={code}
        language={language}
        editable={editable}
        onChange={onChange}
        onSelectionChange={onSelectionChange}
        aria-label={title}
        activeLine={language === 'pseudocode' ? activeLine : null}
        breakpoints={language === 'pseudocode' ? breakpoints : []}
        onToggleBreakpoint={
          language === 'pseudocode' ? onToggleBreakpoint : undefined
        }
        externalMarkers={externalMarkers}
        revealRequest={language === 'pseudocode' ? revealRequest : null}
      />
    </section>
  );
}
