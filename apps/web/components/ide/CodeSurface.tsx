'use client';

import { useCallback, useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import type { Breakpoint } from '@/lib/debugger';
import {
  getIdeLanguageService,
  IDE_DOCUMENT_URI,
} from '@/lib/languageService';
import {
  ensurePseudocodeLanguage,
  acquireLanguageProviders,
  mergeEditorDecorations,
  diagnosticsToMarkers,
  applyExternalModelText,
  MONACO_FONT,
  LS_DIAGNOSTICS_DEBOUNCE_MS,
  PSEUDOCODE_LANGUAGE_ID,
  PYTHON_LANGUAGE_ID,
  createGenerationDebouncer,
  nextDocumentVersion,
  type MonacoMarkerData,
} from '@/lib/monaco';
import { cn } from '@/lib/cn';

type CodeSurfaceProps = {
  code: string;
  language: 'pseudocode' | 'python';
  editable?: boolean;
  onChange?: (value: string) => void;
  'aria-label'?: string;
  /** 1-based line currently paused on (pseudocode). */
  activeLine?: number | null;
  breakpoints?: readonly Breakpoint[];
  onToggleBreakpoint?: (line: number) => void;
  /**
   * Extra Monaco markers (e.g. reverse-translate errors on the Python pane).
   * Owner: `pseudopilot-translate`. Cleared when the array is empty.
   */
  externalMarkers?: readonly MonacoMarkerData[];
  /** Fired when the user selection changes (AI Coach grounding). */
  onSelectionChange?: (text: string) => void;
};

/**
 * Monaco-backed code surface.
 * Pseudocode pane: editable + LS providers + breakpoints + exec highlight.
 * Python pane: editable first-class peer (bidirectional translation).
 *
 * Language Service document text is updated synchronously on Pseudocode edits
 * so hover / completion / rename never see a stale buffer. Marker paints are
 * debounced. External `code` prop syncs via executeEdits (undo + cursor).
 */
export function CodeSurface({
  code,
  language,
  editable = false,
  onChange,
  'aria-label': ariaLabel,
  activeLine = null,
  breakpoints = [],
  onToggleBreakpoint,
  externalMarkers = [],
  onSelectionChange,
}: CodeSurfaceProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const decoRef = useRef<string[]>([]);
  const providersRef = useRef<{ dispose(): void } | null>(null);
  const mouseDisposeRef = useRef<Monaco.IDisposable | null>(null);
  const selectionDisposeRef = useRef<Monaco.IDisposable | null>(null);
  const versionRef = useRef(0);
  const suppressChangeRef = useRef(false);
  const onToggleBreakpointRef = useRef(onToggleBreakpoint);
  onToggleBreakpointRef.current = onToggleBreakpoint;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  const markerDebounceRef = useRef(
    createGenerationDebouncer(LS_DIAGNOSTICS_DEBOUNCE_MS),
  );

  const langId =
    language === 'pseudocode' ? PSEUDOCODE_LANGUAGE_ID : PYTHON_LANGUAGE_ID;

  const applyMarkers = useCallback(() => {
    if (language !== 'pseudocode') return;
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor) return;
    const model = editor.getModel();
    if (!model) return;
    const ls = getIdeLanguageService();
    const markers = diagnosticsToMarkers(ls.diagnostics(IDE_DOCUMENT_URI));
    monaco.editor.setModelMarkers(model, 'pseudopilot', markers);
  }, [language]);

  const applyExternalMarkers = useCallback(() => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor) return;
    const model = editor.getModel();
    if (!model) return;
    monaco.editor.setModelMarkers(
      model,
      'pseudopilot-translate',
      externalMarkers.map((m) => ({ ...m })),
    );
  }, [externalMarkers]);

  /** Sync LS buffer immediately (providers read this). Does not paint markers. */
  const syncLanguageService = useCallback(
    (source: string) => {
      if (language !== 'pseudocode') return;
      const ls = getIdeLanguageService();
      versionRef.current = nextDocumentVersion(
        ls,
        IDE_DOCUMENT_URI,
        versionRef.current,
      );
      ls.updateDocument(IDE_DOCUMENT_URI, source, versionRef.current);
    },
    [language],
  );

  const scheduleMarkers = useCallback(() => {
    markerDebounceRef.current.schedule(() => {
      applyMarkers();
    });
  }, [applyMarkers]);

  const applyDecorations = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || language !== 'pseudocode') return;
    const next = mergeEditorDecorations(breakpoints, activeLine);
    decoRef.current = editor.deltaDecorations(
      decoRef.current,
      next.map((d) => ({
        range: d.range,
        options: d.options,
      })),
    );
  }, [breakpoints, activeLine, language]);

  const clearEditorChrome = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    try {
      if (editor) {
        decoRef.current = editor.deltaDecorations(decoRef.current, []);
      }
      const model = editor?.getModel();
      if (monaco && model) {
        monaco.editor.setModelMarkers(model, 'pseudopilot', []);
        monaco.editor.setModelMarkers(model, 'pseudopilot-translate', []);
      }
    } catch {
      decoRef.current = [];
    }
  }, []);

  // Sync external value (translation / restart) without fighting keystrokes.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    suppressChangeRef.current = true;
    const result = applyExternalModelText(
      editor as unknown as Parameters<typeof applyExternalModelText>[0],
      code,
    );
    // Keep suppress through any deferred model-content listeners so peer
    // executeEdits cannot echo into onChange → opposite-direction translate.
    queueMicrotask(() => {
      suppressChangeRef.current = false;
    });
    if (result.applied && language === 'pseudocode') {
      syncLanguageService(code);
      scheduleMarkers();
    }
  }, [code, language, syncLanguageService, scheduleMarkers]);

  useEffect(() => {
    applyDecorations();
  }, [applyDecorations]);

  useEffect(() => {
    applyExternalMarkers();
  }, [applyExternalMarkers]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || activeLine == null || language !== 'pseudocode') return;
    editor.revealLineInCenter(activeLine);
  }, [activeLine, language]);

  useEffect(() => {
    return () => {
      markerDebounceRef.current.cancel();
      mouseDisposeRef.current?.dispose();
      mouseDisposeRef.current = null;
      selectionDisposeRef.current?.dispose();
      selectionDisposeRef.current = null;
      providersRef.current?.dispose();
      providersRef.current = null;
      clearEditorChrome();
    };
  }, [clearEditorChrome]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    ensurePseudocodeLanguage(monaco);
    monaco.editor.setTheme('pseudopilot-light');

    selectionDisposeRef.current?.dispose();
    selectionDisposeRef.current = editor.onDidChangeCursorSelection(() => {
      const model = editor.getModel();
      const sel = editor.getSelection();
      if (!model || !sel) {
        onSelectionChangeRef.current?.('');
        return;
      }
      const text = model.getValueInRange(sel);
      onSelectionChangeRef.current?.(text);
    });

    if (language === 'pseudocode') {
      const ls = getIdeLanguageService();
      versionRef.current = nextDocumentVersion(
        ls,
        IDE_DOCUMENT_URI,
        versionRef.current,
      );
      ls.openDocument(IDE_DOCUMENT_URI, code, versionRef.current);

      providersRef.current?.dispose();
      providersRef.current = acquireLanguageProviders(
        monaco,
        ls,
        IDE_DOCUMENT_URI,
      );
      applyMarkers();

      mouseDisposeRef.current?.dispose();
      mouseDisposeRef.current = editor.onMouseDown((e) => {
        if (
          e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
          e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS
        ) {
          const line = e.target.position?.lineNumber;
          if (line != null) {
            onToggleBreakpointRef.current?.(line);
          }
        }
      });
    }

    applyDecorations();
    applyExternalMarkers();
  };

  return (
    <div
      className={cn('relative min-h-0 flex-1', !editable && 'opacity-[0.98]')}
      data-testid={
        editable ? 'code-surface-editable' : 'code-surface-readonly'
      }
      data-language={language}
      aria-label={ariaLabel}
    >
      <Editor
        height="100%"
        language={langId}
        theme="pseudopilot-light"
        defaultValue={code}
        path={
          language === 'pseudocode'
            ? 'file:///src/main.pseudo'
            : 'file:///src/main.py'
        }
        onMount={handleMount}
        onChange={(value) => {
          if (suppressChangeRef.current) return;
          const next = value ?? '';
          onChange?.(next);
          if (language === 'pseudocode') {
            syncLanguageService(next);
            scheduleMarkers();
          }
        }}
        options={{
          readOnly: !editable,
          fontSize: MONACO_FONT.fontSize,
          lineHeight: MONACO_FONT.lineHeight,
          fontFamily: MONACO_FONT.fontFamily,
          fontLigatures: true,
          minimap: { enabled: true },
          lineNumbers: 'on',
          glyphMargin: language === 'pseudocode',
          folding: true,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          renderLineHighlight: 'line',
          matchBrackets: 'always',
          autoIndent: 'full',
          tabSize: 2,
          insertSpaces: true,
          multiCursorModifier: 'alt',
          find: { addExtraSpaceOnTop: false },
          scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          padding: { top: 8, bottom: 8 },
          overviewRulerBorder: false,
          fixedOverflowWidgets: true,
          ariaLabel: ariaLabel,
        }}
        loading={
          <div className="flex h-full items-center justify-center text-[12px] text-pp-muted">
            Loading editor…
          </div>
        }
      />
    </div>
  );
}
