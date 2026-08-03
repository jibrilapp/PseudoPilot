# @pseudopilot/language-service

IDE language features for Cambridge 9618 pseudocode.

- **Consumes** `@pseudopilot/compiler-service` (incremental parse/check caches)
- **Reuses** `@pseudopilot/language-core` + `@pseudopilot/checker` via that cache
- **Does not** execute or translate
- **LSP-ready** 0-based positions/ranges

See [`docs/language/LANGUAGE_SERVICE.md`](../../docs/language/LANGUAGE_SERVICE.md) and [`INCREMENTAL_COMPILATION.md`](../../docs/language/INCREMENTAL_COMPILATION.md).

```bash
pnpm --filter @pseudopilot/language-service test
```
