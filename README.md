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
| `@pseudopilot/interpreter` | **AST interpreter** — async `RuntimeHost` (browser INPUT) + AbortSignal cancellation |
| `@pseudopilot/translator` | Bidirectional translation via IR (runs checker by default before lowering) |
| `apps/web` | Student IDE: **Run / Stop / Restart**, Console INPUT/OUTPUT, live Variables — executes interpreter (not Python) |
| Debugger UI / AI coach / remote sandbox | Not yet — hooks prepared |

**Interpreter supported subset:** assignment, I/O (host), expressions, CHAR, indexes, IF/WHILE/REPEAT/FOR/CASE, PROCEDURE/CALL, FUNCTION/RETURN, DECLARE, CONSTANT, arrays (bounds-checked), builtins, `&`.

**Translator supported subset (V11):** same Core surface for translation (no file I/O / BYREF).

Language docs: [`docs/language/`](./docs/language/) (including [`SEMANTICS.md`](./docs/language/SEMANTICS.md), [`INTERPRETER.md`](./docs/language/INTERPRETER.md)). IDE runtime: [`apps/web/lib/runtime/README.md`](./apps/web/lib/runtime/README.md).

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
                └──imports──►  @pseudopilot/interpreter  ──►  language-core + checker
                                    │
                               RuntimeController + IdeRuntimeHost
                                    │
                               AST tree-walk (async I/O)
```

**Boundary rule:** `language-core`, `checker`, `interpreter`, and `translator` must not import from `apps/*` or AI packages. Interpreter must **not** depend on translator. React components must **not** call the interpreter directly — use `RuntimeController`.

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

1. DECLARE + typing for INPUT / parameters
2. File I/O and builtins in the translator
3. Interpreter + sandboxed execution
4. Publishable package releases with changelog automation
5. Broader Cambridge Extended / OOP coverage
