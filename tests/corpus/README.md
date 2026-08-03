# Corpus tests

Gold-standard Cambridge-shaped programs for PseudoPilot.

**Active corpus:** `@pseudopilot/conformance` → `src/corpus/index.ts` (`CORPUS`).

This directory remains the home for future on-disk `.pseudo` fixtures / expected I/O snapshots.
Until then, add programs to the conformance package corpus so they run in CI via:

```bash
pnpm --filter @pseudopilot/conformance test
```

See [`docs/TESTING.md`](../docs/TESTING.md).
