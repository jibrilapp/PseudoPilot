'use client';

import type { EditorTab } from '@/lib/dummy';
import type { Breakpoint } from '@/lib/debugger';
import type { IdeDiagnostic } from '@/lib/translation/types';
import type { EditOrigin } from '@/lib/translation/bidirectionalSync';
import { ideDiagnosticsToMarkers } from '@/lib/monaco';
import { cn } from '@/lib/cn';
import { CodeSurface } from './CodeSurface';

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
  translationStatus?: 'idle' | 'ok' | 'error';
  /** Which pane's last translate attempt failed. */
  translationErrorSide?: EditOrigin | null;
  translationDiagnostics?: readonly IdeDiagnostic[];
  activeLine?: number | null;
  breakpoints?: readonly Breakpoint[];
  onToggleBreakpoint?: (line: number) => void;
};

function pythonBadge(
  status: 'idle' | 'ok' | 'error',
  errorSide: EditOrigin | null | undefined,
): string | undefined {
  if (status === 'ok') return 'Live';
  if (status !== 'error') return undefined;
  if (errorSide === 'python') return 'Showing last good Pseudocode';
  return 'Showing last good translation';
}

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
}: DualEditorProps) {
  const pythonMarkers =
    translationStatus === 'error' && translationErrorSide === 'python'
      ? ideDiagnosticsToMarkers(translationDiagnostics)
      : [];

  return (
    <div className="flex h-full min-h-0 flex-col bg-pp-editor">
      <div className="flex items-end overflow-x-auto border-b border-pp-line bg-pp-shell/60 px-1">
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

      <div
        className={cn(
          'grid min-h-0 flex-1',
          stacked ? 'grid-rows-2' : 'grid-rows-2 lg:grid-cols-2 lg:grid-rows-1',
        )}
      >
        <EditorColumn
          title="Pseudocode"
          path="src/main.pseudo"
          code={pseudocode}
          language="pseudocode"
          editable
          onChange={onPseudocodeChange}
          onSelectionChange={onPseudocodeSelectionChange}
          emphasis={activeFileId.includes('pseudo') || activeFileId.startsWith('ex')}
          activeLine={activeLine}
          breakpoints={breakpoints}
          onToggleBreakpoint={onToggleBreakpoint}
        />
        <EditorColumn
          title="Python"
          path="src/main.py"
          code={python}
          language="python"
          editable
          onChange={onPythonChange}
          onSelectionChange={onPythonSelectionChange}
          emphasis={activeFileId.includes('py')}
          bordered
          badge={pythonBadge(translationStatus, translationErrorSide)}
          externalMarkers={pythonMarkers}
        />
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
}) {
  return (
    <section
      className={cn(
        'flex min-h-0 flex-col transition-colors duration-200 ease-apple',
        bordered && 'border-t border-pp-line lg:border-l lg:border-t-0',
        emphasis ? 'bg-pp-editor' : 'bg-[#fbfbfc]',
      )}
    >
      <div className="flex h-8 items-center justify-between gap-2 border-b border-pp-line/80 bg-pp-shell/30 px-3.5">
        <h3 className="text-[12px] font-medium tracking-[-0.01em] text-pp-muted">{title}</h3>
        <div className="flex min-w-0 items-center gap-2">
          {badge && (
            <span
              className={cn(
                'truncate rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-[-0.01em]',
                badge === 'Live'
                  ? 'bg-emerald-500/10 text-emerald-700/90'
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
        onToggleBreakpoint={language === 'pseudocode' ? onToggleBreakpoint : undefined}
        externalMarkers={externalMarkers}
      />
    </section>
  );
}
