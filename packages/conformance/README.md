# @pseudopilot/conformance

Cross-package **conformance & reliability** suite for PseudoPilot Cambridge Core.

- Does **not** add language features or change semantics
- Exercises lexer → parser → checker → translator → interpreter → language/compiler services
- Hosts a growing Cambridge-style corpus

```bash
pnpm --filter @pseudopilot/conformance test
pnpm --filter @pseudopilot/conformance bench
```

See [`docs/TESTING.md`](../../docs/TESTING.md).
