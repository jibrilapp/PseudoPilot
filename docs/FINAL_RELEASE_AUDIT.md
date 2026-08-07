# PseudoPilot FINAL Release Candidate Audit — `v1.0.0-beta`

**Audit date:** 2026-08-06 · **P0 close-out:** 2026-08-07  
**Product line:** `1.0.0-beta.0` (not a stable `1.0.0` claim)  
**Workspace:** `/Users/neemaawale/pseudopilot`  
**Constraint (original pass):** Identify genuine issues only — **no product fixes** in this pass.  
**P0 remediation (2026-08-07):** Web lint/`next build` green; CI production build gate + Vercel deploy path documented ([`DEPLOY.md`](./DEPLOY.md)).  
**Personas applied:** senior compiler engineer, senior IDE engineer, Cambridge 9618 examiner, QA, security, accessibility, first-time Year 13 student.

**Companions:** [`RELEASE_READINESS.md`](./RELEASE_READINESS.md) · [`FILE_EXPLORER_AUDIT.md`](./FILE_EXPLORER_AUDIT.md) · [`FIRST_TIME_USER_AUDIT.md`](./FIRST_TIME_USER_AUDIT.md) · [`CONFORMANCE.md`](./CONFORMANCE.md) · `CHANGELOG.md` · `SECURITY.md`

---

## 1. Overall score: **72 / 100** → **~82 / 100** after P0 close-out (2026-08-07)

| Band | Meaning |
| --- | --- |
| 90–100 | Ship public beta with confidence |
| 75–89 | Soft public beta; minor packaging debt |
| 60–74 | Core product teachable; **release engineering / honesty gaps must be closed first** |
| &lt;60 | Hold any public invite |

The Cambridge dialect stack and student teaching loop remain strong for a beta. **P0-A** (web lint / `next build`) and **P0-B** (CI production build gate + documented Vercel deploy path) are **closed**. Remaining score drag is P1 packaging/usability (Search stub, persistence, e2e, etc.) and attaching a **live** production URL once Vercel secrets/dashboard link exist. **Ship note:** AI Coach UI is gated off for beta (`ENABLE_AI_COACH`) — P1-5 branding oversell is moot until re-enabled.
---

## 2. Release decision: **READY WITH CONDITIONS** → soft public beta once live URL is attached

An honest public **`1.0.0-beta`** can ship when a hosted URL is live (Vercel project linked — pipeline already configured). Language/IDE core was never the blocker; **P0-A/P0-B release-engineering items are fixed**.

This is **not** a green light for marketing a stable **`1.0.0`**.

| Verdict option | When |
| --- | --- |
| READY | §8 must-fix closed + known-limitations messaging consistent + **live** hosted URL |
| **READY WITH CONDITIONS** | **← current** — P0 lint/build/CI/deploy path closed; live URL pending secrets/dashboard |
| NOT READY | Would apply if language/runtime correctness P0s existed; none found that overturn CONFORMANCE for Core teaching |

---

## 3. Priority tables

### P0 — Must fix before public beta invite

| ID | Issue | Est. | Status (2026-08-07) |
| --- | --- | --- | --- |
| **P0-A** | `@pseudopilot/web` ESLint fails → `pnpm lint` and `next build` fail | 1–2 h | **Done** — lint + `next build` green |
| **P0-B** | No production CI build gate + no public deploy/release path (prior P0-5) | 4–8 h | **Done** — CI `web-build`; [`DEPLOY.md`](./DEPLOY.md); `vercel.json`; deploy workflow (URL pending secrets) |

### P1 — Major usability / honesty / quality (acceptable as labelled beta caveats only if documented)

| ID | Issue | Est. |
| --- | --- | --- |
| **P1-1** | Activity Bar **Search** is a dead control (shows Program workspace) | 30–90 min |
| **P1-2** | Editor buffers session-only; no `beforeunload` (sidebar note only) | 2–4 h |
| **P1-3** | Problems panel / status count omit language-service `C_*` diagnostics | 2–3 h |
| **P1-4** | Mobile: Documentation hard to reopen (no Docs on `MobileDock`) | 1–2 h |
| **P1-5** | “AI Coach” + tiny `heuristic` subtitle oversells LLM expectations | 1–2 h |
| **P1-6** | Run-vs-Python ambiguity for first-timers (toolbar title helps; label still “Run”) | 1 h |
| **P1-7** | Reverse translation fidelity not explained in UI on failure | 1–2 h |
| **P1-8** | No browser e2e smoke (`tests/e2e/README.md` still empty) | 1–2 d |
| **P1-9** | `CONTRIBUTING.md` still lists `interpreter` / `ai-coach` as stubs | 20 min |
| **P1-10** | Debugger README falsely says editor is “not Monaco” | 15 min |
| **P1-11** | School-hosting “not an OS sandbox” callout weak in-product (SECURITY ok) | 1 h |
| **P1-12** | `.env.example` still leads with Postgres/Redis (IDE needs none) | 30–45 min |
| **P1-13** | Almost no global shortcuts (Run/Stop/palette unwired) | 2–4 h |
| **P1-14** | Cambridge disclaimer on Welcome uses low-contrast `text-pp-faint` (`#9aa1b2`) | 30–60 min |
| **P1-15** | Marketing screenshots show Monaco “Loading editor…” placeholders | 1–2 h |
| **P1-16** | `docs-asset` route cwd-relative `../../docs` fragile under non-monorepo deploys | 1–2 h |

### P2 — Polish

| ID | Issue | Est. |
| --- | --- | --- |
| **P2-1** | Past Paper Mode “Coming soon” on Welcome | 15–30 min |
| **P2-2** | Command Palette registry unwired (`docs/commands.ts`) | 4–8 h |
| **P2-3** | No Settings UI / light-only theme undocumented as intentional | 2–6 h |
| **P2-4** | No watch expressions / conditional breakpoints | defer |
| **P2-5** | Click stack frame → non-top locals | 4–8 h |
| **P2-6** | Accessibility follow-ups (icon-only toolbar, MobileDock focus, skip link) | 4–8 h |
| **P2-7** | In-app docs ship heavy engineering corpus by default | 4–8 h |
| **P2-8** | Stub package versions still `0.0.0` (`sandbox`, `auth`, `ui`, …) | 30 min |
| **P2-9** | SVG/`octet-stream` via `docs-asset` without CSP / disposition hardening | 1–2 h |
| **P2-10** | No IDE-level stress test for rapid edit ↔ translate ↔ repeated debug | gap note |

### P3 — Deferred stubs (ok if not marketed)

| ID | Stub |
| --- | --- |
| P3-1 | `@pseudopilot/sandbox` |
| P3-2 | `@pseudopilot/curriculum-cambridge` |
| P3-3 | LSP server process |
| P3-4 | `apps/api` / `apps/teacher` / `apps/worker` product surfaces |
| P3-5 | Exam-insert pack registry |
| P3-6 | Remote LLM coach provider |

---

## 4. Issue details (reproduction · impact · fix · time)

### P0-A — Web lint / production build failure

- **Status (2026-08-07):** **Closed.** Removed stale rule-disable comments; fixed `prefer-const` / useless escape; Node `console` global for corpus script; ignore generated corpus in ESLint. Verified: `pnpm --filter @pseudopilot/web lint` and `pnpm --filter @pseudopilot/web build` succeed.
- **Original reproduction / impact / est.:** retained below for history.

- **Reproduction:**
  ```bash
  pnpm --filter @pseudopilot/web lint
  pnpm --filter @pseudopilot/web build
  ```
  Observed failures (2026-08-06):
  - `ConsolePanel.tsx` / `usePseudocodeTranslation.ts`: `eslint-disable-next-line react-hooks/exhaustive-deps` but rule **not defined** in `apps/web/eslint.config.mjs` (base config only).
  - `DocMarkdown.tsx`: `@next/next/no-img-element` disable with rule **not installed**.
  - `lib/docs/highlight.ts`: `no-useless-escape` on `\[` in JSON highlighter regex.
  - `lib/docs/parseDocMarkdown.ts`: `prefer-const` (`let id` → `const`).
  - `scripts/generate-docs-corpus.mjs`: `no-undef` for `console`.
  - `corpus.generated.ts`: unused `eslint-disable` warning (fails `--max-warnings=0`).
  - `next build` runs Next’s lint pass and **fails compile** with the same class of errors.
- **Impact:** CI `pnpm check` (which includes turbo `lint`) cannot be green for `@pseudopilot/web`. **No production artifact** can be produced. Blocks any honest public hosted beta.
- **Recommended fix:** Align web ESLint with plugins referenced by disables **or** remove stale disables; fix real `prefer-const` / escape / script env; add `eslint.ignoreDuringBuilds` only as last resort (prefer green lint). Then add `pnpm --filter @pseudopilot/web build` to CI.
- **Est.:** 1–2 hours.

### P0-B — No deploy / release pipeline (prior RELEASE P0-5)

- **Status (2026-08-07):** **Closed (pipeline).** CI `web-build` job runs `pnpm turbo run build --filter=@pseudopilot/web`. Root `vercel.json`, [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml), and [`DEPLOY.md`](./DEPLOY.md) document Vercel hosting. **Live URL** still pending Vercel project link + `VERCEL_*` secrets / `VERCEL_DEPLOY_ENABLED`.
- **Original reproduction / impact / est.:** retained below for history.

- **Reproduction:** Only [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`pnpm check`). No Vercel/Netlify/Fly workflow; no hosting runbook for `apps/web`; CHANGELOG still lists deploy automation as planned.
- **Impact:** Even after P0-A, there is no repeatable public URL or release checklist for `1.0.0-beta`.
- **Recommended fix:** Document one path (e.g. Vercel root = `apps/web` + monorepo install); add CI production build; tag process for beta.
- **Est.:** 4–8 hours.

### P1-1 — Dead Search activity

- **Reproduction:** Click Search in [`ActivityBar.tsx`](../apps/web/components/ide/ActivityBar.tsx). [`IdeShell.tsx`](../apps/web/components/ide/IdeShell.tsx) treats `search` like explorer and renders `ProgramWorkspace` — no search UI.
- **Impact:** First-time users conclude Search is broken.
- **Fix:** Remove icon or show honest empty state (“Workspace search coming soon”).
- **Est.:** 30–90 min.

### P1-2 — Session-only buffers / no unload warning

- **Reproduction:** Edit code → refresh. Resets to starter. Note exists in [`ProgramWorkspace.tsx`](../apps/web/components/ide/ProgramWorkspace.tsx) (`PROGRAM_PERSISTENCE_NOTE`); no `beforeunload`.
- **Impact:** Lost work; Year 13 students mid-exercise. Honesty improved vs earlier audit, but still high friction.
- **Fix:** Size-capped `localStorage` persistence **or** `beforeunload` + stronger banner.
- **Est.:** 2–4 h.

### P1-3 — Problems omit `C_*`

- **Reproduction:** Introduce undeclared identifier. Monaco gutter shows LS marker ([`CodeSurface.tsx`](../apps/web/components/ide/CodeSurface.tsx)); [`ConsolePanel.tsx`](../apps/web/components/ide/ConsolePanel.tsx) Problems aggregates only runtime + `translationDiagnostics`. Status bar uses `translationDiagnostics.length` only ([`IdeShell.tsx`](../apps/web/components/ide/IdeShell.tsx) ~L718).
- **Impact:** Students trust Problems tab; compiler errors look “missing.”
- **Fix:** Feed LS diagnostics into Problems + status count.
- **Est.:** 2–3 h.

### P1-4 — Mobile docs re-entry

- **Reproduction:** Narrow viewport → Welcome → Documentation → Code. [`MobileDock.tsx`](../apps/web/components/ide/MobileDock.tsx) has no Docs item (`docs` excluded from `ITEMS`).
- **Impact:** Docs feel one-shot on phones.
- **Fix:** Add Docs to dock or toolbar overflow.
- **Est.:** 1–2 h.

### P1-5 — AI Coach branding

- **Reproduction:** Open AI panel. Title “AI Coach”; subtitle ends with `· heuristic` ([`AiAssistantPanel.tsx`](../apps/web/components/ide/AiAssistantPanel.tsx)). Provider is [`HeuristicAIProvider`](../packages/ai-coach/src/providers/heuristic.ts).
- **Impact:** Expectation mismatch vs ChatGPT-class answers; ADR 0005 / AI_COACH already honest in docs.
- **Fix:** “Offline coach (rules-based)” primary label; empty-state limits.
- **Est.:** 1–2 h.

### P1-6 — Run executes Pseudocode only

- **Reproduction:** Edit Python heavily → press Run. Interpreter runs Pseudocode buffer. Toolbar `title="Run pseudocode"` exists; visible label is still “Run”.
- **Impact:** Confused first-timers.
- **Fix:** Visible “Run Pseudocode”; Python badge “Teaching translation”.
- **Est.:** 1 h.

### P1-7 — Reverse translation UI honesty

- **Reproduction:** Paste idiomatic non–PseudoPilot Python → reverse errors / last-good buffer. CONFORMANCE/TRANSLATION document best-effort; UI does not teach the limitation.
- **Impact:** Students believe Python pane is a general Python IDE.
- **Fix:** Problems/help blurb + docs deep-link on reverse failure.
- **Est.:** 1–2 h.

### P1-8 — No browser e2e

- **Reproduction:** `tests/e2e/README.md` empty by design; no Playwright in CI.
- **Impact:** Regressions in Welcome → Run → console only caught manually.
- **Fix:** Minimal smoke in CI after P0-A.
- **Est.:** 1–2 days.

### P1-9 — CONTRIBUTING stub map stale

- **Reproduction:** `CONTRIBUTING.md` — “Stub packages (`interpreter`, `sandbox`, `ai-coach`, …)”.
- **Impact:** Contributor confusion; contradicts shipped packages.
- **Fix:** Update map (sandbox/curriculum remain stubs).
- **Est.:** 20 min.

### P1-10 — Debugger README stale

- **Reproduction:** [`apps/web/lib/debugger/README.md`](../apps/web/lib/debugger/README.md) Limitations: “Editor is custom `CodeSurface` (not Monaco)” — false; CodeSurface hosts Monaco ([`docs/ide/MONACO.md`](./ide/MONACO.md)).
- **Impact:** Doc drift for contributors/examiners reading internals.
- **Fix:** Correct limitations list.
- **Est.:** 15 min.

### P1-11 — In-product sandbox honesty for schools

- **Reproduction:** SECURITY.md correctly documents Worker + VFS + limits. In-app About/Welcome does not stress “not multi-tenant OS isolation.”
- **Impact:** School IT may over-trust shared hosting.
- **Fix:** Short Welcome/docs callout linking SECURITY.
- **Est.:** 1 h.

### P1-12 — `.env.example` platform-first

- **Reproduction:** Root [`.env.example`](../.env.example) leads with Postgres/Redis/API. README correctly says IDE needs none.
- **Impact:** Clone friction.
- **Fix:** Split IDE-only vs platform template.
- **Est.:** 30–45 min.

### P1-13 — Keyboard shortcuts gap

- **Reproduction:** Docs search shortcut only ([`DocSidebar.tsx`](../apps/web/components/ide/DocSidebar.tsx)). `DOCS_COMMANDS` unwired to a palette ([`commands.ts`](../apps/web/lib/docs/commands.ts)). No F5 / Ctrl+Enter Run.
- **Impact:** Power-user / accessibility expectation gap.
- **Fix:** Wire Run/Stop/Docs at minimum; document.
- **Est.:** 2–4 h.

### P1-14 — Disclaimer contrast

- **Reproduction:** Welcome disclaimer uses `text-pp-faint` ([`WelcomeScreen.tsx`](../apps/web/components/ide/WelcomeScreen.tsx)); Tailwind `faint: '#9aa1b2'` on white ≈ **&lt;3:1** contrast — fails WCAG AA for body text. Status-bar short disclaimer also faint.
- **Impact:** Legal/affiliation notice is hard to read (examiner + a11y lens).
- **Fix:** Use `text-pp-muted` (`#6b7285`) or darker for disclaimer copy.
- **Est.:** 30–60 min.

### P1-15 — Screenshot freshness

- **Reproduction:** [`docs/ide/screenshots/editors.png`](./ide/screenshots/editors.png) shows both panes as “Loading editor…”. Welcome/workspace chrome otherwise current (ProgramWorkspace + disclaimer).
- **Impact:** Marketing/README visuals undercut “ready” perception.
- **Fix:** Recapture after Monaco hydrate; keep UI.md note.
- **Est.:** 1–2 h.

### P1-16 — `docs-asset` deploy fragility

- **Reproduction:** [`apps/web/app/api/docs-asset/route.ts`](../apps/web/app/api/docs-asset/route.ts) resolves `path.resolve(process.cwd(), '../../docs')`. Path traversal guard (`normalize` + `startsWith(DOCS_ROOT)`) is present and reasonable for monorepo `apps/web` cwd. If host sets cwd differently or deploys web without `docs/`, screenshots 404.
- **Impact:** Broken in-app images in production; not a confirmed escape with current guard, but **unverified** under symlink / alternate cwd.
- **Fix:** Resolve docs root from a known package path or bundle assets; add route tests for `../` attempts.
- **Est.:** 1–2 h.

### P2 highlights (abbreviated)

| ID | Notes |
| --- | --- |
| P2-1 | Past Paper dashed card on Welcome — remove or roadmap-only |
| P2-2 | Command palette claimed “future-ready” in DOCUMENTATION_SYSTEM — unwired |
| P2-4/5 | Watches / non-top frame locals — documented debugger gaps |
| P2-6 | MobileDock lacks `focus-visible`; no skip-to-editor |
| P2-9 | Serving `.svg` as `image/svg+xml` same-origin — harden if untrusted docs ever land |
| P2-10 | Conformance has interpreter stress + fuzz + compiler rapid-edit; **no** full IDE rapid-edit/translate/debug stress |

---

## 5. Top 10 remaining improvements (v1.1 backlog)

1. **Buffer persistence** with dirty indicator + download/export Pseudocode/Python.
2. **Workspace search** (or remove activity) + **command palette** (Run, Docs, examples).
3. **Problems = Monaco LS `C_*` + translation + runtime** unified.
4. **Browser e2e smoke** in CI (Welcome → example → Run → output).
5. **Watch expressions** + clickable stack frames for non-top locals.
6. **Reverse-translation coaching** in UI (supported shapes vs free Python).
7. **Settings** (welcome reset, timestamps, documented light theme / future dark).
8. **Student-filtered docs nav** (hide ADR/architecture by default).
9. **Exam-insert pack registry** beyond fixed Core inserts (CONFORMANCE 🟡).
10. **Optional remote LLM coach** behind explicit online provider (keep heuristic default).

---

## 6. Methodology

### Inspected (code / docs)

| Area | Evidence |
| --- | --- |
| Release packaging | `RELEASE_READINESS.md`, `FILE_EXPLORER_AUDIT.md`, `CHANGELOG.md`, root/`apps/web` `package.json` (`1.0.0-beta.0`), `README.md`, `SECURITY.md` |
| Language / conformance | `docs/CONFORMANCE.md` matrix spot-check vs checklist; BYREF/random/files tests |
| Compiler pipeline | Package tests presence; `parse.limits`, recovery tests, conformance regression/fuzz |
| IDE | `IdeShell`, `ProgramWorkspace`, `DualEditor`, `CodeSurface`, `ActivityBar`, `Toolbar`, `StatusBar`, `MobileDock`, `ConsolePanel`, `WelcomeScreen`, docs viewer |
| Sync / Monaco | `bidirectionalSync.ts` (+ echo guards), `applyExternalText.ts`, `liveSyncStatus.ts` |
| Debugger / runtime | `DebuggerSession`, `RuntimeController`, worker protocol, debugger README |
| AI Coach | `intent.ts`, `productCapabilities.ts`, `heuristic` provider, `AiAssistantPanel`, coach markdown (React text nodes — no `dangerouslySetInnerHTML`) |
| Docs system | `docs.test.ts` (links/search), `docs-asset/route.ts`, screenshots on disk |
| Security | SECURITY.md, VFS (not OS disk), source size caps, docs-asset path check |
| CI | `.github/workflows/ci.yml` (`check` + `web-build`) + `deploy.yml` |
| A11y | `aria-*`, `focus-visible`, `aria-live`, contrast tokens in `tailwind.config.js` |

### Tests run in this audit

| Suite | Result |
| --- | --- |
| `apps/web`: bidirectionalSync, bidirectionalEditor, cambridgeDisclaimer, programWorkspace, docs | **38 passed** |
| `@pseudopilot/conformance`: regression + fuzz | **12 passed** |
| `@pseudopilot/ai-coach`: index tests | **50 passed** |
| `@pseudopilot/checker` byref | **8 passed** |
| `@pseudopilot/translator` byref + identifier-sanitize | **17 passed** |
| `@pseudopilot/interpreter` byref + random-files | **21 passed** |
| `pnpm --filter @pseudopilot/web lint` | **FAILED** (P0-A) → **passed** (2026-08-07) |
| `pnpm --filter @pseudopilot/web build` | **FAILED** (P0-A) → **passed** (2026-08-07) |
| `pnpm --filter @pseudopilot/web typecheck` | **passed** |

### Not runnable / not verified

- Live browser / screen-reader session (screenshots + code inference only).
- Hosted production URL, CDN headers, Worker under Safari/iOS (deploy pipeline ready; URL pending secrets).
- Cryptographic fuzz / property-based infinite generation (documented out of TESTING.md).
- Symlink-based escape against `docs-asset` on all OS hosts.
- Real WCAG measurement tooling (contrast judged from hex tokens).

---

## 7. Historical regression review

| Historical risk | Status | Evidence |
| --- | --- | --- |
| Fake multi-file explorer | **Fixed** | `FileExplorer.tsx` removed; `ProgramWorkspace` + tests; screenshots show Current program |
| Cambridge disclaimer missing in UI | **Fixed** | Welcome + status bar + `cambridgeDisclaimer.test.ts` |
| SECURITY denies interpreter | **Fixed** | SECURITY.md Worker + VFS + limits |
| README experimental / “AI not yet” | **Fixed** | Public beta README |
| Semver / changelog for beta | **Fixed** | `1.0.0-beta.0` + CHANGELOG section |
| Live sync echo / Pseudocode mutation | **Holding** | Identical-buffer guards in `bidirectionalSync.ts`; dedicated tests (“peer apply echo…”) |
| AI Coach routing / product vs theory | **Holding** | `classifyCoachIntent` + `productCapabilities` + 50 package tests |
| BYREF semantics | **Holding** | checker / interpreter / translator / parser byref tests |
| Random files | **Holding** | `random-files.test.ts` (13) |
| Identifier sanitizer | **Holding** | `identifier-sanitize.test.ts` (13) |
| Deploy pipeline | **Closed (pipeline)** | P0-B: CI + DEPLOY.md + vercel.json; URL pending secrets |
| Search stub | **Still open** | P1-1 |
| Problems miss `C_*` | **Still open** | P1-3 |
| Coach “AI” oversell | **Still open** | P1-5 |
| Debugger “not Monaco” README | **Still open** | P1-10 |
| CONTRIBUTING stubs | **Still open** | P1-9 |

**Regression P0?** None of the historical **correctness** bugs re-opened under code+test inspection. The **new** P0 is release-engineering (lint/build), not a language regression.

---

## 8. Conditions for READY WITH CONDITIONS

### Must-fix before public beta invite

1. ~~**Green `@pseudopilot/web` lint and `next build`**~~ **Done (P0-A, 2026-08-07).**
2. ~~**CI gates production web build**~~ **Done (P0-B)** — `web-build` job in `.github/workflows/ci.yml`.
3. ~~**Document at least one deploy path**~~ **Done (P0-B)** — [`DEPLOY.md`](./DEPLOY.md) + `vercel.json`. **Remaining:** attach live Vercel URL (secrets / dashboard).

### Acceptable beta caveats (must stay in CHANGELOG / Welcome / README)

- Reverse translation is best-effort; Run executes Pseudocode only.
- AI Coach default is offline / rules-based (`heuristic`), not a remote LLM.
- Browser Worker + step limits ≠ OS security sandbox.
- Single-program workspace; session-only source (until P1-2).
- Search / Past Paper / Command Palette / watches are unfinished chrome.
- No browser e2e suite yet.

### Not required to call `1.0.0-beta` (defer to v1.1 / stable 1.0)

- Full Settings / dark theme.
- Watch expressions.
- Multi-file projects.
- OS sandbox package / curriculum profiles / LSP process.
- Remote LLM provider.

---

## 9. Subsystem scorecard (audit lenses)

| Subsystem | Score | Notes |
| --- | ---: | --- |
| Compiler (lex→check→diag/recovery) | 88 | Strong tests; recovery partial (CONFORMANCE 🟡) |
| Interpreter / files / BYREF / OOP | 90 | Corpus + dedicated tests; limits present |
| Translator forward | 84 | Solid; helpers for DIV/MOD/RIGHT |
| Reverse translator | 72 | Best-effort; UI under-explains; corpus soft round-trip |
| IDE Monaco / sync / undo | 82 | Echo guards + executeEdits; no e2e |
| Debugger | 80 | Step/BP/vars/stack work; no watches |
| Documentation | 80 | Link tests; screenshot loading; corpus heavy |
| AI Coach | 74 | Intent routing solid; branding oversells |
| Accessibility | 68 | Focus/ARIA baseline; faint disclaimer contrast |
| Security | 78 | Honest SECURITY; VFS; docs-asset guarded; no OS sandbox |
| Performance | 74 | Debounce + limits + some stress; no IDE perf budget |
| Release / CI | 42 → **78** | **P0-A/P0-B closed:** lint/build green; CI `web-build`; Vercel path documented; live URL pending |

---

## 10. CONFORMANCE honesty (examiner lens)

[`CONFORMANCE.md`](./CONFORMANCE.md) remains the right authority: **101 ✅ / 11 🟡 / 3 ❌ / 9 ⚠️** of 124. Executive “fully Cambridge Guide-compliant” is **acceptable for grammar/semantics of the audited surface** when read with the ⚠️/🟡 tables (ASCII `<-`, `ELSE IF`, soft `LCASE` STRING, insert builtins as Core, etc.).

**Caveats for marketing:**

- Do not advertise “exam-board endorsed” (disclaimer present; keep high-contrast).
- Do not imply reverse Python ↔ Pseudocode is lossless.
- Product ❌ stubs (sandbox, LSP process, curriculum) must not appear in feature lists as shipped.

Corpus `skipRoundTrip` flags are currently **unused** (0 entries); round-trip tests use a **soft** forward-again check — reverse fidelity gaps remain real even if flags are idle.

---

## 11. Stress coverage

| Area | Coverage | Gap |
| --- | --- | --- |
| Interpreter nested loops / large array / concat / recursion | `conformance` interpreter stress | — |
| Fuzz invalid programs | `fuzz.test.ts` | Not cryptographic / infinite |
| Compiler rapid edits | compiler-service + conformance | — |
| Monaco rapid typing / large sync | `monaco.test.ts` | Timing soft |
| Bidirectional rapid alternating edits | `bidirectionalSync.test.ts` | — |
| Full IDE: type → translate → debug → repeat | **None** | P2-10 |
| Browser memory / long session | **None** | unverified |

---

## Document control

| Item | Value |
| --- | --- |
| Type | Final RC audit (docs-only) + P0 close-out note |
| Decision | **READY WITH CONDITIONS** (live URL pending) |
| Score | **72 / 100** original · **~82 / 100** after P0-A/P0-B |
| Next refresh | After first hosted production URL is confirmed |
