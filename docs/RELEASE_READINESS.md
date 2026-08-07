# PseudoPilot v1.0 Release Readiness Audit

**Audit date:** 2026-08-06  
**Auditor role:** External QA (first-time user lens)  
**Workspace:** `/Users/neemaawale/pseudopilot`  
**Scope:** Product readiness for a **public v1.0** student IDE release — not language-feature completeness.  
**Assumption (per brief):** Language, compiler, debugger, translator, AI Coach, documentation, and UI are treated as **feature-complete**; this audit finds what still hurts a first-time user or blocks a honest public ship.

> **Packaging update (2026-08-06):** P0-1 (Cambridge disclaimer UI), P0-2 (honest single-program workspace), P0-3 (SECURITY.md), P0-4 (README), and P0-6 (semver → `1.0.0-beta.0` + CHANGELOG) addressed. **P0-5** (deploy pipeline) addressed 2026-08-07: CI `web-build` gate + [`docs/DEPLOY.md`](./DEPLOY.md) / `vercel.json` / deploy workflow (live URL pending Vercel secrets). This document remains an audit checklist; category scores above are from the original pass unless noted.
>
> **Final RC audit:** see [`FINAL_RELEASE_AUDIT.md`](./FINAL_RELEASE_AUDIT.md) — P0-A/P0-B closed 2026-08-07 (lint/`next build` green; CI + deploy path documented).
>
> **FTUE (Year 13 first visit):** see [`FIRST_TIME_USER_AUDIT.md`](./FIRST_TIME_USER_AUDIT.md).
---

## Overall readiness score: **61 / 100**

| Band | Meaning |
| --- | --- |
| 90–100 | Ship public v1.0 with confidence |
| 75–89 | Soft launch / limited beta |
| 60–74 | Strong core; release packaging & first-run honesty still incomplete |
| &lt;60 | Hold public “1.0” claim |

**Verdict:** The Cambridge dialect stack and IDE core (run / debug / live sync / docs / heuristic coach) look teachable and largely solid. **Public v1.0 is not yet honest or safe to market** until legal/trust copy, misleading workspace chrome, stale security/README claims, and a real release/deploy path are fixed. Language conformance ([`CONFORMANCE.md`](./CONFORMANCE.md)) is ahead of product packaging.

---

## Category scores

| Category | Score | Notes |
| --- | ---: | --- |
| Onboarding / welcome / first-run | 68 | Welcome + examples work; Past Paper stub + no persistence + fake files hurt trust |
| Examples | 82 | Six solid starters in `welcomeExamples.ts` |
| Documentation (in-app) | 86 | Corpus + search + viewer; mobile re-entry weak; palette unwired |
| AI Coach | 74 | Heuristic coach useful offline; “AI” branding + `heuristic` label under-explain limits |
| Forward translation | 84 | Live sync chip + diagnostics; large-source debounce present |
| Reverse translation | 72 | Best-effort; failures keep last good buffer — fidelity gaps documented, not student-visible |
| Debugger | 80 | Breakpoints / step / stack work; no watches; stack frame locals not clickable |
| Compiler diagnostics (Monaco LS) | 83 | Markers via language service; Problems tab omits `C_*`/`E_*` |
| Runtime / console errors | 85 | Worker + limits + Problems for `R_*` / `T_*` |
| File handling (explorer / tabs) | 28 → **78** | **P0-2 done:** Program workspace shows Current program + Pseudocode/Python views only; no decoy tree |
| Search (activity) | 15 | Activity icon present; **no search panel** |
| Command palette / shortcuts | 35 | Docs `Ctrl/Cmd+Shift+F` only; `DOCS_COMMANDS` registry unwired |
| Accessibility | 76 | Splitters, focus rings, `aria-live`, reduced motion; gaps remain |
| Responsiveness (mobile) | 70 | Dock + single Monaco mount; docs not on dock; dense toolbar |
| Themes (dark/light) | 45 | Light-only Monaco + shell (`pseudopilot-light`); no toggle / settings |
| Settings | 20 | Layout prefs only in `localStorage`; no Settings UI |
| Loading / empty / error states | 78 | Coach / vars / problems empties OK; Search/Past Paper are stub states |
| Performance / memory | 72 | Worker + step limits; package stress suite + nesting-limit fix in [`PERFORMANCE_AND_STABILITY.md`](./PERFORMANCE_AND_STABILITY.md); still no browser e2e/perf budget |
| CI | 62 | `pnpm check` on PR/push; no production Next build, no e2e, no release job |
| Deployment / GitHub release process | 38 | No deploy workflow; root still “experimental 0.x”; versions drift |
| Trust / legal / docs accuracy | 42 | README disclaimer exists; **not in IDE**; SECURITY.md + README status claims stale |
| Known product stubs (CONFORMANCE) | 55 | Sandbox / curriculum / LSP process stubs OK if not marketed; Search/Past Paper are user-visible |

---

## Release blockers (P0)

| ID | Issue |
| --- | --- |
| **P0-1** | ~~Cambridge affiliation disclaimer absent from the product UI~~ **Done (beta packaging):** Welcome + status bar + shared copy in `apps/web/lib/ide/cambridgeDisclaimer.ts`. |
| **P0-2** | ~~**Fake multi-file workspace**~~ **Done (path A):** [`ProgramWorkspace.tsx`](../apps/web/components/ide/ProgramWorkspace.tsx) replaces the decoy tree; tabs/paths are `Untitled.pp` / `Untitled.py` only. Deep dive: [`FILE_EXPLORER_AUDIT.md`](./FILE_EXPLORER_AUDIT.md). |
| **P0-3** | ~~SECURITY.md denies shipped interpreter~~ **Done:** documents Worker + VFS + limits; not a hardened sandbox. |
| **P0-4** | ~~Root README status wrong~~ **Done:** public-user README for `1.0.0-beta.0`; points at CONFORMANCE. |
| **P0-5** | ~~**No public deploy / release pipeline**~~ **Done (2026-08-07):** CI gates `pnpm turbo run build --filter=@pseudopilot/web`; [`docs/DEPLOY.md`](./DEPLOY.md) + `vercel.json` + `.github/workflows/deploy.yml`. Live URL still needs Vercel project secrets / dashboard link. |
| **P0-6** | ~~Semver / changelog not ready~~ **Done as beta:** product line `1.0.0-beta.0` + CHANGELOG; **not** claiming stable `1.0.0`. |

---

## Quick wins (&lt; 30 minutes each)

| ID | Fix | Est. |
| --- | --- | --- |
| QW-1 | Add one-line **unofficial / not affiliated** notice on Welcome + status bar or footer | 15–25 min |
| QW-2 | ~~Collapse explorer to a single real file~~ **Done** via Program workspace (P0-2) | — |
| QW-3 | Rewrite SECURITY.md “What this project executes” to match Worker + VFS reality | 15 min |
| QW-4 | Sync root README “What works today” with CONFORMANCE + live AI Coach | 20–30 min |
| QW-5 | Remove Activity Bar **Search** entry **or** show an honest empty stub (“Coming soon”) | 10–15 min |
| QW-6 | Soften/remove **Past Paper Mode** card on Welcome (or keep badge but don’t sit as peer to Docs) | 10 min |
| QW-7 | Coach header: “Offline coach (rules-based)” instead of implying a remote LLM | 10 min |
| QW-8 | Align version strings in README Versioning section with root `0.10.0` (or declare 1.0 plan) | 10 min |
| QW-9 | One-line link from README → this audit (done with this doc) | 5 min |
| QW-10 | Add `pnpm --filter @pseudopilot/web build` step to CI | 15–20 min |

---

## Estimated remaining work

| Track | Effort | Scope |
| --- | --- | --- |
| P0 blockers (honest packaging) | **1.5–2.5 days** | Disclaimer UI, workspace honesty, SECURITY/README, version/release notes |
| P1 major usability | **4–7 days** | Code persistence or explicit “unsaved”, Problems=`C_*`, Search stub UX, mobile docs entry, coach transparency, e2e smoke, CI production build |
| P2 polish | **3–5 days** | Settings shell, theme toggle or documented light-only, command palette MVP, watches deferred, Past Paper removal, a11y pass |
| P3 optional / stubs | **1–3 days** (or defer) | curriculum-cambridge, LSP process, OS sandbox — **not required for student browser IDE v1** if messaging is clear |
| **Total to a defensible public v1.0** | **~8–14 working days** | Assuming language stays frozen; no new features |

---

## Full prioritised issue checklist

### P0 — Release blockers

#### P0-1 — No Cambridge disclaimer in the IDE
- **Description:** Root README states PseudoPilot is unofficial / not affiliated with Cambridge Assessment. Welcome headline brands Cambridge — disclaimer now ships in Welcome + status bar.
- **Reproduction:** Open `http://127.0.0.1:3000?welcome=1`; inspect Welcome + explorer; search UI for “unofficial” / “not affiliated” → only in README.
- **Recommended fix:** Persistent short notice on Welcome and a Settings/About or status-bar affordance; keep README text.
- **Est.:** 1–2 h

#### P0-2 — Decorative file tree / tabs mislead first-time users
- **Status:** **Done (2026-08-06)** — path A from [`FILE_EXPLORER_AUDIT.md`](./FILE_EXPLORER_AUDIT.md).
- **Description (historical):** `DUMMY_FILES` listed multiple pseudocode files and a markdown file; selecting them only changed `activeFileId`. Editor buffers remained the single `pseudocode`/`python` pair.
- **Fix shipped:** Removed decoy tree. Sidebar is **Current program** (`Untitled.pp`) with Pseudocode / Python views that focus the dual panes; New program / Open example; session-only persistence note. Tabs match the two real panes.
- **Est.:** 2–4 h (honest single-file) / 2–4 d (real multi-file — deferred)

#### P0-3 — SECURITY.md denies shipped interpreter
- **Description:** Root `SECURITY.md` §“What this project executes” says there is no user-code interpreter wired into the public web app. False vs `RuntimeController` + Worker + `@pseudopilot/interpreter`.
- **Reproduction:** Read SECURITY.md vs `apps/web/lib/runtime` / `apps/web/lib/worker`.
- **Recommended fix:** Document browser Worker execution, VFS (not OS disk), step/depth limits, and that this is **not** a hardened multi-tenant sandbox ([`packages/sandbox`](../packages/sandbox) stub).
- **Est.:** 30–60 min

#### P0-4 — Root README product status contradicts the app
- **Description:** README still says experimental incomplete Cambridge, “AI coach / remote OS sandbox — Not yet”, and outdated subsets. CONFORMANCE + IDE contradict this for a public 1.0 narrative.
- **Reproduction:** Compare README tables to Welcome (AI Coach), Run, and [`docs/CONFORMANCE.md`](./CONFORMANCE.md).
- **Recommended fix:** Rewrite “What works today” / “What’s next”; keep unofficial disclaimer; point to CONFORMANCE + this audit.
- **Est.:** 1–2 h

#### P0-5 — No deployment or release automation
- **Description:** CI only runs `pnpm check`. No deploy workflow, hosting docs for `apps/web`, or GitHub Release checklist for v1.0. `infra/docker` is Postgres/Redis for a future API — irrelevant to student IDE install.
- **Reproduction:** List `.github/workflows` (only `ci.yml`); search for vercel/netlify/fly deploy → none.
- **Recommended fix:** Document `next build` + host; add CI production build; tag/release notes process; clarify that API/DB docker is **not** required for the IDE.
- **Est.:** 4–8 h

#### P0-6 — Semver / changelog not ready to call “1.0.0”
- **Description:** Root version `0.10.0`; web `0.0.0`; README Versioning still “0.8.x”; CHANGELOG has large `[Unreleased]` and a oddly titled `0.10.0` section.
- **Reproduction:** `package.json` versions vs README §Versioning vs `CHANGELOG.md`.
- **Recommended fix:** Cut a coherent 1.0.0 (or keep 0.x and **do not** market “v1.0”) with CHANGELOG release notes.
- **Est.:** 2–4 h

---

### P1 — Major usability

#### P1-1 — Activity Bar Search is a dead control
- **Description:** [`ActivityBar.tsx`](../apps/web/components/ide/ActivityBar.tsx) includes Search; [`IdeShell.tsx`](../apps/web/components/ide/IdeShell.tsx) treats `search` like Program and still renders `ProgramWorkspace`. Documented stub in [`docs/ide/UI.md`](./ide/UI.md) polish backlog.
- **Reproduction:** Click Search activity → same file tree; no query UI.
- **Recommended fix:** Remove icon until implemented, or show explicit empty state.
- **Est.:** 30–90 min

#### P1-2 — Editor source not persisted
- **Description:** Only layout/welcome flags persist (`pseudopilot.ide.layout.v1`). Pseudocode/Python buffers reset on refresh to `DUMMY_PSEUDOCODE`.
- **Reproduction:** Edit code → reload → content lost; welcome may stay dismissed.
- **Recommended fix:** Persist buffers (with size cap) or banner “Not saved — copy before closing”.
- **Est.:** 2–4 h

#### P1-3 — Problems panel misses compiler diagnostics
- **Description:** Monaco shows LS/`C_*` markers ([`CodeSurface.tsx`](../apps/web/components/ide/CodeSurface.tsx)); Console Problems aggregates only runtime + translation ([`ConsolePanel.tsx`](../apps/web/components/ide/ConsolePanel.tsx)). Status bar count uses `translationDiagnostics.length` only.
- **Reproduction:** Introduce undeclared name → gutter error; Problems may stay empty until Run/translate error.
- **Recommended fix:** Feed LS diagnostics into Problems + status count; click-to-reveal already exists.
- **Est.:** 2–3 h

#### P1-4 — Mobile: Documentation hard to reopen
- **Description:** Welcome can open docs (`mobileView === 'docs'`), but [`MobileDock.tsx`](../apps/web/components/ide/MobileDock.tsx) has no Docs item. After leave, users need Welcome again.
- **Reproduction:** Mobile width → Welcome → Documentation → switch to Code → no Docs dock button.
- **Recommended fix:** Add Docs to dock or toolbar overflow.
- **Est.:** 1–2 h

#### P1-5 — “AI Coach” oversells a heuristic provider
- **Description:** Default [`HeuristicAIProvider`](../packages/ai-coach/src/providers/heuristic.ts) (`id: 'heuristic'`). Panel shows “AI Coach · heuristic” — easy to miss; students may expect ChatGPT-class answers ([`docs/ai/AI_COACH.md`](./ai/AI_COACH.md)).
- **Reproduction:** Open AI panel with empty context; ask open-ended question; note canned structure / limits.
- **Recommended fix:** Rename/subtitle to “Offline coach”; short empty-state about grounded/rules-based answers; keep ADR 0005.
- **Est.:** 1–2 h

#### P1-6 — Run-vs-Python ambiguity for first-timers
- **Description:** Dual editable panes; Run executes Pseudocode only (correct). Easy to assume Python Run. Comment in `DUMMY_PSEUDOCODE` helps only on default buffer.
- **Reproduction:** Edit Python heavily → press Run → Pseudocode interpreter runs (may surprise).
- **Recommended fix:** Toolbar/console copy: “Run Pseudocode”; Python badge “Teaching translation”.
- **Est.:** 1 h

#### P1-7 — Reverse translation fidelity not explained in UI
- **Description:** CONFORMANCE/TRANSLATION: reverse is best-effort / `skipRoundTrip` cases. UI shows “Translation failed” / last-good buffers without teaching “hand-written Python may not round-trip”.
- **Reproduction:** Paste idiomatic Python not emitted by PseudoPilot → reverse errors or lossy Pseudocode.
- **Recommended fix:** Problems/help blurb + docs deep-link on reverse failure.
- **Est.:** 1–2 h

#### P1-8 — No browser e2e smoke for release
- **Description:** `tests/e2e/README.md` empty by design. UI tests are node vitest only ([`docs/ide/UI.md`](./ide/UI.md)).
- **Reproduction:** No Playwright/Cypress workflow in CI.
- **Recommended fix:** Minimal smoke: load IDE → welcome → example → Run → console output.
- **Est.:** 1–2 d

#### P1-9 — CI does not build the web app
- **Description:** `ci.yml` runs `pnpm check` only; Next production build can fail independently of unit tests.
- **Reproduction:** Inspect `.github/workflows/ci.yml`.
- **Recommended fix:** Add `pnpm --filter @pseudopilot/web build` (or turbo filter).
- **Est.:** 30–60 min

#### P1-10 — CONTRIBUTING.md lists interpreter / AI coach as stubs
- **Description:** Root `CONTRIBUTING.md` “Stub packages (`interpreter`, `sandbox`, `ai-coach`, …)” — false for interpreter and ai-coach.
- **Reproduction:** Read CONTRIBUTING vs packages.
- **Recommended fix:** Update contributor map to match reality.
- **Est.:** 20 min

#### P1-11 — Debugger README stale (“not Monaco”)
- **Description:** [`apps/web/lib/debugger/README.md`](../apps/web/lib/debugger/README.md) Limitations say custom CodeSurface not Monaco; CodeSurface is Monaco ([`docs/ide/MONACO.md`](./ide/MONACO.md)).
- **Reproduction:** Read debugger README Limitations.
- **Recommended fix:** Correct limitations list.
- **Est.:** 15 min

#### P1-12 — No in-app “this is not an exam / OS sandbox” for schools
- **Description:** Interpreter docs state no security sandbox; OS sandbox package is a stub ([`packages/sandbox`](../packages/sandbox)). Schools may assume safe multi-user hosting.
- **Reproduction:** Deploy static IDE on a shared host without reading INTERPRETER.md.
- **Recommended fix:** About/docs callout + SECURITY alignment (ties to P0-3).
- **Est.:** 1 h

#### P1-13 — `.env.example` implies DB/Redis required
- **Description:** [`.env.example`](../.env.example) leads with Postgres/Redis/API; student IDE needs none. Confuses first clone for “just run the IDE”.
- **Reproduction:** Follow `.env.example` before `apps/web` README.
- **Recommended fix:** Split IDE-only vs platform env; README quick start already skips DB — make template match.
- **Est.:** 30–45 min

#### P1-14 — Global keyboard shortcuts almost absent
- **Description:** Docs search shortcut only ([`DocSidebar.tsx`](../apps/web/components/ide/DocSidebar.tsx)). No Run/Stop/palette shortcuts; `DOCS_COMMANDS` keybindings unused ([`commands.ts`](../apps/web/lib/docs/commands.ts)).
- **Reproduction:** Press Ctrl+Enter / F5 expecting Run → no IDE handler.
- **Recommended fix:** Document shortcuts; wire Run/Stop/Docs open at minimum.
- **Est.:** 2–4 h

---

### P2 — Polish

#### P2-1 — Past Paper Mode “Coming soon” on Welcome
- **Files:** [`WelcomeScreen.tsx`](../apps/web/components/ide/WelcomeScreen.tsx), [`docs/ide/UI.md`](./ide/UI.md)
- **Reproduction:** `?welcome=1` → dashed Past Paper card.
- **Fix:** Remove for v1 or move to roadmap docs only.
- **Est.:** 15–30 min

#### P2-2 — Command Palette unwired
- **Files:** [`apps/web/lib/docs/commands.ts`](../apps/web/lib/docs/commands.ts), DOCUMENTATION_SYSTEM.md
- **Reproduction:** No Ctrl/Cmd+K / Ctrl+Shift+P palette in IdeShell.
- **Fix:** Minimal palette for docs commands + Run; or drop docs claims of palette until shipped.
- **Est.:** 4–8 h

#### P2-3 — No Settings UI / theme toggle
- **Description:** Light theme only (`pseudopilot-light` in [`registerPseudocode.ts`](../apps/web/lib/monaco/registerPseudocode.ts) / [`CodeSurface.tsx`](../apps/web/components/ide/CodeSurface.tsx)). Layout prefs exist without Settings.
- **Fix:** Settings drawer (timestamps, welcome reset, theme later) **or** document light-only as intentional.
- **Est.:** 2–6 h

#### P2-4 — Watch expressions / conditional breakpoints missing
- **Files:** debugger README, UI.md polish backlog
- **Fix:** Defer with docs; not first-run critical if basics work.
- **Est.:** 2–5 d (if built)

#### P2-5 — Click stack frame → non-top locals
- **Description:** Documented future in debugger README.
- **Est.:** 4–8 h

#### P2-6 — Coach / product copy still says “preview” in explorer
- **Status:** **Done** with P0-2 — Program workspace no longer says “Cambridge 9618 · preview”.
- **File (historical):** FileExplorer “Cambridge 9618 · preview”
- **Fix:** Current program / `Untitled.pp` + session note.
- **Est.:** 15 min

#### P2-7 — Accessibility follow-ups
- **Notes:** Good baseline (separators, focus-visible, aria-live, reduced motion). Gaps: icon-only toolbar density, MobileDock focus styles, Past Paper `aria-disabled` div not announced as unavailable feature, no skip-to-editor link.
- **Est.:** 4–8 h audit+fixes

#### P2-8 — In-app docs include internal engineering depth
- **Description:** Corpus ships ADR/architecture/CONFORMANCE — great for power users; overwhelming as default for students ([`DOCUMENTATION_SYSTEM.md`](./ide/DOCUMENTATION_SYSTEM.md) default `ide/UI`).
- **Fix:** Curated “Getting started” default + student vs contributor nav filters.
- **Est.:** 4–8 h

#### P2-9 — CHANGELOG hygiene
- **Description:** Large Unreleased blob; section title `## [0.10.0] — semantic checker` understates current product.
- **Est.:** 1–2 h

#### P2-10 — Screenshot freshness / Monaco hydration
- **Notes:** UI.md admits Monaco may still be hydrating in screenshots — fine for docs; refresh before marketing site.
- **Est.:** 1–2 h

---

### P3 — Optional / deferred stubs (release-impacting only if marketed)

| ID | Stub | Evidence | FTU impact if not marketed | Est. if built |
| --- | --- | --- | --- | --- |
| P3-1 | `@pseudopilot/sandbox` | package README + `src/index.ts` constants only | None for browser VFS IDE | weeks |
| P3-2 | `@pseudopilot/curriculum-cambridge` | foundation stub | None in UI today | days–weeks |
| P3-3 | LSP server process | CONFORMANCE ❌; protocol types only | IDE uses in-process LS | weeks |
| P3-4 | `apps/api` / `apps/teacher` / `apps/worker` | foundation stubs | Not on student path | large |
| P3-5 | Exam-insert pack registry | CONFORMANCE 🟡 | Edge exams only | days |
| P3-6 | Remote LLM coach provider | AI_COACH non-goals | Heuristic is enough if labelled | days |

---

## Strengths (do not regress)

Evidence the product is close on **core teaching loops**:

- Cambridge guide surface largely ✅ per [`docs/CONFORMANCE.md`](./CONFORMANCE.md) (101 fully compliant / 124 audited).
- Welcome examples (`welcomeExamples.ts`) cover I/O, loops, arrays, PROCEDURE, FUNCTION.
- Live Pseudocode ↔ Python sync with status chip + last-good-on-error ([`liveSyncStatus.ts`](../apps/web/lib/translation/liveSyncStatus.ts), UI.md).
- Worker-backed Run/Debug with breakpoints and variables.
- In-app documentation corpus + search + broken-link test ([`docs.test.ts`](../apps/web/lib/docs/docs.test.ts)).
- Offline heuristic AI Coach with intent routing ([`docs/ai/AI_COACH.md`](./ai/AI_COACH.md)).
- Layout persistence, mobile single-Monaco mount, focus/reduced-motion attention.
- Unit/conformance culture: turbo `pnpm check` on every PR to `main`.

---

## Methodology notes

### Inspected (read / spot-check)

| Area | Sources |
| --- | --- |
| Product docs | `docs/CONFORMANCE.md`, `docs/ide/UI.md`, `docs/ide/DOCUMENTATION_SYSTEM.md`, `docs/ai/AI_COACH.md`, `docs/language/TRANSLATION.md` (skim), language README |
| IDE shell | `IdeShell`, `WelcomeScreen`, `ActivityBar`, `ProgramWorkspace`, `DualEditor`, `Toolbar`, `StatusBar`, `MobileDock`, `ConsolePanel`, `AiAssistantPanel`, `DocumentationView` / docs lib |
| Data stubs | `apps/web/lib/dummy.ts`, `welcomeExamples.ts`, `layoutPersistence.ts`, `docs/commands.ts` |
| Packages | `sandbox`, `curriculum-cambridge` entrypoints; ai-coach heuristic provider; interpreter limits (README/CONFORMANCE) |
| Repo ops | Root/apps `package.json`, `turbo.json`, `.nvmrc`, `.env.example`, `README`, `SECURITY`, `CONTRIBUTING`, `CHANGELOG`, `.github/workflows/ci.yml`, `tests/e2e/README.md`, `infra/docker/README.md` |
| Themes | `globals.css`, Monaco `pseudopilot-light` only |

### Smoke checks run

- Ripgrep inventory of stubs / “coming soon” / TODO surfaces across `apps/web`, `packages`, `docs`.
- Confirmed single CI workflow; no deploy workflow.
- Confirmed Search activity does not mount a distinct panel (code path).
- Did **not** run full `pnpm check`, browser e2e, or production deploy (environment/time); CI config and test harness presence were judged from files.

### Not runnable / not verified in this audit

- Live browser session against `next dev` (screenshots in `docs/ide/screenshots/` treated as illustrative).
- Full conformance corpus execution duration / flaky-test rate.
- Real-world mobile devices / screen readers (a11y inferred from code).
- Hosted production URL behaviour, CDN caching, HTTPS headers.
- npm publish path (packages still `private: true` — expected).

### Honesty rule

Issues cite paths or docs. Speculative performance/memory problems without measurement are omitted. Documented stubs (Search, Past Paper, Command Palette, sandbox, curriculum, LSP) are included where they affect **first-time UX or release claims**.

---

## Suggested v1.0 exit criteria

Ship public **v1.0** only when:

1. All **P0** items closed (or product explicitly marketed as **0.x beta** with matching version).
2. At least **P1-1, P1-2 (or banner), P1-3, P1-5, P1-8, P1-9** closed.
3. README + SECURITY + in-app disclaimer tell the same story.
4. CI builds `@pseudopilot/web` for production.
5. One documented deploy path for the student IDE (even if “static export / single Vercel project”).
6. CHANGELOG cut for `1.0.0` with known limitations (reverse translation, heuristic coach, no OS sandbox, single-file workspace).

---

## Document control

| Item | Value |
| --- | --- |
| Type | Release readiness / FTU QA audit |
| Companion | [`FINAL_RELEASE_AUDIT.md`](./FINAL_RELEASE_AUDIT.md) (final RC), [`CONFORMANCE.md`](./CONFORMANCE.md) (language), [`PERFORMANCE_AND_STABILITY.md`](./PERFORMANCE_AND_STABILITY.md) (stress timings), [`ide/UI.md`](./ide/UI.md) (chrome backlog), [`FILE_EXPLORER_AUDIT.md`](./FILE_EXPLORER_AUDIT.md) (P0-2 explorer) |
| Next refresh | After P0 packaging pass, or before tagging `1.0.0` |
