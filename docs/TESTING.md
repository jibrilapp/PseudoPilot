# Testing PseudoPilot

PseudoPilot treats testing as a first-class quality layer. Language truth lives in
`@pseudopilot/language-core` + `@pseudopilot/checker`; behaviour is verified by
package unit tests **and** the cross-cutting **`@pseudopilot/conformance`** suite.

---

## Philosophy

1. **No semantics in tests** — suites must not invent language rules; they exercise the shipped compiler pipeline.
2. **Corpus-driven** — Cambridge-shaped programs live on disk in `@pseudopilot/conformance` (`packages/conformance/corpus/`, exposed as `CORPUS`) and grow over time. See [`REGRESSION_SUITE.md`](./REGRESSION_SUITE.md).
3. **Layered** — lexer → parser → checker → translator → interpreter → language/compiler services → IDE (apps/web).
4. **Regression forever** — every fixed bug gets a permanent regression test.
5. **Fuzz for crash resistance** — random junk/valid-ish programs must not hang or throw uncaught errors.
6. **Benchmarks are observational** — assert cache/termination correctness; log timings.

---

## How to run

```bash
# Full monorepo
pnpm test

# Conformance package only
pnpm --filter @pseudopilot/conformance test
pnpm --filter @pseudopilot/conformance bench
pnpm --filter @pseudopilot/conformance stress      # pathological sizes + timings
pnpm --filter @pseudopilot/conformance cold-start # fresh-process import timings

# IDE worker/debugger conformance (apps/web)
pnpm --filter @pseudopilot/web exec vitest run lib/conformance
```

Performance / stability report (measured numbers, hotspots, nesting-limit fix):
[`PERFORMANCE_AND_STABILITY.md`](./PERFORMANCE_AND_STABILITY.md).

---

## Package layout (`@pseudopilot/conformance`)

| Area | Files |
| --- | --- |
| **Cambridge Regression Suite (on-disk)** | `corpus/<category>/<id>/` — see [`REGRESSION_SUITE.md`](./REGRESSION_SUITE.md) |
| Corpus loader / API | `src/corpus/` (`CORPUS`, `corpusStats`, …) |
| Full-stage suite | `src/suite.test.ts` |
| Lexer / Parser / Checker | `src/lexer.test.ts`, `parser.test.ts`, `checker.test.ts` |
| Translator + round-trip | `src/translator.test.ts` |
| Interpreter stress | `src/interpreter.test.ts` |
| Debugger hooks | `src/debugger.test.ts` |
| Compiler / language service | `src/compiler-service.test.ts`, `language-service.test.ts` |
| Fuzz | `src/fuzz.test.ts` |
| End-to-end | `src/e2e.test.ts` |
| Regression (service-level) | `src/regression.test.ts` |
| Benchmarks | `src/bench.bench.ts` |
| Stress / stability timings | `src/stress.bench.ts`, `scripts/cold-start.mjs` — see [`PERFORMANCE_AND_STABILITY.md`](../PERFORMANCE_AND_STABILITY.md) |

IDE RuntimeController / in-process worker suites: `apps/web/lib/conformance/`.

Shared fixtures pointer: `tests/corpus/` → conformance on-disk corpus.

---

## Coverage (today)

| Layer | Status |
| --- | --- |
| Cambridge Core constructs (assign, control, routines, arrays, files, builtins) | ✅ corpus + run |
| Pseudo → Python | ✅ corpus |
| Pseudo → Python → Pseudo (semantic run check) | ✅ where supported; `skipRoundTrip` for known gaps |
| Interpreter limits (`maxSteps`, `maxCallDepth`, INPUT, files) | ✅ |
| Debugger hooks (pause/continue/step/abort) | ✅ package; IDE UI ✅ apps/web |
| Incremental compiler stress | ✅ |
| Language service IDE APIs | ✅ |
| Fuzz (crash/hang) | ✅ lightweight seeded |
| Monaco hover / completion / rename adapters | ✅ | `apps/web/lib/monaco` |
| Monaco sync vs debounce / version remount | ✅ | regression in `monaco.test.ts` |
| Debugger UI + Monaco decorations | ✅ | glyph margin + exec line |

---

## Known exclusions

- Random files are implemented (BYREF / BYVAL are implemented)
- Full Py→Cam fidelity for every builtin print form (see `skipRoundTrip`)
- Cryptographic fuzz / property-based infinite generation
- Real browser Worker flakiness (use `inProcess: true` in CI)

---

## Future corpus growth

Add fixtures under `packages/conformance/corpus/<category>/<id>/` (see [`REGRESSION_SUITE.md`](./REGRESSION_SUITE.md)). Prefer programs that:

1. Parse + check cleanly (or deliberately fail with `expectDiagnostics`)
2. Have deterministic `expectOutput`
3. Ship `expect.python` goldens
4. Round-trip when translator supports them — otherwise `reverse: "skip"` with a reason

```bash
pnpm --filter @pseudopilot/conformance corpus:seed   # refresh goldens
pnpm --filter @pseudopilot/conformance test
```

Promote gold fixtures into `tests/corpus/` is no longer needed — the conformance `corpus/` directory is authoritative.
