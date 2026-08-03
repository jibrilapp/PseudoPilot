# Incremental Compilation

Staged document caching between the editor and the PseudoPilot frontend compilers.

**Package:** `@pseudopilot/compiler-service`

**Does not** execute code, translate code, or duplicate parser/checker logic.

---

## Pipeline

```
Editor text
    ↓
IncrementalCompiler     (@pseudopilot/compiler-service)
    │  source hash + version
    │  stage flags: parse → check → language → translate → interpret
    ↓
Lexer + Parser          (language-core)     ← only if parse invalid
    ↓
Semantic Checker        (checker)           ← only if check invalid
    ↓
Language Service        (occurrence index)  ← only if language invalid
    ↓
IDE / Translator / Interpreter (future consumers of the same cache)
```

---

## Cache design

Each open document stores:

| Field | Role |
| --- | --- |
| `uri` | Document identity |
| `version` | Editor version (LSP-style) |
| `source` | Current text |
| `hash` | FNV-1a content hash |
| `ast` | Cached program AST |
| `parseDiagnostics` | Lexer/parser diagnostics |
| `checkResult` / `symbols` / `diagnostics` | Semantic cache |
| `stages` | Validity flags per pipeline stage |
| `compiledAt` | Timestamp of last compile |
| `stats` | `parseRuns` / `checkRuns` / `cacheHits` / `cacheMisses` |

### Hit rules

1. **Same URI + same source text** → skip parse and check (even if version increments).
2. **Fingerprint (`hash`)** is `length:fnv1a` for consumers — **not** the sole invalidation key (collision-safe).
3. **Same URI + version unchanged + same text** → `DocumentStore` returns the same analysis object.
4. **Source text changes** → invalidate `parse` and all downstream stages for that URI only, plus transitive dependents.
5. **`version < current`** → update ignored (LSP stale-message rule); cache unchanged.
6. **Parse without check** clears semantic outputs so diagnostics/symbols cannot appear “current” while `stages.check` is false.

### Language service layer

`@pseudopilot/language-service` does **not** call `parse` / `check` directly. It:

1. Updates the shared `IncrementalCompiler`
2. Rebuilds the occurrence index only when the language stage is dirty
3. Memos hover / completion by `(uri, hash, position)` until content changes

---

## Dependency graph

```
Document A  ←── dependsOn ──  Document B
```

`setDependencies(B, [A])` records that B imports A. When A’s content changes, B’s parse stage is invalidated. Today Cambridge programs are single-file; the graph is ready for project workspaces without redesign.

---

## Public API

### `@pseudopilot/compiler-service`

```ts
import {
  IncrementalCompiler,
  CompilerService,
  hashSource,
} from '@pseudopilot/compiler-service';

const c = new IncrementalCompiler();
c.openDocument(uri, source, 1);
c.compile(uri);                 // cache hit if unchanged
c.updateDocument(uri, source, 2);
c.getDiagnostics(uri);
c.getSymbols(uri);
c.getAst(uri);
c.invalidate(uri, 'check');
c.dependencies.setDependencies(uri, deps);
```

`CompilerService` adds a session façade (`openDocument`, `compile`, `getHover`, …). IDE methods require a `LanguageFeatureProvider` (wired by language-service).

### Preferred IDE session

```ts
import { createCompilerSession } from '@pseudopilot/language-service';

const { compilerService, languageService } = createCompilerSession();
compilerService.openDocument(uri, source, 1);
compilerService.getHover(uri, { line: 0, character: 4 });
```

---

## Performance characteristics

Measured locally (Vitest, large synthetic Cambridge program ~3.5KB / 80 FOR loops):

| Scenario | Typical result |
| --- | --- |
| Cold compile | full parse + check (~9ms in sample run) |
| Warm compile | cache hit (~0.02ms, **~400×** faster) |
| Unchanged version bump | cache hit (hash equal) |
| Single-line edit | one reparse + recheck; next compile hits |

Run: `pnpm --filter @pseudopilot/compiler-service test` (includes `bench.bench.ts`).

---

## Future LSP / multi-file compatibility

| Concern | Design |
| --- | --- |
| LSP `textDocument/didChange` | Map to `updateDocument(uri, text, version)` |
| Background / worker compile | One `IncrementalCompiler` per worker; serialize per URI |
| Multi-tab | Multiple URIs in one compiler instance |
| Project imports | Populate `DependencyGraph`; invalidation already fans out |
| Cloud compile | Serialize `CompiledDocument` snapshots; hash as etag |
| Translate / interpret | Respect `stages.translate` / `stages.interpret` when those packages opt in |

---

## Limitations

- **Not fine-grained incremental parse** — a content change re-parses the whole document (still avoids work when unchanged).
- Translator / interpreter do not yet consume this cache (API reserved via stage flags).
- No persistent disk cache across process restarts.
- Hash is a **fingerprint** (length + FNV-1a); invalidation uses full source equality.
- Cached **AST graphs are shared** (immutable by contract — do not mutate).
- Concurrent updates to the same URI are not internally locked — hosts must serialize.
- Dependent documents re-parse when an upstream document changes (correct for future imports; extra work today).

---

## Related

- [`LANGUAGE_SERVICE.md`](./LANGUAGE_SERVICE.md) — IDE features over this cache
- [`SEMANTICS.md`](./SEMANTICS.md) — checker diagnostics (`C_*`)
