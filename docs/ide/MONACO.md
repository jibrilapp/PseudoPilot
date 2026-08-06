# Monaco editor integration

The student IDE (`apps/web`) uses **Monaco Editor** for both the Pseudocode and
Python panes as **first-class editable** surfaces.

## Architecture

```
Pseudocode Monaco (CodeSurface)          Python Monaco (CodeSurface)
        │ user edit                                │ user edit
        ▼                                          ▼
usePseudocodeTranslation / createBidirectionalSync
        │ origin = pseudocode                      │ origin = python
        │ debounce → forward translate             │ debounce → reverse translate
        │ update Python only                       │ update Pseudocode only
        │ (no reverse)                             │ (no forward)
        ▼                                          ▼
CompilerService / LanguageService          Python markers (translate errors)
(shared IncrementalCompiler on             owner: pseudopilot-translate
 ide://main — Pseudocode only)
        │
RuntimeController → Worker → Interpreter
(always runs Pseudocode buffer; breakpoints unchanged by translate)
```

**Rule:** Monaco adapters must not re-implement parse, check, or rename rules.
They only map `@pseudopilot/language-service` results to Monaco APIs.

Monaco never parses or type-checks Pseudocode. Providers call `LanguageService`
only. Document versions are monotonic across React remounts
(`nextDocumentVersion`) so CompilerService does not ignore updates under the
LSP stale-version rule.

Translation uses `@pseudopilot/translator` via thin crash-safe adapters in
`lib/translation/runTranslate.ts`. The translator remains **independent** of
`IncrementalCompiler` (no architecture change).

## Bidirectional editing (origin-aware sync)

| User action | Scheduled work | Peer update | Loop guard |
| --- | --- | --- | --- |
| Edit Pseudocode | Forward `translatePseudocodeToPython` | Set Python text | Does **not** schedule reverse |
| Edit Python | Reverse `translatePythonToPseudocode` | Set Pseudocode text | Does **not** schedule forward |
| Apply peer text via `code` prop | — | `executeEdits` + `suppressChangeRef` | `onChange` suppressed; identical buffer edits are no-ops in `createBidirectionalSync` (blocks reverse echo) |

Controller: `lib/translation/bidirectionalSync.ts` (`createBidirectionalSync`).
React hook: `hooks/usePseudocodeTranslation.ts`.

Debounce: ~250ms (500ms above 32k chars), shared constants in
`lib/translation/types.ts`. Opposite-direction pending work is cancelled when
the user switches panes (generation tokens).

### Failure behaviour

| Failure | Visible peer | Diagnostics | Compiler / debugger |
| --- | --- | --- | --- |
| Forward (bad Pseudocode) | Last good Python | Console + LS markers on Pseudocode | Unchanged; LS still sees current Pseudocode |
| Reverse (bad Python) | Last good Pseudocode | Console + Monaco markers on Python | Unchanged; breakpoints / pause state kept |

### UX preservation

- Models are not recreated (`path` stable: `main.pseudo` / `main.py`)
- Peer sync uses `applyExternalModelText` → `executeEdits` (undo/redo) + clamp
  cursor + restore scroll
- Folding, minimap, selection: left to Monaco; sync only replaces text when the
  buffer actually differs
- Glyph margin / breakpoints remain Pseudocode-only

## Provider mapping

| Monaco API | Language Service |
| --- | --- |
| HoverProvider | `hover` |
| CompletionItemProvider | `completion` |
| SignatureHelpProvider | `signatureHelp` |
| DefinitionProvider | `definition` |
| ReferenceProvider | `references` |
| RenameProvider | `prepareRename` / `rename` |
| DocumentSymbolProvider | `documentSymbols` |
| `setModelMarkers` (`pseudopilot`) | `diagnostics` (debounced, Pseudocode) |
| `setModelMarkers` (`pseudopilot-translate`) | Reverse-translate `IdeDiagnostic`s (Python) |

Document URI: `ide://main` (`IDE_DOCUMENT_URI`).

## Debugger

- Click glyph margin / line numbers → `onToggleBreakpoint(line)` (1-based)
- Enabled breakpoints → `pp-bp-glyph`
- Disabled → `pp-bp-glyph-disabled`
- `activeLine` from `runtime.pauseLocation` → `pp-exec-line` + `revealLineInCenter`
- Run/Debug always targets the **Pseudocode** buffer (after a successful reverse)

## Performance

- **Document sync is immediate** on every Pseudocode edit (keeps hover/completion/rename fresh)
- **Marker paints** are debounced (`LS_DIAGNOSTICS_DEBOUNCE_MS` = 200) with a
  generation token so stale paints never overwrite newer diagnostics
- **Translation** is separately debounced; stale forward/reverse results are dropped
- External `code` prop syncs only when model text differs (no keystroke thrash)
- Cursor movement does **not** reparse
- Compiler content-hash cache reused via `createCompilerSession`
- Language providers are ref-counted (one registration per language, not per mount)

## Built-in Monaco features (no extra code)

Syntax highlighting (Monarch + Python), brackets, folding, minimap, search/replace,
multi-cursor, undo/redo, word wrap, auto-indent.

## Future

The same LS adapter can drive a VS Code extension or LSP server without changing
`@pseudopilot/language-service` / `compiler-service`.

## Limitations

- Single Pseudocode LS buffer (no multi-tab LS documents yet)
- Semantic token provider not fully wired (`classifyAt` available)
- Workspace symbols UI not exposed in chrome
- Monaco workers load via `@monaco-editor/react` defaults
- Python pane has no Cambridge language service (syntax highlighting only +
  translate markers)
