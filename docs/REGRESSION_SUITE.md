# PseudoPilot Cambridge Regression Suite

**Package:** `@pseudopilot/conformance`  
**Corpus root:** [`packages/conformance/corpus/`](../packages/conformance/corpus/)  
**Loader / API:** [`packages/conformance/src/corpus/`](../packages/conformance/src/corpus/)  
**Stage suite:** [`packages/conformance/src/suite.test.ts`](../packages/conformance/src/suite.test.ts)

This is the **official** Cambridge-shaped regression corpus for PseudoPilot. It does **not** add language features. It locks lexer → parser → checker → interpreter → translator → reverse translator → diagnostics behaviour against gold fixtures.

Related: [`TESTING.md`](./TESTING.md) · [`CONFORMANCE.md`](./CONFORMANCE.md) · [`language/README.md`](./language/README.md)

---

## Corpus organisation

```
packages/conformance/corpus/
  variables/
  selection/
  iteration/
  arrays/
  strings/
  procedures/
  functions/
  byref/
  records/
  classes/
  files/
  random-files/
  date/
  algorithms/
  past-papers/
  edge-cases/
  regressions/
```

Each entry is a directory:

```
corpus/<category>/<id>/
  program.pp            # Pseudocode source
  meta.json             # title, tags, I/O, diagnostics, reverse policy
  expect.python         # gold Python (clean programs)
  expect.reverse.pp     # gold reverse Pseudocode when reverse: "check"
```

### `meta.json` fields

| Field | Meaning |
| --- | --- |
| `title` | Human-readable name |
| `tags` | Search / filter tags |
| `inputs` | `INPUT` queue for the interpreter |
| `expectOutput` | Exact console lines |
| `expectDiagnostics` | `{ code, severity? }[]` for failure fixtures |
| `expectClean` | `false` → program is expected to fail parse/check |
| `skipRun` | Skip interpreter assertion |
| `reverse` | `"check"` \| `"skip"` |
| `reverseSkipReason` | **Required** when `reverse: "skip"` |
| `notes` | Licensing, cross-package refs, web-only bugs |

Ids must be **unique across all categories**.

---

## How verification works

`src/suite.test.ts` loads every fixture and asserts:

| Stage | Clean programs | Diagnostic fixtures |
| --- | --- | --- |
| **Lexer** | No error diagnostics | Must not throw |
| **Parser** | `parse.ok` | Expected `E_*` codes when listed |
| **Checker** | `check.ok` | Expected `C_*` codes when listed |
| **Interpreter** | `expectOutput` (+ `inputs`) | Skipped (`skipRun`) |
| **Translator** | Exact match to `expect.python` | Skipped |
| **Reverse** | If `reverse: "check"`: gold `expect.reverse.pp` (when present) **and** reverse-then-run matches `expectOutput` | `reverse: "skip"` |
| **Diagnostics** | Empty / listed codes | Must include every listed code |

Existing layer tests (`lexer.test.ts`, `parser.test.ts`, `checker.test.ts`, `interpreter.test.ts`, `translator.test.ts`, …) still iterate `CORPUS` but skip `expectClean: false` where appropriate.

**Policy:** if reverse is flaky for an entry, set `reverse: "skip"` with an explicit reason — never weaken global reverse assertions.

Run:

```bash
pnpm --filter @pseudopilot/conformance test
```

Refresh goldens after intentional translator/interpreter changes (review the diff):

```bash
pnpm --filter @pseudopilot/conformance corpus:seed
```

Or edit fixtures by hand and update `expect.python` / `expect.reverse.pp` carefully.

---

## How to add a regression

1. **Reproduce** the bug with the smallest Cambridge program that fails (or that used to fail).
2. Create `packages/conformance/corpus/<category>/<id>/` (prefer `regressions/` for bug locks; use the construct category when documenting a feature permanently).
3. Add `program.pp` + `meta.json` with `expectOutput` (or `expectDiagnostics` + `expectClean: false`).
4. Generate goldens:
   ```bash
   pnpm --filter @pseudopilot/conformance corpus:seed
   ```
   Or copy `expect.python` from a one-off `translatePseudocodeToPython` run.
5. If reverse cannot preserve behaviour, set `"reverse": "skip"` and `"reverseSkipReason": "…"`.
6. Run `pnpm --filter @pseudopilot/conformance test` — must be green.
7. **Never delete** a regression entry once a bug is fixed; keep it forever.

### Cross-package / web-only bugs

Some historical bugs are not expressible as Pseudocode programs:

| Topic | Where the real test lives | Corpus stub |
| --- | --- | --- |
| Live sync / unrelated Pseudocode mutation | `apps/web` Monaco / bidirectional sync tests | `regressions/note-live-sync-web-only` |
| AI Coach intent routing | `packages/ai-coach` (`index.test.ts` intent cases) | `regressions/note-ai-coach-routing` |

Stubs keep the suite inventory complete without inventing false package-level proofs.

---

## Coverage statistics

Counts below are from the seeded suite (regenerate after edits; `corpusStats(CORPUS)` in tests also guards non-empty categories).

| Category | Entries |
| --- | ---: |
| variables | 5 |
| selection | 5 |
| iteration | 6 |
| arrays | 4 |
| strings | 4 |
| procedures | 4 |
| functions | 4 |
| byref | 5 |
| records | 5 |
| classes | 3 |
| files | 3 |
| random-files | 3 |
| date | 3 |
| algorithms | 5 |
| past-papers | 5 |
| edge-cases | 5 |
| regressions | 11 |
| **Total** | **80** |

| Stage fixture coverage (approx.) | Count |
| --- | ---: |
| Programs with `expect.python` | 77 |
| Programs with `expect.reverse.pp` | 69 |
| `reverse: "skip"` (with reason) | 11 |
| Diagnostic / non-clean fixtures | 3 |

**Stages exercised for every clean entry:** lexer · parser · checker · interpreter (when runnable) · translator · reverse (unless skipped) · diagnostics.

---

## Past papers

`past-papers/` holds **original Paper 2–style equivalents**, not verbatim copyrighted exam scripts. Labels such as “Paper 2–style” mean construct coverage only. Licensing: do not paste full Cambridge papers unless rights are clear.

---

## Missing categories / gaps

| Gap | Notes |
| --- | --- |
| Library / module system | Not in Cambridge Guide — N/A |
| Full past-paper verbatim sets | Intentionally omitted (licensing); expand equivalents over time |
| GUI / file-picker I/O | Product-only; not language corpus |
| Property-based infinite fuzz | Separate lightweight fuzz in `fuzz.test.ts` |
| Cryptographic / adversarial fuzz | Out of scope |
| Reverse fidelity for CLASS / some builtins / EOF helpers | Marked `reverse: skip` per entry |
| Live sync & AI Coach | Stubbed here; real locks in apps/web and ai-coach |
| N-D arrays beyond 2D samples | Only 1D + 2D represented today |
| `ELSE IF` sugar as dedicated entry | Nested `ELSE`/`IF` covered; optional sugar may get its own fixture later |
| Insert-pack registry beyond ASC/CHR/IS_NUM | Expand when more inserts are Core |

When you close a gap, add fixtures and update this table.

---

## Historical regression inventory

Permanent locks currently include (non-exhaustive):

- Negative `DIV` / `MOD`
- Identifier sanitizer (`list` → `list_`)
- Bare `NEXT`
- `BYREF` SWAP (+ sticky / BYVAL mix)
- ASC / CHR / IS_NUM
- Random-file SEEK / GETRECORD / PUTRECORD
- Enum / pointer / SET smoke
- `CONSTANT` requires `=` (`E_CONSTANT_EQUALS`)
- Assign to `CONSTANT` (`C_ASSIGN_TO_CONSTANT`)
- Undeclared identifier (`C_UNDECL_IDENT`)
- Web-only live-sync note + AI Coach routing note

---

## Design rules

1. No new language features in this package.
2. Do not change compiler behaviour to “make the suite green” unless the behaviour is a genuine bug; prefer documenting expected behaviour in fixtures.
3. Prefer small, deterministic programs with explicit `expectOutput`.
4. Prefer `reverse: skip` + reason over soft global assertions.
5. Every fixed bug → permanent corpus entry.
