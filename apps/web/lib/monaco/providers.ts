/**
 * Register Monaco language features against PseudoPilot LanguageService.
 * Providers only adapt LS outputs — no duplicate parse/check.
 */

import type * as Monaco from 'monaco-editor';
import type { LanguageService } from '@pseudopilot/language-service';
import {
  mapCompletions,
  mapDocumentSymbols,
  mapSignatureHelp,
  hoverToMarkdown,
} from './mapProviders';
import {
  monacoToLs,
  lsRangeToMonaco,
  PSEUDOCODE_LANGUAGE_ID,
} from './protocol';

export type ProviderDisposables = {
  dispose(): void;
};

/**
 * Shared provider registration (language-scoped, not per-editor).
 * Ref-counted so React Strict Mode remounts do not stack duplicate providers.
 */
let sharedProviders: {
  disposables: ProviderDisposables;
  refs: number;
} | null = null;

/** Acquire language providers; call `dispose` when the editor unmounts. */
export function acquireLanguageProviders(
  monaco: typeof Monaco,
  ls: LanguageService,
  uri: string,
): ProviderDisposables {
  if (!sharedProviders) {
    sharedProviders = {
      disposables: registerLanguageProviders(monaco, ls, uri),
      refs: 0,
    };
  }
  sharedProviders.refs += 1;
  let released = false;
  return {
    dispose() {
      if (released || !sharedProviders) return;
      released = true;
      sharedProviders.refs -= 1;
      if (sharedProviders.refs <= 0) {
        sharedProviders.disposables.dispose();
        sharedProviders = null;
      }
    },
  };
}

/** Test helper — drop shared provider state between Vitest cases. */
export function resetLanguageProvidersForTests(): void {
  sharedProviders?.disposables.dispose();
  sharedProviders = null;
}

export function registerLanguageProviders(
  monaco: typeof Monaco,
  ls: LanguageService,
  uri: string,
): ProviderDisposables {
  const disposables: Monaco.IDisposable[] = [];

  disposables.push(
    monaco.languages.registerHoverProvider(PSEUDOCODE_LANGUAGE_ID, {
      provideHover(model, position) {
        void model;
        const tip = ls.hover(uri, monacoToLs(position));
        const md = hoverToMarkdown(tip);
        if (!md || !tip) return null;
        const r = lsRangeToMonaco(tip.range);
        return {
          range: new monaco.Range(
            r.startLineNumber,
            r.startColumn,
            r.endLineNumber,
            r.endColumn,
          ),
          contents: [{ value: md }],
        };
      },
    }),
  );

  disposables.push(
    monaco.languages.registerCompletionItemProvider(PSEUDOCODE_LANGUAGE_ID, {
      triggerCharacters: ['.', ' ', '('],
      provideCompletionItems(model, position) {
        const items = ls.completion(uri, monacoToLs(position));
        const word = model.getWordUntilPosition(position);
        const range = new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn,
        );
        return {
          suggestions: mapCompletions(items).map((i) => ({
            label: i.label,
            kind: i.kind as Monaco.languages.CompletionItemKind,
            detail: i.detail,
            documentation: i.documentation,
            insertText: i.insertText,
            range,
          })),
        };
      },
    }),
  );

  disposables.push(
    monaco.languages.registerSignatureHelpProvider(PSEUDOCODE_LANGUAGE_ID, {
      signatureHelpTriggerCharacters: ['(', ','],
      provideSignatureHelp(_model, position) {
        const help = mapSignatureHelp(
          ls.signatureHelp(uri, monacoToLs(position)),
        );
        if (!help) return null;
        return {
          value: help,
          dispose() {},
        };
      },
    }),
  );

  disposables.push(
    monaco.languages.registerDefinitionProvider(PSEUDOCODE_LANGUAGE_ID, {
      provideDefinition(model, position) {
        const loc = ls.definition(uri, monacoToLs(position));
        if (!loc) return null;
        const r = lsRangeToMonaco(loc.range);
        return {
          uri: model.uri,
          range: new monaco.Range(
            r.startLineNumber,
            r.startColumn,
            r.endLineNumber,
            r.endColumn,
          ),
        };
      },
    }),
  );

  disposables.push(
    monaco.languages.registerReferenceProvider(PSEUDOCODE_LANGUAGE_ID, {
      provideReferences(model, position) {
        return ls.references(uri, monacoToLs(position)).map((loc) => {
          const r = lsRangeToMonaco(loc.range);
          return {
            uri: model.uri,
            range: new monaco.Range(
              r.startLineNumber,
              r.startColumn,
              r.endLineNumber,
              r.endColumn,
            ),
          };
        });
      },
    }),
  );

  disposables.push(
    monaco.languages.registerRenameProvider(PSEUDOCODE_LANGUAGE_ID, {
      provideRenameEdits(model, position, newName) {
        const result = ls.rename(uri, monacoToLs(position), newName);
        if (!result.ok) {
          return {
            edits: [],
            rejectReason: result.message,
          } as Monaco.languages.WorkspaceEdit & Monaco.languages.Rejection;
        }
        const edits: Monaco.languages.IWorkspaceTextEdit[] =
          result.edit.edits.map((e) => {
            const r = lsRangeToMonaco(e.range);
            return {
              resource: model.uri,
              versionId: model.getVersionId(),
              textEdit: {
                range: new monaco.Range(
                  r.startLineNumber,
                  r.startColumn,
                  r.endLineNumber,
                  r.endColumn,
                ),
                text: e.newText,
              },
            };
          });
        return { edits };
      },
      resolveRenameLocation(model, position) {
        void model;
        const prep = ls.prepareRename(uri, monacoToLs(position));
        if (!prep.ok) {
          return Promise.reject(prep.message);
        }
        const r = lsRangeToMonaco(prep.range);
        return {
          range: new monaco.Range(
            r.startLineNumber,
            r.startColumn,
            r.endLineNumber,
            r.endColumn,
          ),
          text: prep.placeholder,
        };
      },
    }),
  );

  disposables.push(
    monaco.languages.registerDocumentSymbolProvider(PSEUDOCODE_LANGUAGE_ID, {
      provideDocumentSymbols() {
        return mapDocumentSymbols(ls.documentSymbols(uri)).map((s) => ({
          name: s.name,
          detail: s.detail,
          kind: s.kind as Monaco.languages.SymbolKind,
          tags: [],
          range: new monaco.Range(
            s.range.startLineNumber,
            s.range.startColumn,
            s.range.endLineNumber,
            s.range.endColumn,
          ),
          selectionRange: new monaco.Range(
            s.selectionRange.startLineNumber,
            s.selectionRange.startColumn,
            s.selectionRange.endLineNumber,
            s.selectionRange.endColumn,
          ),
        }));
      },
    }),
  );

  return {
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
