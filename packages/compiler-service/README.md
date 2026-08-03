# @pseudopilot/compiler-service

Incremental compilation and document caching for PseudoPilot.

- Staged caches: parse → check → language → translate → interpret
- Content-hash + version identity
- Per-document invalidation + dependency graph (multi-file ready)
- Does **not** execute or translate; reuses `language-core` + `checker`

See [`docs/language/INCREMENTAL_COMPILATION.md`](../../docs/language/INCREMENTAL_COMPILATION.md).

```bash
pnpm --filter @pseudopilot/compiler-service test
```
