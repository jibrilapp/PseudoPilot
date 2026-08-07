/**
 * Assemble {@link AIContext} from existing IDE engines — no re-parse / re-check.
 */

import type {
  AIContext,
  AIDiagnostic,
  AISymbol,
} from '@pseudopilot/ai-coach';
import { formatType } from '@pseudopilot/checker';
import {
  getIdeCompilerService,
  getIdeLanguageService,
  IDE_DOCUMENT_URI,
} from '@/lib/languageService';
import type { RuntimeSnapshot } from '@/lib/runtime/types';
import type { IdeDiagnostic, TranslationStatus } from '@/lib/translation/types';
import type { EditOrigin } from '@/lib/translation/bidirectionalSync';
import { summariseAst } from './astSummary';
import { getEditorSelection } from './selection';

export type CollectAIContextInput = {
  readonly pseudocode: string;
  readonly python: string;
  readonly translationStatus: TranslationStatus;
  readonly translationErrorSide: EditOrigin | null;
  readonly translationDiagnostics: readonly IdeDiagnostic[];
  readonly runtime: RuntimeSnapshot;
};

function mapIdeDiag(
  d: IdeDiagnostic,
  source: AIDiagnostic['source'],
): AIDiagnostic {
  return {
    id: d.id,
    severity: d.severity,
    code: d.code,
    message: d.message,
    ...(d.line != null ? { line: d.line } : {}),
    ...(d.column != null ? { column: d.column } : {}),
    ...(d.help != null ? { help: d.help } : {}),
    source,
  };
}

export function collectAIContext(input: CollectAIContextInput): AIContext {
  const ls = getIdeLanguageService();
  const compiler = getIdeCompilerService();
  const analysis = ls.getAnalysis(IDE_DOCUMENT_URI);

  const parserDiagnostics: AIDiagnostic[] = (
    analysis?.parseDiagnostics ?? []
  ).map((d, i) => ({
    id: `parse-${i}-${d.code}`,
    severity: d.severity === 'warning' ? 'warning' : 'error',
    code: d.code,
    message: d.message,
    line: d.span?.start.line,
    column: d.span?.start.column,
    source: 'parser' as const,
  }));

  const semanticDiagnostics: AIDiagnostic[] = (
    analysis?.checkResult?.diagnostics ??
    analysis?.diagnostics?.filter((d) => String(d.code).startsWith('C_')) ??
    []
  ).map((d, i) => ({
    id: `sem-${i}-${d.code}`,
    severity: d.severity === 'warning' ? 'warning' : 'error',
    code: d.code,
    message: d.message,
    line: d.span?.start.line,
    column: d.span?.start.column,
    ...(d.help != null ? { help: d.help } : {}),
    source: 'semantic' as const,
  }));

  const symbols: AISymbol[] = (analysis?.symbols ?? ls.getSymbols(IDE_DOCUMENT_URI))
    .filter((s) => !s.builtin)
    .slice(0, 80)
    .map((s) => ({
      name: s.name,
      kind: s.kind,
      type: formatType(s.type),
      line: s.span.start.line,
      column: s.span.start.column,
      ...(s.builtin ? { builtin: true } : {}),
      ...(s.containerName != null ? { containerName: s.containerName } : {}),
    }));

  const ast =
    analysis?.ast ?? compiler.getAst(IDE_DOCUMENT_URI) ?? null;
  const astSummary = summariseAst(ast);

  const runtimeErrors = input.runtime.diagnostics
    .filter(
      (d) =>
        d.severity === 'error' &&
        (d.code.startsWith('R_') ||
          input.runtime.state === 'runtimeError' ||
          input.runtime.state === 'semanticError'),
    )
    .map((d) => mapIdeDiag(d, 'runtime'));

  const selection = getEditorSelection();
  const selectedText =
    selection && selection.text.trim().length > 0 ? selection.text : null;

  return {
    documentUri: IDE_DOCUMENT_URI,
    pseudocode: input.pseudocode,
    python: input.python,
    translation: {
      // AI coach package status is idle|ok|error — pending is in-flight sync.
      status:
        input.translationStatus === 'pending'
          ? 'idle'
          : input.translationStatus,
      errorSide: input.translationErrorSide,
    },
    parserDiagnostics,
    semanticDiagnostics,
    translationDiagnostics: input.translationDiagnostics.map((d) =>
      mapIdeDiag(d, 'translation'),
    ),
    symbols,
    astSummary,
    debugger: {
      executionState: input.runtime.state,
      paused: input.runtime.paused,
      currentLine: input.runtime.pauseLocation?.line ?? null,
      currentColumn: input.runtime.pauseLocation?.column ?? null,
      frameName: input.runtime.frameName,
      step: input.runtime.pauseLocation?.step ?? null,
      depth: input.runtime.pauseLocation?.depth ?? null,
      variables: input.runtime.variables.map((v) => ({
        name: v.name,
        type: v.type,
        value: v.value,
        scope: v.scope,
      })),
      callStack: input.runtime.callStack.map((f) => ({
        id: f.id,
        name: f.name,
        kind: f.kind,
        ...(f.line != null ? { line: f.line } : {}),
      })),
      runtimeErrors,
    },
    selectedText,
    selectedLanguage: selectedText ? (selection?.language ?? null) : null,
  };
}
