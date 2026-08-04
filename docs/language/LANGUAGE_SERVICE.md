# PseudoPilot Language Service

IDE intelligence for Cambridge 9618 pseudocode. Lives in `@pseudopilot/language-service`.

**Does not execute code. Does not translate code. Does not re-implement the parser or semantic checker.**

---

## Pipeline

```
Editor text
    ↓
IncrementalCompiler     (@pseudopilot/compiler-service)
    ↓  (parse/check only when hash invalid)
Lexer + Parser          (@pseudopilot/language-core)
    ↓
Semantic Checker        (@pseudopilot/checker)  → diagnostics, SymbolInfo[]
    ↓
Occurrence index        (language-service)      → refs resolved against symbols
    ↓
Language Service APIs   hover, definition, refs, rename, completion, …
    ↓
IDE / future LSP adapter
```

Analysis is cached by **content hash** and **version**. Unchanged text never re-parses.
See [`INCREMENTAL_COMPILATION.md`](./INCREMENTAL_COMPILATION.md).

---

## Features

| Feature | API | Notes |
| --- | --- | --- |
| Hover | `hover` | Kind, type, constant value, callable signature, array bounds, scope, declaration location; **class/method/field/`NEW`** |
| Go to definition | `definition` / `findDeclaration` | Variables, constants, arrays, procedures, functions, parameters, **TYPE** names, **fields**, **CLASS names, methods, inherited fields/methods** |
| Find references | `references` | Decl + uses; scoped correctly under shadowing; TYPE/field refs; **class field/method refs, resolved through the inheritance chain** |
| Document symbols | `documentSymbols` | Outline from checker symbols (includes TYPE + fields, **and CLASS + its fields/methods**) |
| Workspace symbols | `workspaceSymbols` | Query filter across open documents |
| Completion | `completion` | Symbols, builtins, keywords; **fields after `.`** for records, **fields + methods (own + inherited) after `.`** for class instances; TYPE/CLASS names after DECLARE/RETURNS |
| Rename prepare | `prepareRename` | Rejects keywords, builtins, undeclared |
| Rename | `rename` | Validates duplicates / keywords / builtins; returns text edits only (TYPE + fields, **CLASS names/methods/fields**, namespaced per declaring class, supported) |
| Signature help | `signatureHelp` | Active parameter, names + types, return type |
| Classification | `classifyAt` | Identifier kind for future semantic highlighting |
| Diagnostics | `diagnostics` | Merged parse + checker (`C_*` / parse codes) — no duplicated messages |

---

## Performance

- **Hash + source cache:** `IncrementalCompiler` skips parse/check when source text is unchanged (fingerprint is informational; invalidation is source-equality based).
- **Language stage:** occurrence index rebuilt only when check output / source changes.
- **Feature memo:** hover / completion memoized by `(uri, hash, position)`; cleared on source change (including via shared `CompilerService`).
- **Single pass when cold:** one parse, one check, one AST walk for occurrences.
- Large-file goal: keep analysis off the React render path (debounce / worker later).

---

## Future LSP compatibility

Protocol types (`LsPosition`, `LsRange`, `LsLocation`) are **0-based**, matching LSP / Monaco / VS Code.

A future adapter maps:

| Language Service | LSP |
| --- | --- |
| `hover` | `textDocument/hover` |
| `definition` | `textDocument/definition` |
| `references` | `textDocument/references` |
| `documentSymbols` | `textDocument/documentSymbol` |
| `workspaceSymbols` | `workspace/symbol` |
| `prepareRename` / `rename` | rename methods |
| `completion` | `textDocument/completion` |
| `signatureHelp` | `textDocument/signatureHelp` |
| `diagnostics` | `publishDiagnostics` |

No architectural change required — only a thin transport layer (stdio JSON-RPC, Monaco providers, or VS Code `LanguageClient`).

Same package can power AI assistance (symbol context / hover text) without calling the interpreter.

See also [`TYPE_SYSTEM.md`](./TYPE_SYSTEM.md) for Monaco field completion after `.`, and
[`OBJECT_ORIENTED_PROGRAMMING.md`](./OBJECT_ORIENTED_PROGRAMMING.md) §8 for `CLASS`-specific
completion, hover, and rename behaviour (own vs. inherited members, visibility, override
namespacing). Coverage: `packages/language-service/src/classes.test.ts`.

---

## Limitations

- Monaco editor is wired in `apps/web` (providers adapt this package) — see [`../ide/MONACO.md`](../ide/MONACO.md).
- Completion is context-aware but not prefix-filtered by a partial word (host can filter).
- Signature help uses a source heuristic for call nesting (not a full expression-position binder).
- `FOR` loop variable uses the whole statement span for the write occurrence (AST stores the name as a string without its own span).
- Cross-file projects: workspace symbols only cover **open** documents in the store.
- Rename does not rewrite string literals or comments.
- Editor-only hint diagnostics are reserved; currently only parse + checker diagnostics are surfaced.

---

## Usage

```ts
import { LanguageService } from '@pseudopilot/language-service';

const ls = new LanguageService();
ls.openDocument('file:///main.pseudo', source, 1);

const tip = ls.hover('file:///main.pseudo', { line: 2, character: 4 });
const edits = ls.rename('file:///main.pseudo', { line: 2, character: 4 }, 'Total');
```

Tests: `pnpm --filter @pseudopilot/language-service test`
