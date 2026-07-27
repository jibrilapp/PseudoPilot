# Contributing to PseudoPilot

Thanks for helping improve PseudoPilot. This project targets Cambridge International Computer Science (9618) pseudocode fidelity — correctness beats cleverness.

## Prerequisites

- Node.js **22+** (see `.nvmrc`)
- pnpm **9+** (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)

```bash
pnpm install
pnpm check   # typecheck + lint + test
```

## Development workflow

1. Open an issue (or claim an existing one) before large changes.
2. Keep PRs focused: one concern per PR when practical.
3. Prefer extending tests over manual-only verification.
4. Do **not** expand the Cambridge subset without updating:
   - `docs/language/SPECIFICATION.md` / `TRANSLATION.md` / `PARSER_COVERAGE.md`
   - package READMEs and `PACKAGE_VERSION` / subset constants when the public surface changes

### Packages that matter today

| Package | Role |
| --- | --- |
| `@pseudopilot/language-core` | Cambridge lexer / parser / AST |
| `@pseudopilot/translator` | Canonical IR + ↔ Python |
| `@pseudopilot/web` | Student IDE (live pseudocode → Python) |

Stub packages (`interpreter`, `sandbox`, `ai-coach`, …) are placeholders — avoid drive-by rewrites unless you are delivering that subsystem.

### Local IDE

```bash
pnpm --filter @pseudopilot/language-core build
pnpm --filter @pseudopilot/translator build
pnpm --filter @pseudopilot/web dev
```

## API stability (0.x)

Until **1.0.0**:

- SemVer **minor** bumps may include breaking API changes
- Prefer additive changes; mark risky exports `@experimental` in JSDoc when unsure
- Keep `package.json` `exports` narrow — do not deep-import package internals from apps

## Testing

```bash
pnpm test
# or targeted:
pnpm --filter @pseudopilot/language-core test
pnpm --filter @pseudopilot/translator test
```

Add regression tests for every bugfix. Prefer round-trip (Cambridge → Python → Cambridge) cases for translator changes.

## Commit and PR hygiene

- Write imperative commit subjects (`fix: …`, `feat: …`, `docs: …`)
- Fill in the PR template
- Ensure CI is green (`check` workflow)
- Do not commit secrets, `.env`, or large binaries

## Code of conduct

Participation is governed by [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](./LICENSE).
