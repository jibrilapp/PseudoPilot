'use client';

import { useEffect, useState } from 'react';
import {
  DUMMY_AI,
  DUMMY_CONSOLE,
  DUMMY_FILES,
  DUMMY_PSEUDOCODE,
  DUMMY_TABS,
  DUMMY_VARIABLES,
} from '@/lib/dummy';
import { usePseudocodeTranslation } from '@/hooks/usePseudocodeTranslation';
import { ActivityBar, type ActivityId } from './ActivityBar';
import { AiAssistantPanel } from './AiAssistantPanel';
import { ConsolePanel } from './ConsolePanel';
import { DualEditor } from './DualEditor';
import { FileExplorer } from './FileExplorer';
import { MobileDock } from './MobileDock';
import { StatusBar } from './StatusBar';
import { Toolbar } from './Toolbar';
import { VariableInspector } from './VariableInspector';
import { cn } from '@/lib/cn';

type MobileView = 'explorer' | 'editors' | 'console' | 'ai' | 'vars';

export function IdeShell() {
  const [activity, setActivity] = useState<ActivityId>('explorer');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [activeFileId, setActiveFileId] = useState('main-pseudo');
  const [rightTab, setRightTab] = useState<'ai' | 'vars'>('ai');
  const [mobileView, setMobileView] = useState<MobileView>('editors');
  const [mounted, setMounted] = useState(false);

  const {
    pseudocode,
    setPseudocode,
    python,
    diagnostics,
    status: translationStatus,
  } = usePseudocodeTranslation(DUMMY_PSEUDOCODE);

  useEffect(() => setMounted(true), []);

  // Surface diagnostics: keep console open when there are issues (errors or warnings).
  useEffect(() => {
    if (diagnostics.length > 0) {
      setConsoleOpen(true);
    }
  }, [diagnostics.length]);

  return (
    <div
      className={cn(
        'flex h-[100dvh] w-full flex-col overflow-hidden bg-pp-canvas text-pp-ink',
        mounted && 'animate-shell-in',
      )}
    >
      <Toolbar
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onToggleRight={() => setRightOpen((v) => !v)}
        onToggleConsole={() => setConsoleOpen((v) => !v)}
        sidebarOpen={sidebarOpen}
        rightOpen={rightOpen}
        consoleOpen={consoleOpen}
      />

      <div className="relative flex min-h-0 flex-1">
        <div className="hidden min-h-0 flex-1 md:flex">
          <ActivityBar active={activity} onChange={setActivity} />

          <aside
            className={cn(
              'flex shrink-0 flex-col overflow-hidden border-r border-pp-line bg-pp-shell',
              'transition-[width,opacity] duration-200 ease-apple',
              sidebarOpen ? 'w-[232px] opacity-100 lg:w-[248px]' : 'w-0 opacity-0 border-r-0',
            )}
          >
            {sidebarOpen && (
              <FileExplorer
                tree={DUMMY_FILES}
                activeId={activeFileId}
                onSelect={setActiveFileId}
              />
            )}
          </aside>

          <main className="flex min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1">
              <DualEditor
                tabs={DUMMY_TABS}
                activeFileId={activeFileId}
                onSelectTab={setActiveFileId}
                pseudocode={pseudocode}
                python={python}
                onPseudocodeChange={setPseudocode}
                translationStatus={translationStatus}
              />
            </div>
            <div
              className={cn(
                'shrink-0 overflow-hidden border-t border-pp-line transition-[height,opacity] duration-200 ease-apple',
                consoleOpen ? 'h-[168px] opacity-100 lg:h-[188px]' : 'h-0 border-t-0 opacity-0',
              )}
            >
              {consoleOpen && (
                <ConsolePanel lines={DUMMY_CONSOLE} diagnostics={diagnostics} />
              )}
            </div>
          </main>

          <aside
            className={cn(
              'flex shrink-0 flex-col overflow-hidden border-l border-pp-line bg-pp-shell',
              'transition-[width,opacity] duration-200 ease-apple',
              rightOpen ? 'w-[288px] opacity-100 xl:w-[312px]' : 'w-0 opacity-0 border-l-0',
            )}
          >
            {rightOpen && (
              <>
                <div className="flex items-center gap-0.5 border-b border-pp-line px-1">
                  <button
                    type="button"
                    className="pp-tab"
                    data-active={rightTab === 'ai'}
                    onClick={() => setRightTab('ai')}
                  >
                    AI
                  </button>
                  <button
                    type="button"
                    className="pp-tab"
                    data-active={rightTab === 'vars'}
                    onClick={() => setRightTab('vars')}
                  >
                    Variables
                  </button>
                </div>
                <div className="min-h-0 flex-1 animate-panel-in" key={rightTab}>
                  {rightTab === 'ai' ? (
                    <AiAssistantPanel messages={DUMMY_AI} />
                  ) : (
                    <VariableInspector rows={DUMMY_VARIABLES} />
                  )}
                </div>
              </>
            )}
          </aside>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:hidden">
          {mobileView === 'explorer' && (
            <FileExplorer
              tree={DUMMY_FILES}
              activeId={activeFileId}
              onSelect={(id) => {
                setActiveFileId(id);
                setMobileView('editors');
              }}
            />
          )}
          {mobileView === 'editors' && (
            <DualEditor
              tabs={DUMMY_TABS}
              activeFileId={activeFileId}
              onSelectTab={setActiveFileId}
              pseudocode={pseudocode}
              python={python}
              onPseudocodeChange={setPseudocode}
              translationStatus={translationStatus}
              stacked
            />
          )}
          {mobileView === 'console' && (
            <ConsolePanel lines={DUMMY_CONSOLE} diagnostics={diagnostics} />
          )}
          {mobileView === 'ai' && <AiAssistantPanel messages={DUMMY_AI} />}
          {mobileView === 'vars' && <VariableInspector rows={DUMMY_VARIABLES} />}
        </div>
      </div>

      <StatusBar
        translationStatus={translationStatus}
        diagnosticCount={diagnostics.length}
      />
      <MobileDock active={mobileView} onChange={setMobileView} />
    </div>
  );
}
