# Testing PseudoPilot

PseudoPilot treats testing as a first-class quality layer. Language truth lives in
`@pseudopilot/language-core` + `@pseudopilot/checker`; behaviour is verified by
package unit tests **and** the cross-cutting **`@pseudopilot/conformance`** suite.

---

## Philosophy

1. **No semantics in tests** — suites must not invent language rules; they exercise the shipped compiler pipeline.
2. **Corpus-driven** — Cambridge-shaped programs live in `@pseudopilot/conformance` (`CORPUS`) and grow over time.
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

# IDE worker/debugger conformance (apps/web)
pnpm --filter @pseudopilot/web exec vitest run lib/conformance
```

---

## Package layout (`@pseudopilot/conformance`)

| Area | Files |
| --- | --- |
| Corpus | `src/corpus/index.ts` |
| Lexer / Parser / Checker | `src/lexer.test.ts`, `parser.test.ts`, `checker.test.ts` |
| Translator + round-trip | `src/translator.test.ts` |
| Interpreter stress | `src/interpreter.test.ts` |
| Debugger hooks | `src/debugger.test.ts` |
| Compiler / language service | `src/compiler-service.test.ts`, `language-service.test.ts` |
| Fuzz | `src/fuzz.test.ts` |
| End-to-end | `src/e2e.test.ts` |
| Regression | `src/regression.test.ts` |
| Benchmarks | `src/bench.bench.ts` |

IDE RuntimeController / in-process worker suites: `apps/web/lib/conformance/`.

Shared fixtures placeholder: `tests/corpus/` (points authors at the conformance corpus).

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

Add entries to `CORPUS` with tags (`for`, `file`, `recursion`, …). Prefer programs that:

1. Parse + check cleanly  
2. Have deterministic `expectOutput`  
3. Round-trip when translator supports them  

Promote gold fixtures into `tests/corpus/` once a stable snapshot format is chosen.
