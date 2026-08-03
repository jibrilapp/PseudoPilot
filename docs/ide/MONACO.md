# Monaco editor integration

The student IDE (`apps/web`) uses **Monaco Editor** for both the pseudocode and Python panes.

## Architecture

```
Monaco Editor (CodeSurface)
    │  sync text → LanguageService.updateDocument (ide://main)
    │  debounced markers only
    ▼
CompilerService / LanguageService   (shared IncrementalCompiler)
    │  hover / completion / definition / rename / diagnostics
    ▼
Monaco providers + markers + decorations
    │
RuntimeController → Worker → Interpreter
    │  pauseLocation / breakpoints
    ▼
Monaco glyph margin + exec-line decoration + revealLineInCenter
```

**Rule:** Monaco adapters must not re-implement parse, check, or rename rules.
They only map `@pseudopilot/language-service` results to Monaco APIs.

Monaco never parses or type-checks. Providers call `LanguageService` only.
Document versions are monotonic across React remounts (`nextDocumentVersion`) so
CompilerService does not ignore updates under the LSP stale-version rule.

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
| `setModelMarkers` | `diagnostics` (debounced) |

Document URI: `ide://main` (`IDE_DOCUMENT_URI`).

## Debugger

- Click glyph margin / line numbers → `onToggleBreakpoint(line)` (1-based)
- Enabled breakpoints → `pp-bp-glyph`
- Disabled → `pp-bp-glyph-disabled`
- `activeLine` from `runtime.pauseLocation` → `pp-exec-line` + `revealLineInCenter`

## Performance

- **Document sync is immediate** on every edit (keeps hover/completion/rename fresh)
- **Marker paints** are debounced (`LS_DIAGNOSTICS_DEBOUNCE_MS` = 200) with a
  generation token so stale paints never overwrite newer diagnostics
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

- Single pseudocode buffer (no multi-tab LS documents yet)
- Semantic token provider not fully wired (`classifyAt` available)
- Workspace symbols UI not exposed in chrome
- Monaco workers load via `@monaco-editor/react` defaults
