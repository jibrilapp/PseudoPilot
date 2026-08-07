'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DUMMY_PSEUDOCODE,
  DUMMY_TABS,
} from '@/lib/dummy';
import { usePseudocodeTranslation } from '@/hooks/usePseudocodeTranslation';
import { usePseudocodeRuntime } from '@/hooks/usePseudocodeRuntime';
import { setEditorSelection, useAICoach } from '@/lib/aiCoach';
import { ENABLE_AI_COACH } from '@/lib/featureFlags';
import { collectCompilerIdeDiagnostics } from '@/lib/ide/compilerDiagnostics';
import {
  clampConsoleHeight,
  clampEditorSplit,
  clampRightWidth,
  clampSidebarWidth,
  DEFAULT_IDE_LAYOUT,
  loadIdeLayout,
  patchIdeLayout,
  saveIdeLayout,
  type IdeLayoutState,
} from '@/lib/ide/layoutPersistence';
import {
  DEFAULT_PROGRAM_PANE,
  isProgramPaneId,
  PROGRAM_TITLE,
  type ProgramPaneId,
} from '@/lib/ide/programWorkspace';
import {
  NEW_FILE_TEMPLATE,
  WELCOME_EXAMPLES,
  type WelcomeExample,
} from '@/lib/ide/welcomeExamples';
import {
  createWorkspaceSnapshot,
  isWorkspaceDirty,
  loadWorkspaceSnapshot,
  saveWorkspaceSnapshot,
  WORKSPACE_AUTOSAVE_DEBOUNCE_MS,
  type WorkspaceSnapshot,
} from '@/lib/ide/workspacePersistence';
import {
  downloadPseudocode,
  downloadPython,
} from '@/lib/ide/workspaceDownload';
import { LS_DIAGNOSTICS_DEBOUNCE_MS } from '@/lib/monaco';
import type { IdeDiagnostic } from '@/lib/translation/types';
import { ActivityBar, type ActivityId } from './ActivityBar';
import { AiAssistantPanel } from './AiAssistantPanel';
import { ConsolePanel, type ConsoleTab } from './ConsolePanel';
import { DebugSidebar } from './DebugSidebar';
import { DocumentationView } from './DocumentationView';
import { DualEditor, type RevealRequest } from './DualEditor';
import { MobileDock } from './MobileDock';
import { ProgramWorkspace } from './ProgramWorkspace';
import { StatusBar } from './StatusBar';
import { Toolbar } from './Toolbar';
import { VariableInspector } from './VariableInspector';
import { WelcomeScreen } from './WelcomeScreen';
import { cn } from '@/lib/cn';

type MobileView = 'explorer' | 'editors' | 'console' | 'ai' | 'vars' | 'docs';

export function IdeShell() {
  const [activity, setActivity] = useState<ActivityId>('explorer');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [activeFileId, setActiveFileId] =
    useState<ProgramPaneId>(DEFAULT_PROGRAM_PANE);
  const [rightTab, setRightTab] = useState<'ai' | 'vars'>(
    ENABLE_AI_COACH ? 'ai' : 'vars',
  );
  const [mobileView, setMobileView] = useState<MobileView>('editors');
  const [mounted, setMounted] = useState(false);
  /** Avoid mounting desktop + mobile DualEditors together (CSS-hidden still runs Monaco). */
  const [isDesktop, setIsDesktop] = useState(false);
  const [layout, setLayout] = useState<IdeLayoutState>(DEFAULT_IDE_LAYOUT);
  const [showWelcome, setShowWelcome] = useState(false);
  /** Dedicated docs workspace — replaces editor chrome while active. */
  const [showDocs, setShowDocs] = useState(false);
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>('output');
  const [revealRequest, setRevealRequest] = useState<RevealRequest | null>(null);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [showRestoredBanner, setShowRestoredBanner] = useState(false);
  const [lastPersisted, setLastPersisted] = useState<WorkspaceSnapshot | null>(
    null,
  );
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const [compilerDiagnostics, setCompilerDiagnostics] = useState<
    IdeDiagnostic[]
  >([]);
  const revealNonce = useRef(0);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    pseudocode,
    setPseudocode,
    python,
    setPython,
    diagnostics: translationDiagnostics,
    status: translationStatus,
    errorSide: translationErrorSide,
    restoreBuffers,
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

  const updateLayout = useCallback((patch: Partial<IdeLayoutState>) => {
    setLayout((prev) => {
      const next = patchIdeLayout(prev, patch);
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => saveIdeLayout(next), 120);
      return next;
    });
  }, []);

  const dismissWelcome = useCallback(() => {
    setShowWelcome(false);
    updateLayout({ welcomeDismissed: true });
  }, [updateLayout]);

  const openDocs = useCallback(() => {
    setShowDocs(true);
    setShowWelcome(false);
    setActivity('docs');
    setMobileView('docs');
    updateLayout({ welcomeDismissed: true });
  }, [updateLayout]);

  const closeDocs = useCallback(() => {
    setShowDocs(false);
    setActivity((prev) => (prev === 'docs' ? 'explorer' : prev));
  }, []);

  const handleActivityChange = useCallback(
    (id: ActivityId) => {
      setActivity(id);
      if (id === 'docs') {
        openDocs();
        return;
      }
      closeDocs();
      if (ENABLE_AI_COACH && id === 'ai') {
        setRightTab('ai');
        setRightOpen(true);
        dismissWelcome();
      }
      if (id === 'debug') {
        setSidebarOpen(true);
        dismissWelcome();
      }
      if (id === 'explorer' || id === 'search') {
        dismissWelcome();
      }
    },
    [closeDocs, dismissWelcome, openDocs],
  );

  const revealLine = useCallback((line: number, column?: number) => {
    revealNonce.current += 1;
    setRevealRequest({ line, column, nonce: revealNonce.current });
    setShowWelcome(false);
    setShowDocs(false);
    setActivity((prev) => (prev === 'docs' ? 'explorer' : prev));
    setConsoleOpen(true);
  }, []);

  const openProblems = useCallback(() => {
    setConsoleOpen(true);
    setConsoleTab('problems');
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setIsDesktop(mq.matches);
    sync();
    const stored = loadIdeLayout();
    setLayout(stored);
    const params = new URLSearchParams(window.location.search);
    const docsParam = params.get('docs');
    const welcomeParam = params.get('welcome');
    if (docsParam === '1' || docsParam === 'true') {
      setShowDocs(true);
      setShowWelcome(false);
      setActivity('docs');
    } else if (welcomeParam === '0' || welcomeParam === 'false') {
      setShowWelcome(false);
    } else if (welcomeParam === '1' || welcomeParam === 'true') {
      setShowWelcome(true);
    } else {
      setShowWelcome(!stored.welcomeDismissed);
    }

    const snap = loadWorkspaceSnapshot();
    if (snap && (snap.pseudocode.length > 0 || snap.python.length > 0)) {
      restoreBuffers(snap.pseudocode, snap.python);
      setLastPersisted(snap);
      setShowRestoredBanner(true);
    } else {
      setLastPersisted(
        createWorkspaceSnapshot({
          title: PROGRAM_TITLE,
          pseudocode: DUMMY_PSEUDOCODE,
          python: '',
        }),
      );
    }
    setWorkspaceReady(true);
    setMounted(true);
    mq.addEventListener('change', sync);
    return () => {
      mq.removeEventListener('change', sync);
      if (persistTimer.current) clearTimeout(persistTimer.current);
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      if (saveHintTimer.current) clearTimeout(saveHintTimer.current);
    };
  }, [restoreBuffers]);

  useEffect(() => {
    if (!workspaceReady) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      const result = saveWorkspaceSnapshot({
        title: PROGRAM_TITLE,
        pseudocode,
        python,
      });
      if (result.ok) setLastPersisted(result.snapshot);
    }, WORKSPACE_AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [workspaceReady, pseudocode, python]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const dirty = isWorkspaceDirty(
        { title: PROGRAM_TITLE, pseudocode, python },
        lastPersisted,
      );
      if (!dirty) return;
      saveWorkspaceSnapshot({
        title: PROGRAM_TITLE,
        pseudocode,
        python,
      });
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [pseudocode, python, lastPersisted]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCompilerDiagnostics(collectCompilerIdeDiagnostics(pseudocode));
    }, LS_DIAGNOSTICS_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [pseudocode]);

  useEffect(() => {
    if (showDocs) return;
    if (
      translationDiagnostics.length > 0 ||
      compilerDiagnostics.length > 0 ||
      runtime.consoleLines.length > 0 ||
      runtime.diagnostics.length > 0 ||
      runtime.awaitingInput ||
      runtime.paused
    ) {
      setConsoleOpen(true);
    }
  }, [
    showDocs,
    translationDiagnostics.length,
    compilerDiagnostics.length,
    runtime.consoleLines.length,
    runtime.diagnostics.length,
    runtime.awaitingInput,
    runtime.paused,
  ]);

  useEffect(() => {
    if (showDocs) return;
    if (runtime.isBusy || runtime.variables.length > 0 || runtime.paused) {
      setRightTab('vars');
      setRightOpen(true);
    }
  }, [showDocs, runtime.isBusy, runtime.variables.length, runtime.paused]);

  useEffect(() => {
    if (runtime.paused) {
      setActivity('debug');
      setSidebarOpen(true);
    }
  }, [runtime.paused]);

  const handleNewFile = useCallback(
    (source: string) => {
      setPseudocode(source);
      setActiveFileId(DEFAULT_PROGRAM_PANE);
      closeDocs();
      dismissWelcome();
    },
    [setPseudocode, dismissWelcome, closeDocs],
  );

  const handleOpenExample = useCallback(
    (example: WelcomeExample) => {
      setPseudocode(example.source);
      setActiveFileId(DEFAULT_PROGRAM_PANE);
      closeDocs();
      dismissWelcome();
    },
    [setPseudocode, dismissWelcome, closeDocs],
  );

  const handleWorkspaceNewFile = useCallback(() => {
    handleNewFile(NEW_FILE_TEMPLATE);
  }, [handleNewFile]);

  const handleWorkspaceOpenExample = useCallback(() => {
    const first =
      WELCOME_EXAMPLES.find((e) => e.group === 'starter') ??
      WELCOME_EXAMPLES[0];
    if (first) handleOpenExample(first);
  }, [handleOpenExample]);

  const handleSelectPane = useCallback(
    (id: ProgramPaneId) => {
      setActiveFileId(id);
      dismissWelcome();
    },
    [dismissWelcome],
  );

  const handleSelectTab = useCallback(
    (id: string) => {
      if (isProgramPaneId(id)) setActiveFileId(id);
    },
    [],
  );

  const handleOpenDocs = useCallback(() => {
    openDocs();
  }, [openDocs]);

  const flashSaveHint = useCallback((message: string) => {
    setSaveHint(message);
    if (saveHintTimer.current) clearTimeout(saveHintTimer.current);
    saveHintTimer.current = setTimeout(() => setSaveHint(null), 2200);
  }, []);

  const handleSaveLocal = useCallback(() => {
    const result = saveWorkspaceSnapshot({
      title: PROGRAM_TITLE,
      pseudocode,
      python,
    });
    if (result.ok) {
      setLastPersisted(result.snapshot);
      flashSaveHint('Saved in this browser');
    } else if (result.reason === 'too_large') {
      flashSaveHint('Program too large to save in the browser');
    } else {
      flashSaveHint('Could not save — storage unavailable');
    }
  }, [flashSaveHint, pseudocode, python]);

  const handleDownloadPseudocode = useCallback(() => {
    downloadPseudocode(pseudocode, PROGRAM_TITLE);
  }, [pseudocode]);

  const handleDownloadPython = useCallback(() => {
    downloadPython(python, PROGRAM_TITLE);
  }, [python]);

  const problemCount =
    compilerDiagnostics.length +
    translationDiagnostics.length +
    runtime.diagnostics.length;

  const handleRun = () => {
    closeDocs();
    dismissWelcome();
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

  const coachPanel = ENABLE_AI_COACH ? (
    <AiAssistantPanel
      messages={coach.messages}
      busy={coach.busy}
      onAsk={coach.ask}
      providerId={coach.providerId}
    />
  ) : null;

  const consoleNode = (
    <ConsolePanel
      lines={runtime.consoleLines}
      runtimeDiagnostics={runtime.diagnostics}
      translationDiagnostics={translationDiagnostics}
      compilerDiagnostics={compilerDiagnostics}
      executionState={runtime.state}
      awaitingInput={runtime.awaitingInput}
      inputDraft={runtime.inputDraft}
      onInputDraftChange={runtime.setInputDraft}
      onSubmitInput={runtime.submitInput}
      onClear={runtime.clearConsole}
      showTimestamps={layout.showTimestamps}
      onToggleTimestamps={() =>
        updateLayout({ showTimestamps: !layout.showTimestamps })
      }
      activeTab={consoleTab}
      onTabChange={setConsoleTab}
      onRevealDiagnostic={revealLine}
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
      onRemoveBreakpoint={runtime.removeBreakpoint}
      onSetBreakpointEnabled={runtime.setBreakpointEnabled}
      onRevealLine={(line) => revealLine(line)}
    />
  );

  const dualEditorProps = {
    tabs: DUMMY_TABS,
    activeFileId,
    onSelectTab: handleSelectTab,
    pseudocode,
    python,
    onPseudocodeChange: setPseudocode,
    onPythonChange: setPython,
    onPseudocodeSelectionChange,
    onPythonSelectionChange,
    translationStatus,
    translationErrorSide,
    translationDiagnostics,
    activeLine,
    breakpoints: runtime.breakpoints,
    onToggleBreakpoint: runtime.toggleBreakpoint,
    editorSplit: layout.editorSplit,
    onEditorSplitChange: (ratio: number) =>
      updateLayout({ editorSplit: clampEditorSplit(ratio) }),
    revealRequest,
  } as const;

  const programWorkspace = (
    <ProgramWorkspace
      activePaneId={activeFileId}
      onSelectPane={handleSelectPane}
      onNewFile={handleWorkspaceNewFile}
      onOpenExample={handleWorkspaceOpenExample}
      onSaveLocal={handleSaveLocal}
      onDownloadPseudocode={handleDownloadPseudocode}
      onDownloadPython={handleDownloadPython}
      saveHint={saveHint}
    />
  );

  const restoredBanner =
    showRestoredBanner && !showWelcome && !showDocs ? (
      <div
        className="flex shrink-0 items-center gap-3 border-b border-pp-line bg-emerald-500/[0.08] px-3 py-1.5 text-[12.5px] text-pp-ink/90"
        role="status"
        data-testid="session-restored-banner"
      >
        <span className="min-w-0 flex-1 tracking-[-0.01em]">
          Restored previous session
        </span>
        <button
          type="button"
          className="shrink-0 rounded px-1.5 py-0.5 text-[12px] text-pp-muted transition-colors hover:text-pp-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent/40"
          onClick={() => setShowRestoredBanner(false)}
        >
          Dismiss
        </button>
      </div>
    ) : null;

  const centerEditors = showDocs ? (
    <DocumentationView />
  ) : showWelcome ? (
    <WelcomeScreen
      onNewFile={handleNewFile}
      onOpenExample={handleOpenExample}
      onOpenDocs={handleOpenDocs}
      onDismiss={dismissWelcome}
    />
  ) : (
    <DualEditor {...dualEditorProps} />
  );

  const centerWithConsole = (
    <div className="flex h-full min-h-0 flex-col">
      {restoredBanner}
      <div className="min-h-0 flex-1 overflow-hidden">{centerEditors}</div>
      {consoleOpen && !showDocs && (
        <>
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize console"
            aria-valuenow={layout.consoleHeight}
            tabIndex={0}
            className="group relative z-10 h-[5px] shrink-0 cursor-row-resize touch-none outline-none focus-visible:ring-2 focus-visible:ring-pp-accent/50"
            onPointerDown={(e) => {
              e.preventDefault();
              const startY = e.clientY;
              const startH = layout.consoleHeight;
              const onMove = (ev: PointerEvent) => {
                const delta = startY - ev.clientY;
                updateLayout({
                  consoleHeight: clampConsoleHeight(startH + delta),
                });
              };
              const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
              };
              document.body.style.cursor = 'row-resize';
              document.body.style.userSelect = 'none';
              window.addEventListener('pointermove', onMove);
              window.addEventListener('pointerup', onUp);
            }}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 24 : 8;
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                updateLayout({
                  consoleHeight: clampConsoleHeight(layout.consoleHeight + step),
                });
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                updateLayout({
                  consoleHeight: clampConsoleHeight(layout.consoleHeight - step),
                });
              }
            }}
          >
            <span
              aria-hidden
              className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-pp-lineStrong transition-colors group-hover:bg-pp-accent/45 group-focus-visible:bg-pp-accent/55"
            />
          </div>
          <div
            className="shrink-0 overflow-hidden border-t border-pp-line bg-pp-shell/40"
            style={{ height: layout.consoleHeight }}
          >
            {consoleNode}
          </div>
        </>
      )}
    </div>
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
        onOpenCoach={
          ENABLE_AI_COACH
            ? () => {
                setRightTab('ai');
                setRightOpen(true);
                setActivity('ai');
                dismissWelcome();
              }
            : undefined
        }
        translationStatus={translationStatus}
        onShowWelcome={() => {
          closeDocs();
          setShowWelcome(true);
        }}
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

            {sidebarOpen && !showDocs && (
              <>
                <aside
                  className="flex shrink-0 flex-col overflow-hidden border-r border-pp-line bg-pp-shell"
                  style={{ width: layout.sidebarWidth }}
                >
                  {activity === 'debug' ? (
                    debugNode
                  ) : (
                    programWorkspace
                  )}
                </aside>
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize sidebar"
                  aria-valuenow={layout.sidebarWidth}
                  tabIndex={0}
                  className="group relative z-10 w-[5px] shrink-0 cursor-col-resize touch-none outline-none focus-visible:ring-2 focus-visible:ring-pp-accent/50"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    const startX = e.clientX;
                    const startW = layout.sidebarWidth;
                    const onMove = (ev: PointerEvent) => {
                      updateLayout({
                        sidebarWidth: clampSidebarWidth(
                          startW + (ev.clientX - startX),
                        ),
                      });
                    };
                    const onUp = () => {
                      window.removeEventListener('pointermove', onMove);
                      window.removeEventListener('pointerup', onUp);
                      document.body.style.cursor = '';
                      document.body.style.userSelect = '';
                    };
                    document.body.style.cursor = 'col-resize';
                    document.body.style.userSelect = 'none';
                    window.addEventListener('pointermove', onMove);
                    window.addEventListener('pointerup', onUp);
                  }}
                  onKeyDown={(e) => {
                    const step = e.shiftKey ? 24 : 8;
                    if (e.key === 'ArrowLeft') {
                      e.preventDefault();
                      updateLayout({
                        sidebarWidth: clampSidebarWidth(
                          layout.sidebarWidth - step,
                        ),
                      });
                    } else if (e.key === 'ArrowRight') {
                      e.preventDefault();
                      updateLayout({
                        sidebarWidth: clampSidebarWidth(
                          layout.sidebarWidth + step,
                        ),
                      });
                    }
                  }}
                >
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-pp-lineStrong transition-colors group-hover:bg-pp-accent/45 group-focus-visible:bg-pp-accent/55"
                  />
                </div>
              </>
            )}

            <main className="flex min-w-0 flex-1 flex-col">{centerWithConsole}</main>

            {rightOpen && !showDocs && (
              <>
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize side panel"
                  aria-valuenow={layout.rightWidth}
                  tabIndex={0}
                  className="group relative z-10 w-[5px] shrink-0 cursor-col-resize touch-none outline-none focus-visible:ring-2 focus-visible:ring-pp-accent/50"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    const startX = e.clientX;
                    const startW = layout.rightWidth;
                    const onMove = (ev: PointerEvent) => {
                      // Dragging left edge of right panel: moving left increases width.
                      updateLayout({
                        rightWidth: clampRightWidth(
                          startW - (ev.clientX - startX),
                        ),
                      });
                    };
                    const onUp = () => {
                      window.removeEventListener('pointermove', onMove);
                      window.removeEventListener('pointerup', onUp);
                      document.body.style.cursor = '';
                      document.body.style.userSelect = '';
                    };
                    document.body.style.cursor = 'col-resize';
                    document.body.style.userSelect = 'none';
                    window.addEventListener('pointermove', onMove);
                    window.addEventListener('pointerup', onUp);
                  }}
                  onKeyDown={(e) => {
                    const step = e.shiftKey ? 24 : 8;
                    if (e.key === 'ArrowLeft') {
                      e.preventDefault();
                      updateLayout({
                        rightWidth: clampRightWidth(layout.rightWidth + step),
                      });
                    } else if (e.key === 'ArrowRight') {
                      e.preventDefault();
                      updateLayout({
                        rightWidth: clampRightWidth(layout.rightWidth - step),
                      });
                    }
                  }}
                >
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-pp-lineStrong transition-colors group-hover:bg-pp-accent/45 group-focus-visible:bg-pp-accent/55"
                  />
                </div>
                <aside
                  className="flex shrink-0 flex-col overflow-hidden border-l border-pp-line bg-pp-shell"
                  style={{ width: layout.rightWidth }}
                >
                  {ENABLE_AI_COACH ? (
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
                      <div
                        className="min-h-0 flex-1 animate-panel-in"
                        key={rightTab}
                      >
                        {rightTab === 'ai' ? coachPanel : varsNode}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-0.5 border-b border-pp-line px-1">
                        <span className="pp-tab" data-active="true">
                          Variables
                        </span>
                      </div>
                      <div className="min-h-0 flex-1 animate-panel-in">
                        {varsNode}
                      </div>
                    </>
                  )}
                </aside>
              </>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {mobileView === 'explorer' && (
              <ProgramWorkspace
                activePaneId={activeFileId}
                onSelectPane={(id) => {
                  handleSelectPane(id);
                  setMobileView('editors');
                }}
                onNewFile={() => {
                  handleWorkspaceNewFile();
                  setMobileView('editors');
                }}
                onOpenExample={() => {
                  handleWorkspaceOpenExample();
                  setMobileView('editors');
                }}
                onSaveLocal={handleSaveLocal}
                onDownloadPseudocode={handleDownloadPseudocode}
                onDownloadPython={handleDownloadPython}
                saveHint={saveHint}
              />
            )}
            {mobileView === 'editors' &&
              (showWelcome ? (
                <WelcomeScreen
                  onNewFile={handleNewFile}
                  onOpenExample={handleOpenExample}
                  onOpenDocs={handleOpenDocs}
                  onDismiss={dismissWelcome}
                />
              ) : (
                <div className="flex h-full min-h-0 flex-col">
                  {restoredBanner}
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <DualEditor {...dualEditorProps} stacked />
                  </div>
                </div>
              ))}
            {mobileView === 'docs' && <DocumentationView compact />}
            {mobileView === 'console' && consoleNode}
            {ENABLE_AI_COACH && mobileView === 'ai' && coachPanel}
            {mobileView === 'vars' && varsNode}
          </div>
        )}
      </div>

      <StatusBar
        translationStatus={translationStatus}
        diagnosticCount={problemCount}
        executionState={runtime.state}
        pauseLine={activeLine}
        onOpenProblems={openProblems}
      />
      <MobileDock active={mobileView} onChange={setMobileView} />
    </div>
  );
}
