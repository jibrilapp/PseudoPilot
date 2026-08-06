'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DUMMY_FILES,
  DUMMY_PSEUDOCODE,
  DUMMY_TABS,
} from '@/lib/dummy';
import { usePseudocodeTranslation } from '@/hooks/usePseudocodeTranslation';
import { usePseudocodeRuntime } from '@/hooks/usePseudocodeRuntime';
import { setEditorSelection, useAICoach } from '@/lib/aiCoach';
import { ActivityBar, type ActivityId } from './ActivityBar';
import { AiAssistantPanel } from './AiAssistantPanel';
import { ConsolePanel } from './ConsolePanel';
import { DebugSidebar } from './DebugSidebar';
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
  /** Avoid mounting desktop + mobile DualEditors together (CSS-hidden still runs Monaco). */
  const [isDesktop, setIsDesktop] = useState(false);

  const {
    pseudocode,
    setPseudocode,
    python,
    setPython,
    diagnostics: translationDiagnostics,
    status: translationStatus,
    errorSide: translationErrorSide,
  } = usePseudocodeTranslation(DUMMY_PSEUDOCODE);

  const runtime = usePseudocodeRuntime();

  const runtimeSnapshot = useMemo(
    () => ({
      state: runtime.state,
      consoleLines: runtime.consoleLines,
      diagnostics: runtime.diagnostics,
      variables: runtime.variables,
      frameName: runtime.frameName,
      steps: runtime.steps,
      awaitingInput: runtime.awaitingInput,
      paused: runtime.paused,
      pauseLocation: runtime.pauseLocation,
      callStack: runtime.callStack,
      breakpoints: runtime.breakpoints,
    }),
    [
      runtime.state,
      runtime.consoleLines,
      runtime.diagnostics,
      runtime.variables,
      runtime.frameName,
      runtime.steps,
      runtime.awaitingInput,
      runtime.paused,
      runtime.pauseLocation,
      runtime.callStack,
      runtime.breakpoints,
    ],
  );

  const coach = useAICoach({
    pseudocode,
    python,
    translationStatus,
    translationErrorSide,
    translationDiagnostics,
    runtime: runtimeSnapshot,
  });

  const onPseudocodeSelectionChange = useCallback((text: string) => {
    setEditorSelection(text, 'pseudocode');
  }, []);
  const onPythonSelectionChange = useCallback((text: string) => {
    setEditorSelection(text, 'python');
  }, []);

  const handleActivityChange = useCallback((id: ActivityId) => {
    setActivity(id);
    if (id === 'ai') {
      setRightTab('ai');
      setRightOpen(true);
    }
    if (id === 'debug') {
      setSidebarOpen(true);
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setIsDesktop(mq.matches);
    sync();
    setMounted(true);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (
      translationDiagnostics.length > 0 ||
      runtime.consoleLines.length > 0 ||
      runtime.diagnostics.length > 0 ||
      runtime.awaitingInput ||
      runtime.paused
    ) {
      setConsoleOpen(true);
    }
  }, [
    translationDiagnostics.length,
    runtime.consoleLines.length,
    runtime.diagnostics.length,
    runtime.awaitingInput,
    runtime.paused,
  ]);

  useEffect(() => {
    if (runtime.isBusy || runtime.variables.length > 0 || runtime.paused) {
      setRightTab('vars');
      setRightOpen(true);
    }
  }, [runtime.isBusy, runtime.variables.length, runtime.paused]);

  useEffect(() => {
    if (runtime.paused) {
      setActivity('debug');
      setSidebarOpen(true);
    }
  }, [runtime.paused]);

  const handleRun = () => {
    void runtime.run(pseudocode);
  };

  const handleRestart = () => {
    void runtime.restart(pseudocode);
  };

  const handleStepInto = () => {
    if (runtime.canStep) {
      runtime.stepInto();
      return;
    }
    void runtime.stepIntoFromIdle(pseudocode);
  };

  const activeLine = runtime.pauseLocation?.line ?? null;

  const coachPanel = (
    <AiAssistantPanel
      messages={coach.messages}
      busy={coach.busy}
      onAsk={coach.ask}
      providerId={coach.providerId}
    />
  );

  const consoleNode = (
    <ConsolePanel
      lines={runtime.consoleLines}
      runtimeDiagnostics={runtime.diagnostics}
      translationDiagnostics={translationDiagnostics}
      executionState={runtime.state}
      awaitingInput={runtime.awaitingInput}
      inputDraft={runtime.inputDraft}
      onInputDraftChange={runtime.setInputDraft}
      onSubmitInput={runtime.submitInput}
      onClear={runtime.clearConsole}
    />
  );

  const varsNode = (
    <VariableInspector
      rows={runtime.variables}
      frameName={runtime.frameName}
      executionState={runtime.state}
      callStack={runtime.callStack}
    />
  );

  const debugNode = (
    <DebugSidebar
      breakpoints={runtime.breakpoints}
      callStack={runtime.callStack}
      pausedLine={activeLine}
      onToggleBreakpoint={runtime.toggleBreakpoint}
      onRemoveBreakpoint={runtime.removeBreakpoint}
      onSetBreakpointEnabled={runtime.setBreakpointEnabled}
    />
  );

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
        executionState={runtime.state}
        isBusy={runtime.isBusy}
        canPause={runtime.canPause}
        canContinue={runtime.canContinue}
        canStep={runtime.canStep}
        onRun={handleRun}
        onStop={runtime.stop}
        onRestart={handleRestart}
        onPause={runtime.pause}
        onContinue={runtime.continue}
        onStepInto={handleStepInto}
        onStepOver={runtime.stepOver}
        onStepOut={runtime.stepOut}
      />

      <div className="relative flex min-h-0 flex-1">
        {!mounted ? null : isDesktop ? (
        <div className="flex min-h-0 flex-1">
          <ActivityBar active={activity} onChange={handleActivityChange} />

          <aside
            className={cn(
              'flex shrink-0 flex-col overflow-hidden border-r border-pp-line bg-pp-shell',
              'transition-[width,opacity] duration-200 ease-apple',
              sidebarOpen ? 'w-[232px] opacity-100 lg:w-[248px]' : 'w-0 opacity-0 border-r-0',
            )}
          >
            {sidebarOpen &&
              (activity === 'debug' ? (
                debugNode
              ) : (
                <FileExplorer
                  tree={DUMMY_FILES}
                  activeId={activeFileId}
                  onSelect={setActiveFileId}
                />
              ))}
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
                onPythonChange={setPython}
                onPseudocodeSelectionChange={onPseudocodeSelectionChange}
                onPythonSelectionChange={onPythonSelectionChange}
                translationStatus={translationStatus}
                translationErrorSide={translationErrorSide}
                translationDiagnostics={translationDiagnostics}
                activeLine={activeLine}
                breakpoints={runtime.breakpoints}
                onToggleBreakpoint={runtime.toggleBreakpoint}
              />
            </div>
            <div
              className={cn(
                'shrink-0 overflow-hidden border-t border-pp-line bg-pp-shell/40 transition-[height,opacity] duration-200 ease-apple',
                consoleOpen ? 'h-[180px] opacity-100 lg:h-[200px]' : 'h-0 border-t-0 opacity-0',
              )}
            >
              {consoleOpen && consoleNode}
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
                  {rightTab === 'ai' ? coachPanel : varsNode}
                </div>
              </>
            )}
          </aside>
        </div>
        ) : (
        <div className="flex min-h-0 flex-1 flex-col">
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
              onPythonChange={setPython}
              onPseudocodeSelectionChange={onPseudocodeSelectionChange}
              onPythonSelectionChange={onPythonSelectionChange}
              translationStatus={translationStatus}
              translationErrorSide={translationErrorSide}
              translationDiagnostics={translationDiagnostics}
              stacked
              activeLine={activeLine}
              breakpoints={runtime.breakpoints}
              onToggleBreakpoint={runtime.toggleBreakpoint}
            />
          )}
          {mobileView === 'console' && consoleNode}
          {mobileView === 'ai' && coachPanel}
          {mobileView === 'vars' && varsNode}
        </div>
        )}
      </div>

      <StatusBar
        translationStatus={translationStatus}
        diagnosticCount={translationDiagnostics.length}
        executionState={runtime.state}
        pauseLine={activeLine}
      />
      <MobileDock active={mobileView} onChange={setMobileView} />
    </div>
  );
}
