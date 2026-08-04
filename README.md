# PseudoPilot

Bidirectional **Cambridge International Computer Science (9618) pseudocode ↔ Python** tooling: deterministic language core, canonical-IR translator, and a student IDE with live translation.

> **Status:** experimental **0.x** — usable for teaching/exploration of the supported subset. Not a complete Cambridge implementation, not a sandboxed runner, and not API-stable until 1.0.
>
> **Affiliation:** PseudoPilot is an **unofficial** community project. It is **not** affiliated with, endorsed by, or connected to Cambridge Assessment International Education or the University of Cambridge.

**License:** [MIT](./LICENSE) · **Security:** [SECURITY.md](./SECURITY.md) · **Contributing:** [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## What works today

| Surface | Status |
| --- | --- |
| `@pseudopilot/language-core` | Lexer + parser + AST for a large Core subset (control flow, procedures, functions, DECLARE/arrays/files parsed) |
| `@pseudopilot/checker` | Semantic checker: scopes, symbols, types, undeclared names, call arity/types |
| `@pseudopilot/compiler-service` | Incremental compilation: document / AST / semantic caches, invalidation, dependency graph |
| `@pseudopilot/language-service` | IDE features (hover, definition, refs, rename, completion, signatures) — reuses compiler-service; no execute/translate |
| `@pseudopilot/conformance` | Cross-package Cambridge Core corpus, round-trips, stress, fuzz, benchmarks |
| `@pseudopilot/interpreter` | **AST interpreter** — async host, AbortSignal, debugger hooks, **virtual text files** |
| `@pseudopilot/translator` | Bidirectional translation via IR (includes text file I/O mapping) |
| `apps/web` | Student IDE: **Monaco** editor, Run / Debug / Console / Variables — interpreter in a **Web Worker**; VFS for files |
| AI coach / remote OS sandbox | Not yet |

**Interpreter supported subset:** assignment, I/O (host), expressions, CHAR, indexes, IF/WHILE/REPEAT/FOR/CASE, PROCEDURE/CALL, FUNCTION/RETURN, DECLARE, CONSTANT, arrays (bounds-checked), builtins, `&`, text file I/O (VFS), `TYPE` records, and `CLASS` OOP (single inheritance, `PUBLIC`/`PRIVATE`, `SUPER`, `NEW`).

**Translator supported subset (V14):** same Core surface for translation including text file I/O, `TYPE` records, and `CLASS` → Python class (forward only — no BYREF / DATE / RANDOM files / enum-pointer-SET TYPE).

Language docs: [`docs/language/`](./docs/language/) (including [`SEMANTICS.md`](./docs/language/SEMANTICS.md), [`TYPE_SYSTEM.md`](./docs/language/TYPE_SYSTEM.md), [`OBJECT_ORIENTED_PROGRAMMING.md`](./docs/language/OBJECT_ORIENTED_PROGRAMMING.md), [`INTERPRETER.md`](./docs/language/INTERPRETER.md), [`LANGUAGE_SERVICE.md`](./docs/language/LANGUAGE_SERVICE.md), [`INCREMENTAL_COMPILATION.md`](./docs/language/INCREMENTAL_COMPILATION.md)). Testing: [`docs/TESTING.md`](./docs/TESTING.md). IDE Monaco: [`docs/ide/MONACO.md`](./docs/ide/MONACO.md). IDE runtime: [`apps/web/lib/runtime/README.md`](./apps/web/lib/runtime/README.md). Execution worker: [`apps/web/lib/worker/README.md`](./apps/web/lib/worker/README.md). Debugger: [`apps/web/lib/debugger/README.md`](./apps/web/lib/debugger/README.md). Files: [`packages/interpreter/src/files/README.md`](./packages/interpreter/src/files/README.md).

---

## Quick start

```bash
# Node 22+ and pnpm 9+
corepack enable && corepack prepare pnpm@9.15.0 --activate
pnpm install
pnpm check

# Student IDE
pnpm --filter @pseudopilot/language-core build
pnpm --filter @pseudopilot/translator build
pnpm --filter @pseudopilot/web dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

### Library usage

```ts
import { translatePseudocodeToPython } from '@pseudopilot/translator';
import { runPseudocode, MemoryHost } from '@pseudopilot/interpreter';

const py = translatePseudocodeToPython(`OUTPUT 1 + 1`);

const host = new MemoryHost();
const run = runPseudocode(`OUTPUT 1 + 1`, { host });
```

Packages are currently `private: true` in the monorepo (consume via workspace). Public npm publish is deferred until a stable 0.x packaging pass.

---

## Architecture (current)

```
apps/web  ──imports──►  @pseudopilot/translator  ──►  language-core + checker
                │              │
                │         canonical IR (translation only)
                │
                ├──imports──►  @pseudopilot/interpreter  ──►  language-core + checker
                │                   │
                │              RuntimeController + IdeRuntimeHost (via Web Worker)
                │                   │
                │              AST tree-walk (async I/O)
                │
                ├── Monaco Editor (CodeSurface)
                │         │
                └──imports──►  @pseudopilot/language-service  ──►  compiler-service
                                    │                                  │
                               hover / definition / refs         IncrementalCompiler
                               (no execute, no translate)        (hash / AST / semantic caches)
                                                                         │
                                                                   language-core + checker
```

**Boundary rule:** `language-core`, `checker`, `compiler-service`, `interpreter`, `translator`, and `language-service` must not import from `apps/*` or AI packages. Interpreter must **not** depend on translator. Language service must **not** depend on interpreter or translator. `compiler-service` must **not** depend on language-service (features attach via provider). React components must **not** call the interpreter directly — use `RuntimeController`.

Scale notes for a future multi-tenant product: [`docs/architecture/scalability.md`](./docs/architecture/scalability.md).

---

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm check` | Typecheck, lint, and unit tests |
| `pnpm build` | Build packages/apps that define `build` |
| `pnpm test` | Unit tests |
| `pnpm format` | Prettier write |

CI runs `pnpm check` on every PR to `main` (see `.github/workflows/ci.yml`).

---

## Versioning

- Root and core packages track **0.8.x** while the product remains experimental
- Until **1.0.0**, minor versions may include breaking API changes
- See [CHANGELOG.md](./CHANGELOG.md)

---

## What’s next (high level)

1. Optional BYREF / DATE / Extended surface
2. Security sandbox / remote execution (reuse worker message protocol)
3. Publishable package releases with changelog automation
4. Broader Cambridge Extended / OOP coverage
5. Monaco editor + richer debugger (watches, conditional breakpoints)
