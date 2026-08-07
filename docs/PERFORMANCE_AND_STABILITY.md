# PseudoPilot Performance & Stability

**Audit date:** 2026-08-07  
**Workspace:** `/Users/neemaawale/pseudopilot`  
**Goal:** Stress the compiler / translator / interpreter / debugger / IDE persistence layers under pathological load; record real timings; fix only correctness/stability defects.

---

## Methodology / environment

| Item | Value |
| --- | --- |
| OS | macOS (`darwin/arm64`) |
| Node | v22.23.1 |
| Date (UTC) | 2026-08-07T07:36:30Z |
| How measured | `performance.now()` wall clock inside Vitest; heap via `process.memoryUsage().heapUsed` |
| Cold start | Fresh Node child per package (`packages/conformance/scripts/cold-start.mjs`) |
| Stress suite | `pnpm --filter @pseudopilot/conformance stress` → `src/stress.bench.ts` + `src/bench.bench.ts` |
| Web (headless) | `apps/web` Vitest: `workspacePersistence.stress.test.ts`, `bidirectionalSync.stress.test.ts` |
| Extreme probes | One-off Node scripts (deep IF / 10k array / near char-limit) — numbers called out below |

**Honest limits of this pass**

| Exercised | Not fully exercised (needs browser / Monaco) |
| --- | --- |
| Parse / check / translate / reverse / interpret | Monaco render / scroll of 5k+ lines |
| Incremental compiler edit spam | Undo/redo stack spam in the editor widget |
| Debugger hooks (pause / abort / frames / globals) | Glyph-margin UI with hundreds of visible breakpoints |
| Autosave serialize + in-memory `Storage` mock | Real `localStorage` quota / main-thread jank |
| Bidirectional sync debounce / loop guard | Split-pane caret / selection sync visuals |
| Package cold import in fresh processes | Next.js / browser first-paint startup |

Timings are single-run observational samples on a developer machine — not CI budgets. Re-run locally to compare.

```bash
pnpm --filter @pseudopilot/conformance stress
pnpm --filter @pseudopilot/conformance cold-start
pnpm --filter @pseudopilot/web exec vitest run \
  lib/ide/workspacePersistence.stress.test.ts \
  lib/translation/bidirectionalSync.stress.test.ts
```

---

## Benchmark results

### Cold start (fresh Node process per import)

| Package | Cold import (ms) | Pass |
| --- | ---: | --- |
| `@pseudopilot/language-core` | 6.8 | ✅ |
| `@pseudopilot/checker` | 12.3 | ✅ |
| `@pseudopilot/translator` | 20.5 | ✅ |
| `@pseudopilot/interpreter` | 16.5 | ✅ |
| `@pseudopilot/compiler-service` | 13.7 | ✅ |
| **Hello pipeline** (import + parse + check + translate + run `OUTPUT 1`) | **31.4** | ✅ |

### Compiler (parse + check)

| Scenario | Size | Time (ms) | Pass |
| --- | --- | ---: | --- |
| 5000 assignments | 5003 lines / 92 104 chars | 52.8 (parse 41.1 + check 11.7) | ✅ |
| Deep IF nesting depth=200 (indented) | 404 lines | 6.3 | ✅ |
| 2000 `DECLARE`s | 2051 lines | 16.2 | ✅ |
| Identifiers length=2000 ×5 | 30 169 chars | 2.4 | ✅ |
| `ARRAY[1:5000]` declare | 135 chars | 0.6 | ✅ |
| `TYPE` with 200 fields | 206 lines | 2.4 | ✅ |
| `CLASS` with 100 methods | 332 lines | 4.7 | ✅ |
| 500 `PROCEDURE`s | 1502 lines | 6.0 | ✅ |
| File ops 200 `WRITEFILE` | 212 lines | ~4 (prior run) | ✅ |
| IF nesting depth=600 → `P_NESTING_TOO_DEEP` (no throw) | compact | 26.5 | ✅ |
| Incremental cold open (3000 assigns) | 55 278 chars | cold 18.8 / warm ~0.0 | ✅ |
| 500 incremental single-line edits | — | 634.6 (501 parse runs) | ✅ |

**Existing micro-bench** (`src/bench.bench.ts`): large-60-loop parse+check+translate ≈ 9.7 + 7.5 + 22.0 ms; interpreter 40 loops ≈ 20 ms; cold/warm speedup ≈ 137×.

### Translator

| Scenario | Size | Time (ms) | Pass |
| --- | --- | ---: | --- |
| Pseudo → Python (5000 assignments) | 92 104 → 92 092 chars | 63.5 | ✅ |
| Python → Pseudo (2000 assignments) | 36 854 → 36 867 chars | 29.5 | ✅ |
| Reverse 5000 assignments (extreme probe) | — | 239 | ✅ |
| 1000 round-trips (small program) | final 62 chars | 93.4 | ✅ |
| Formatting stability (50 RT, unique last-10 forms) | unique=1 | 9.5 | ✅ |
| Long identifier preservation (len=80) | — | 0.4 | ✅ |
| CLASS 40 methods round-trip | 152 lines | 5.3 | ✅ |
| Live sync bootstrap 3000 lines (web) | 30 034 chars | 56.9 | ✅ |

### Interpreter / debugger

| Scenario | Detail | Time (ms) | Pass |
| --- | --- | ---: | --- |
| `ARRAY[1:2000]` fill+sum | steps=6004 | 47.2 | ✅ |
| `ARRAY[1:10000]` fill+sum (extreme) | steps=30004 | 253 | ✅ |
| Nested loops 100×100 | steps=20103 | 119.1 | ✅ |
| File WRITE/READ 500 lines | output `500` | 17.7 | ✅ |
| Recursion depth 200 + frame hooks | enters=201 | 9.3 | ✅ |
| 300 statement-hook “breakpoints” | hits=300 | 3.3 | ✅ |
| 500 decls → globals snapshot | globals=500 | 4.7 | ✅ |
| 100 start/stop/abort cycles | cancel while paused | 6.8 | ✅ |
| Debugger first-pause (hook latch) | package API | &lt;5 typical | ✅ |

### Editor / persistence (headless)

| Scenario | Detail | Time (ms) | Pass |
| --- | --- | ---: | --- |
| Autosave 5000-line buffers | 122 127 char payload | 0.6 | ✅ |
| 1000 continuous autosaves | avg ≈ 0.012 ms | 12.2 | ✅ |
| 10 000 dirty checks (large buffers) | — | 1.0 | ✅ |
| Oversized paste rejected (`WORKSPACE_MAX_CHARS`) | no corrupt prior save | — | ✅ |
| 200 rapid edits (debounce) | forwardCalls=2 | 1.1 | ✅ |
| 50 alternating pane edits | no infinite loop | — | ✅ |
| `restoreBuffers` 4000-line paste | no translate | 0.03 | ✅ |

### Memory

| Scenario | Heap Δ | Pass |
| --- | ---: | --- |
| 200 compile+translate cycles | +3.1 MB (39.9 → 43.0) | ✅ (&lt;150 MB soft fail) |
| 500 round-trips medium program (extreme probe) | −45.5 MB (GC noise; no growth) | ✅ |

No sustained leak signal under these Node cycles. Browser Worker / Monaco heap was **not** measured.

---

## Stress scenario pass/fail

| Area | Scenario | Result |
| --- | --- | --- |
| Compiler | 5k lines, 2k decls, long ids, large TYPE/CLASS, 500 procs | **PASS** |
| Compiler | IF nesting 200 | **PASS** |
| Compiler | IF nesting 600 (beyond limit) | **PASS** (diagnostic, no throw) — after fix |
| Translator | Large forward/reverse, 1000 RT, format stability, id preserve | **PASS** |
| Interpreter | Large array, nested loops, file I/O | **PASS** |
| Debugger | Deep stack, dense hooks, large var table, abort churn | **PASS** |
| Memory | Repeated compile/translate | **PASS** |
| Editor | Large autosave / spam / sync debounce | **PASS** (unit) |
| Limits | Default 256 000 char source (`P_SOURCE_TOO_LARGE`) | **PASS** (intentional reject) |
| Pre-fix | IF nesting ≥ ~600 translator / ≥ ~1385 checker / ≥ ~1900 parser | **FAIL** → uncaught `RangeError` |

---

## Discovered bugs

### BUG-1 — Pathological IF nesting threw `RangeError` (stack overflow) — **FIXED**

| | |
| --- | --- |
| **Symptom** | Compact nested `IF` depth ≈ 600+ crashed `translatePseudocodeToPython` with uncaught `RangeError: Maximum call stack size exceeded`. Checker overflowed ~1385; parser ~1900 (engine-dependent). |
| **Impact** | Stability — live translate / check could take down the IDE worker for adversarial or accidental deep nesting. |
| **Fix** | Default max block nesting **512** in the parser (`P_NESTING_TOO_DEEP` + balanced IF/ENDIF recovery); matching checker limit (`C_NESTING_TOO_DEEP`); `RangeError` safety nets on `parse` / `check` / translate entry points. |
| **Regression tests** | `packages/language-core/src/parse.limits.test.ts`, `packages/checker/src/nesting.limits.test.ts`, conformance `stress.bench.ts` nesting case, debugger rapid-abort cycles in `debugger.test.ts`. |
| **Est. fix effort** | Done (~1–2 h including recovery polish). |

### Non-bugs / intentional limits

| Observation | Notes |
| --- | --- |
| Sources &gt; 256 000 chars | `P_SOURCE_TOO_LARGE` / translator `maxSourceChars` (raisable to 2 000 000 absolute). |
| Deep IF with heavy indent | Hits char budget before nesting limit (indent spaces dominate). |
| Initial stress “100 start/stop” hang | **Test race** (released pause gate before hook latched) — not a product bug; harness fixed + regression added. |

---

## Memory concerns

- Node heap delta after 200 compile/translate cycles stayed ~**+3 MB** — no leak signal.
- Negative deltas on longer probes are GC noise; treat as “no growth,” not “freeing.”
- Residual risk: **browser** Monaco models + Worker copies of large buffers; not measured here. Soft IDE caps (`WORKSPACE_MAX_CHARS` = 400 000, translate debounce past 32 000 chars) mitigate.

---

## Performance hotspots

| Hotspot | Evidence | Severity | Estimated fix |
| --- | --- | --- | --- |
| **Full re-parse on every incremental edit** | 500 edits → 501 `parseRuns`, **635 ms** total | Medium for large buffers | Incremental/token reuse or narrower invalidation (1–3 d); not done (optimization). |
| **Forward translate of multi-kLOC programs** | 5k assigns ≈ **64 ms**; 15k near limit would be higher | Low–medium on weak laptops | Already debounced in IDE (`TRANSLATE_LARGE_DEBOUNCE_MS`); further IR caching optional. |
| **Interpreter nested loops** | 100×100 ≈ **119 ms** / 20k steps | Low for teaching programs | Step batching already present; fine for curriculum sizes. |
| **Large array runtime** | 10k fill+sum ≈ **253 ms** | Low | Acceptable; document for students. |
| **Cold package import** | Translator ~20 ms; hello pipeline ~31 ms | Low | Fine for Node; browser bundle/TTFB separate. |

No hotspot blocked stress pass after BUG-1.

---

## Estimated follow-ups (optional)

| Item | Effort | Why |
| --- | --- | --- |
| Monaco 5k-line paste + undo e2e (Playwright) | 0.5–1 d | Close the honest “editor responsiveness” gap |
| Incremental parse for tiny edits | 1–3 d | Cut 500-edit spam cost |
| CI job for `pnpm … stress` (nightly) | 1–2 h | Catch nesting/regressions early |
| Expose nesting limit in IDE Problems copy | 1–2 h | Student-facing clarity for `P_NESTING_TOO_DEEP` |

---

## Files added / touched for this audit

| Path | Role |
| --- | --- |
| `docs/PERFORMANCE_AND_STABILITY.md` | This report |
| `packages/conformance/src/stressGenerators.ts` | Pathological program generators |
| `packages/conformance/src/stress.bench.ts` | Stress + timing suite |
| `packages/conformance/scripts/cold-start.mjs` | Fresh-process import timings |
| `apps/web/lib/ide/workspacePersistence.stress.test.ts` | Autosave stress |
| `apps/web/lib/translation/bidirectionalSync.stress.test.ts` | Sync stress |
| `packages/language-core` nesting limit + recovery | **BUG-1 fix** |
| `packages/checker` nesting limit | **BUG-1 fix** |
| `packages/translator` `RangeError` → `T_NESTING_TOO_DEEP` | **BUG-1 fix** |
| `packages/conformance/src/debugger.test.ts` | Rapid abort regression |

---

## Related docs

- [`TESTING.md`](./TESTING.md) — how to run suites  
- [`CONFORMANCE.md`](./CONFORMANCE.md) — language truth  
- [`RELEASE_READINESS.md`](./RELEASE_READINESS.md) — product readiness (perf score context)
