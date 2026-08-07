# @pseudopilot/conformance

Cross-package **conformance & reliability** suite for PseudoPilot Cambridge Core.

- Does **not** add language features or change semantics
- Hosts the official **Cambridge Regression Suite** on disk under [`corpus/`](./corpus/)
- Exercises lexer → parser → checker → translator → interpreter → language/compiler services

```bash
pnpm --filter @pseudopilot/conformance test
pnpm --filter @pseudopilot/conformance bench
pnpm --filter @pseudopilot/conformance corpus:seed   # refresh expect.python / reverse goldens
```

See [`docs/REGRESSION_SUITE.md`](../../docs/REGRESSION_SUITE.md) and [`docs/TESTING.md`](../../docs/TESTING.md).
