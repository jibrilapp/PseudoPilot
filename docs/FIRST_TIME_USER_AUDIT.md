# PseudoPilot First-Time User Experience (FTUE) Audit

**Audit date:** 2026-08-07  
**Remediation (Critical FTUE):** 2026-08-07 — autosave/restore, Save/Export downloads, Problems=`C_*`  
**Persona:** Year 13 Cambridge International Computer Science (9618) student who has never seen PseudoPilot  
**Goal question:** Can this student successfully **solve a Paper 2 question without external help**?  
**Constraint (original pass):** Docs-only — **no product code changes** in that pass.  
**Workspace:** `/Users/neemaawale/pseudopilot`

**Companions:** [`RELEASE_READINESS.md`](./RELEASE_READINESS.md) · [`FINAL_RELEASE_AUDIT.md`](./FINAL_RELEASE_AUDIT.md) · [`FILE_EXPLORER_AUDIT.md`](./FILE_EXPLORER_AUDIT.md) · [`docs/ide/UI.md`](./ide/UI.md)

**Severity scale (aligned with other audits):**

| Label | Alias | Meaning for FTUE |
| --- | --- | --- |
| **Critical** | P0 | Blocks completing a Paper 2 attempt or causes silent data loss mid-exercise |
| **High** | P1 | Strongly confuses first-timers; likely wrong conclusions or abandoned flows |
| **Medium** | P2 | Friction, mistrust, or wasted clicks; recoverable with patience |
| **Low** | P3 | Polish / discoverability; does not block the teaching loop |

---

## Executive answer

**With caveats — yes for a typical Paper 2 algorithm question if the student stays in Pseudocode, uses Run, and finishes in one browser session.**

A motivated Year 13 student can open PseudoPilot, load or write Cambridge-flavoured pseudocode, run it, see console output, step with the debugger, and use live Pseudocode↔Python sync as a teaching aid. The core loop (Welcome → edit → Run → Output) is teachable without a teacher present.

**Critical FTUE blockers addressed (2026-08-07):** browser **autosave/restore** (`pseudopilot.ide.workspace.v1`), **Save locally / Download `.pp` / Download `.py`**, and Problems + status bar include language-service **`C_*`** diagnostics. Remaining caveats: treat the Python pane as a teaching translation (not a second runtime), docs IA skews engineering, and dead chrome (Search / Past Paper stub) still confuse. **Note (beta ship):** AI Coach UI is feature-flagged off (`ENABLE_AI_COACH`) — use in-app Documentation instead.

| Verdict option | When |
| --- | --- |
| Yes | Short Paper 2-style algorithm in one sitting, Pseudocode-first |
| **With caveats** | **← current** — save/persist + Problems honesty landed; reverse-Python, docs IA, and dead chrome still hurt FTUE |
| No | Would apply if Run/interpreter or Welcome→editor path were broken (not observed in code/docs) |

---

## Walkthrough narrative (12 steps)

### 1. Landing page

There is **no separate marketing landing**. Root route (`apps/web/app/page.tsx`) mounts `IdeShell` immediately. Browser tab title/description: “PseudoPilot” / “Cambridge pseudocode ↔ Python IDE” (`layout.tsx`).

**Student read:** Feels like dropping straight into an IDE (VS Code–like chrome), not a product tour. First meaningful screen is Welcome (if not previously dismissed) or the dual editors.

### 2. Welcome screen

First visit (until `welcomeDismissed` in `localStorage`) shows [`WelcomeScreen.tsx`](../apps/web/components/ide/WelcomeScreen.tsx):

- Headline: “Cambridge pseudocode, ready to run”
- Explains live dual-pane sync, Run, debugger, AI Coach
- CTAs: **New File**, **Open Example**, **Continue editing**
- Starter + Cambridge example cards (six solid programs in `welcomeExamples.ts`)
- Documentation card + **Past Paper Mode** (“Coming soon”)
- Cambridge disclaimer in low-contrast `text-pp-faint` (FINAL P1-14)

**Student read:** Clear value prop. “Past Paper Mode” sitting next to Docs raises false hope for timed Paper 2 practice. “Open Example” loads the first starter silently — no picker. Disclaimer is easy to miss.

### 3. Opening the IDE

- **New File** / example / **Continue editing** dismisses Welcome and shows `DualEditor`.
- Brand mark **“P”** in the toolbar reopens Welcome (`title="Welcome"`).
- Sidebar defaults to **Program workspace** (honest single program — FILE_EXPLORER path A shipped).
- Layout chrome persists; **source does not**.

**Student read:** Opening the editors is one click. Dense icon toolbar and dual panes appear at once — no guided “click Run next” coachmarks.

### 4. Understanding what PseudoPilot does

Welcome + starter comment in `DUMMY_PSEUDOCODE` (“Run executes the Cambridge interpreter (not Python)”) help. Status bar shows “Unofficial · not affiliated with Cambridge”, “Run · Debugger · Live sync”, `ClientLocal`. Live Translation chip explains auto-sync via `title` / `aria-label`.

**Gaps:** No first-run checklist. Icon-only debug controls lack text. Python pane looks like a second executable language. AI Coach subtitle appends `· heuristic` without explaining offline/rules-based coaching.

### 5. Writing the first program

Defaults load a small INPUT/OUTPUT square example. Examples cover FOR/WHILE/array/PROCEDURE/FUNCTION — good Paper 2 building blocks. Workspace **New program** / **Open example** exist; Open example always takes the first starter (no gallery). Monaco provides Pseudocode highlighting + LS (hover, completion, etc.).

**Student read:** Writing Pseudocode is straightforward. No dirty indicator. No “unsaved” cue beyond a faint footer note in the Program panel.

### 6. Reading diagnostics

Three channels exist:

| Channel | What it shows |
| --- | --- |
| Monaco gutter/markers | Language-service compiler diagnostics (`C_*`) on Pseudocode; reverse-translate markers on Python |
| Console **Problems** | Compiler (`C_*`) + runtime + translation diagnostics (`ConsolePanel`) |
| Status bar problem count | Same total (compiler + translation + runtime) |

**Student read (after fix):** Problems matches editor squiggles for compiler errors.

### 7. Debugging

Activity → Debug shows breakpoints list + call stack; Variables in the right panel. Gutter click toggles breakpoints (`CodeSurface`). Toolbar: Continue / Pause / Step Into / Over / Out / Restart / Run|Stop — mostly icon-only with `title` tooltips. Auto-opens Debug activity + Vars when paused/running.

**Student read:** Power users who know VS Code will manage; others may not discover gutter breakpoints. Step Into from idle starts a stepped run (good) but is not explained on Welcome. No watches (FINAL P2-4). Stack frame click does not switch locals (FINAL P2-5).

### 8. Using translation (live sync)

No manual Translate button (by design — `UI.md`). Chip: Translating… / Synced / Translation failed. Python pane badge can say “Showing last good translation”. Run always executes **Pseudocode** (`title="Run pseudocode"`; visible label still **Run**).

**Student read:** Watching Python update while typing Pseudocode is delightful. Editing Python then pressing Run without understanding buffer ownership is a classic first-timer trap. Reverse failures under-explain fidelity limits (FINAL P1-7).

### 9. Using documentation

Entry: Welcome → Documentation, Activity Bar book icon, or `?docs=1`. Default page is **`ide/UI`** (engineering UI guide), not a student “how to write Pseudocode” landing. Nav includes Language, IDE, AI, Grammar, Architecture, ADRs, API — heavy engineering corpus (FINAL P2-7). Search works in-docs (`Ctrl/Cmd+Shift+F` focuses search). **No explicit “Back to editor” control** — exit by clicking Program/Debug/AI or Run. MobileDock has **no Docs** item (FINAL P1-4).

### 10. Using Learning Center / AI features

There is **no product surface named “Learning Center”**. Closest: **AI Coach** (Activity / toolbar spark / right panel **AI** tab). Quick actions + prompt suggestions are good FTUE. Provider id `heuristic` surfaces in the subtitle. Answers are rules-based and grounded — useful for common errors, not ChatGPT-class Paper 2 mark-scheme coaching.

### 11. Saving / exporting

**Shipped (2026-08-07):** Program workspace **Save locally** (same `localStorage` as autosave), **Download Pseudocode (.pp)**, **Download Python (.py)**. Autosave debounce after edits; restore on reload with banner.

**Student read:** Homework / Paper 2 practice can survive refresh; Download gives a file for submission or backup.

### 12. Leaving and returning

| Persists | Does not persist |
| --- | --- |
| Layout sizes, welcome dismissed, timestamps pref (`pseudopilot.ide.layout.v1`) | Breakpoints, console history, coach chat (session memory only) |
| Pseudocode / Python buffers (`pseudopilot.ide.workspace.v1`) | — |

Returning student skips Welcome (if dismissed) and **restores** prior buffers with a dismissible banner. Dirty `beforeunload` warns when last persist lags edits.

---

## Confusion moments

For each: **expected · actual · why confusing · severity · recommended fix · est.**

### C1 — No save / export for exam practice — **DONE (2026-08-07)**

- **Expected:** Save or download `.pp` / `.py` before leaving.
- **Actual (fixed):** Program workspace **Save locally**, **Download Pseudocode (.pp)**, **Download Python (.py)**; autosave to `localStorage`.
- **Why:** Paper 2 practice is multi-hour; refresh/close is normal.
- **Severity:** Critical (P0 for FTUE workflow) — **addressed**
- **Fix shipped:** Download helpers + size-capped autosave (`workspacePersistence` / `workspaceDownload`).
- **Est.:** 2–4 h

### C2 — Refresh / close loses work silently — **DONE (2026-08-07)**

- **Expected:** Browser warns, or code restores.
- **Actual (fixed):** Autosave + restore on load; dismissible **Restored previous session** banner; `beforeunload` when dirty vs last persist.
- **Why:** Welcome stays dismissed → looked like “my file emptied.”
- **Severity:** Critical — **addressed**
- **Fix shipped:** `pseudopilot.ide.workspace.v1` + banner + dirty `beforeunload`.
- **Est.:** 30–90 min (warn only) / 2–4 h (persist)

### C3 — Problems panel misses compiler (`C_*`) diagnostics — **DONE (2026-08-07)**

- **Expected:** Problems lists all errors shown in the editor.
- **Actual (fixed):** Problems aggregates **compiler** (LS/`C_*`) + runtime + translation; status count uses the same total.
- **Why:** Students trust Problems; empty state lied.
- **Severity:** Critical (trust) / High (task completion) — **addressed**
- **Fix shipped:** `collectCompilerIdeDiagnostics` → ConsolePanel / StatusBar (FINAL P1-3).
- **Est.:** 2–3 h

### C4 — “Run” vs Python pane ownership

- **Expected:** Run executes what I last edited (or both).
- **Actual:** Always Pseudocode; tooltip only.
- **Why:** Dual editable panes imply dual runtimes.
- **Severity:** High
- **Fix:** Visible label “Run Pseudocode”; short Python header hint “Teaching translation — Run uses Pseudocode.”
- **Est.:** 15–45 min

### C5 — Reverse translation looks like full Python IDE

- **Expected:** Any valid Python round-trips.
- **Actual:** Best-effort reverse; last-good buffer; limited UI honesty.
- **Why:** Editable Python + Live badge oversell fidelity.
- **Severity:** High
- **Fix:** On reverse failure, Problems blurb + deep-link to translation docs (FINAL P1-7).
- **Est.:** 1–2 h

### C6 — Dead Search activity

- **Expected:** Workspace/code search.
- **Actual:** Same Program workspace as explorer (`search` ≡ `explorer`).
- **Why:** Broken-looking control (FINAL P1-1).
- **Severity:** High (trust)
- **Fix:** Remove icon or honest “Coming soon” empty state.
- **Est.:** 10–30 min

### C7 — Past Paper Mode peer card on Welcome

- **Expected:** Timed Paper 2 practice (exactly the goal).
- **Actual:** Dashed “Coming soon” stub.
- **Why:** Sits next to working Documentation CTA.
- **Severity:** Medium–High (expectation)
- **Fix:** Remove from Welcome or demote to tiny roadmap note (FINAL P2-1).
- **Est.:** 10–15 min

### C8 — AI Coach reads as remote LLM

- **Expected:** Conversational AI tutor for Paper 2.
- **Actual:** Offline `heuristic` provider; subtitle `· heuristic`.
- **Why:** “AI Coach” + “Thinking…” oversell (FINAL P1-5).
- **Severity:** High (trust) / Medium (utility still OK)
- **Fix:** “Offline coach (rules-based)” primary label; one-line limits in empty state.
- **Est.:** 10–30 min

### C9 — Docs default + engineering corpus

- **Expected:** Student language cheat-sheet / “how to use PseudoPilot.”
- **Actual:** Default `ide/UI`; ADR/architecture/API in nav.
- **Why:** Overwhelming; wrong first doc for Year 13.
- **Severity:** High (docs FTUE) / Medium (if they search Language)
- **Fix:** Default to language overview; student-filtered nav (FINAL P2-7).
- **Est.:** 1–2 h (default + filter flag) / 4–8 h (full IA)

### C10 — No obvious exit from Documentation

- **Expected:** “Back to editor” button.
- **Actual:** Click another Activity or Run; docs replace center chrome.
- **Why:** Full-bleed docs feel like a separate app.
- **Severity:** Medium
- **Fix:** Explicit Close / Back to program in docs chrome.
- **Est.:** 20–45 min

### C11 — Mobile cannot reopen Docs

- **Expected:** Docs on mobile dock.
- **Actual:** `MobileDock` excludes `docs` (FINAL P1-4).
- **Why:** One-shot docs then trapped in Code/Console/AI.
- **Severity:** High on phone / Low on desktop
- **Fix:** Add Docs dock item or toolbar overflow.
- **Est.:** 30–90 min

### C12 — Open Example / workspace Open example have no picker

- **Expected:** Choose among the six examples.
- **Actual:** Always first starter (`hello-io`).
- **Why:** Welcome cards are the only real gallery; workspace button under-delivers.
- **Severity:** Medium
- **Fix:** Reopen Welcome examples section or small picker modal.
- **Est.:** 45–90 min

### C13 — Icon-only debugger toolbar

- **Expected:** Clear Step / Continue labels (or first-run tip).
- **Actual:** Icons + native `title` only; Run has text.
- **Why:** Dense; Cambridge students may never have used a debugger.
- **Severity:** Medium
- **Fix:** Text labels on md+ breakpoints, or one Debug empty-state tip.
- **Est.:** 30–60 min

### C14 — Breakpoint discovery

- **Expected:** Obvious “set breakpoint” control.
- **Actual:** Gutter click; Debug sidebar explains after you open it.
- **Why:** Empty Debug panel assumes VS Code literacy.
- **Severity:** Medium
- **Fix:** Empty-state with illustrated “click left of line numbers.”
- **Est.:** 15–30 min

### C15 — Disclaimer contrast

- **Expected:** Readable affiliation notice.
- **Actual:** `text-pp-faint` ≈ &lt;3:1 on white (FINAL P1-14).
- **Why:** Legal/trust copy is easy to miss.
- **Severity:** Medium (a11y / trust)
- **Fix:** `text-pp-muted` or darker.
- **Est.:** 15–30 min

### C16 — “Continue editing” on first visit

- **Expected:** Resume my work.
- **Actual:** Opens default starter (no prior work).
- **Why:** Wording implies existing buffer.
- **Severity:** Low–Medium
- **Fix:** “Skip to editor” / “Start with sample program.”
- **Est.:** 5–10 min

### C17 — Workspace Open example vs Welcome gallery mismatch

- Same root as C12; sidebar implies example chooser.
- **Severity:** Medium
- **Fix:** Wire to Welcome or picker.
- **Est.:** (see C12)

### C18 — Learning Center absent

- **Expected (brief):** Learning Center / AI features.
- **Actual:** Only AI Coach + in-app docs; no Learning Center IA.
- **Why:** Brief name doesn’t map to UI vocabulary.
- **Severity:** Low (naming) — not a missing product if Coach+Docs are the learning surface
- **Fix:** Welcome one-liner: “Learn with Docs + AI Coach” (no new feature).
- **Est.:** 10 min

### C19 — No keyboard Run shortcut

- **Expected:** Ctrl/Cmd+Enter or F5.
- **Actual:** Almost no global shortcuts (FINAL P1-13); docs search only.
- **Severity:** Medium (power) / Low (mouse-first FTUE)
- **Fix:** Wire Run/Stop at minimum.
- **Est.:** 1–2 h

### C20 — Status bar chrome noise

- **Expected:** Useful status.
- **Actual:** “Monaco”, “UTF-8”, `ClientLocal` without explanation.
- **Why:** Dev IDE residue for students.
- **Severity:** Low
- **Fix:** Drop or replace with “Interpreter · local.”
- **Est.:** 10–15 min

### C21 — Program persistence note easy to miss — **mitigated (2026-08-07)**

- **Expected:** Unmissable unsaved warning.
- **Actual (improved):** Autosave + restore banner; workspace footer notes autosave; Save / Download actions.
- **Severity:** High (pairs with C1/C2) — **largely addressed** by persist + banner
- **Fix shipped:** Autosave + “Restored previous session” banner under editor chrome.
- **Est.:** 20–40 min

### C22 — Coach chat / breakpoints not restored on return

- **Expected:** Session continuity beyond layout.
- **Actual:** Only layout + welcome flag.
- **Severity:** Medium (secondary to code loss)
- **Fix:** Defer; prioritize buffer persistence.
- **Est.:** — (covered by C1)

---

## Top 20 usability issues

| # | Issue | Sev | Est. | Evidence |
| ---: | --- | --- | --- | --- |
| 1 | No Save / Download / Export | Critical → **done** | 2–4 h | Program workspace Save / Download; FINAL top improvement #1 |
| 2 | Session-only buffers + no `beforeunload` | Critical → **done** | 2–4 h | Autosave `workspace.v1` + restore banner + dirty warn; FINAL P1-2 |
| 3 | Problems / status omit LS `C_*` | Critical → **done** | 2–3 h | Compiler diags wired into ConsolePanel / status; FINAL P1-3 |
| 4 | Run label hides Pseudocode-only execution | High | 15–45 min | Toolbar `Run` vs `title="Run pseudocode"`; FINAL P1-6 |
| 5 | Reverse Python fidelity under-explained | High | 1–2 h | liveSync badges; FINAL P1-7 |
| 6 | Dead Search activity | High | 10–30 min | ActivityBar + IdeShell; FINAL P1-1 |
| 7 | AI Coach / `heuristic` oversells LLM | High | 10–30 min | AiAssistantPanel; FINAL P1-5 |
| 8 | Docs default to engineering `ide/UI` + heavy corpus | High | 1–2 h | `defaultDocSlug`; FINAL P2-7 |
| 9 | Persistence note only in faint sidebar footer | High | 20–40 min | ProgramWorkspace |
| 10 | Mobile docs re-entry missing | High | 30–90 min | MobileDock; FINAL P1-4 |
| 11 | Past Paper Mode peer stub on Welcome | Medium | 10–15 min | WelcomeScreen; FINAL P2-1 |
| 12 | No Back-to-editor in docs chrome | Medium | 20–45 min | DocumentationView / IdeShell |
| 13 | Workspace “Open example” skips gallery | Medium | 45–90 min | IdeShell `handleWorkspaceOpenExample` |
| 14 | Icon-only debug controls | Medium | 30–60 min | Toolbar |
| 15 | Breakpoint empty-state weak | Medium | 15–30 min | DebugSidebar |
| 16 | Disclaimer low contrast | Medium | 15–30 min | WelcomeScreen; FINAL P1-14 |
| 17 | Almost no Run/Stop shortcuts | Medium | 1–2 h | FINAL P1-13 |
| 18 | “Continue editing” first-visit wording | Low | 5–10 min | WelcomeScreen |
| 19 | Status bar “Monaco / UTF-8 / ClientLocal” | Low | 10–15 min | StatusBar |
| 20 | No Learning Center label (docs+coach only) | Low | 10 min | Product IA; Welcome copy |

---

## Top 10 quick wins (&lt;15 min each)

| ID | Fix | Est. |
| --- | --- | --- |
| QW-1 | Remove Activity Bar **Search** or show “Coming soon” empty state | 10–15 min |
| QW-2 | Soften/remove **Past Paper Mode** card on Welcome | 10 min |
| QW-3 | Coach header → “Offline coach (rules-based)” (drop opaque `heuristic`) | 10 min |
| QW-4 | Visible toolbar label **Run Pseudocode** | 5–10 min |
| QW-5 | Welcome CTA: “Skip to editor” instead of “Continue editing” | 5 min |
| QW-6 | Disclaimer → `text-pp-muted` (contrast) | 5–10 min |
| QW-7 | One-line editor-adjacent session note: “Not saved — refresh clears code” | 10–15 min |
| QW-8 | Debug empty state: “Click the gutter left of a line number to set a breakpoint” | 10 min |
| QW-9 | Status bar: drop “Monaco / UTF-8” or replace with “Local interpreter” | 10 min |
| QW-10 | Welcome blurb: “Learn with **Documentation** and the **AI Coach** (offline hints)” | 10 min |

---

## Estimated total polish time

Scoped to **FTUE / first Paper 2 attempt** — not full v1.1 feature set.

| Track | Effort | Scope |
| --- | --- | --- |
| Quick wins (QW-1…10) | **~1.5–2.5 h** | Labels, stubs, contrast, empty states |
| Critical FTUE (save or warn + Problems=`C_*`) | **~1–1.5 days** | Download/`beforeunload`/persist; unify diagnostics |
| High FTUE (Run honesty, reverse help, docs default, mobile docs, Search) | **~1 day** | Messaging + small IA |
| Medium polish (example picker, debug labels, docs Back, shortcuts MVP) | **~1–2 days** | Discoverability |
| **Total to a defensible FTUE for Paper 2 practice** | **~3.5–5.5 working days** | Assumes language/runtime stay frozen |

Narrower “stop the bleeding” path (**QW + beforeunload banner + Run Pseudocode label + Problems C_***): **~1–2 days**.

---

## Methodology

### Persona & success criterion

Acted as a Year 13 9618 student aiming to **answer a Paper 2 algorithm question** (write Pseudocode, test with sample inputs, fix errors, optionally compare Python) **without a teacher or README**.

Success = complete that loop in-product. Failure modes include lost work, mistrusted diagnostics, wrong execution model, or abandoned docs/coach.

### Evidence sources (prefer code + prior audits over invention)

| Area | Inspected |
| --- | --- |
| Shell / onboarding | `IdeShell.tsx`, `WelcomeScreen.tsx`, `welcomeExamples.ts`, `layoutPersistence.ts` |
| Workspace | `ProgramWorkspace.tsx`, `programWorkspace.ts`, `FILE_EXPLORER_AUDIT.md` |
| Chrome | `Toolbar.tsx`, `StatusBar.tsx`, `ActivityBar.tsx`, `MobileDock.tsx` |
| Editors / sync | `DualEditor.tsx`, `CodeSurface.tsx`, `liveSyncStatus.ts`, `dummy.ts`, `UI.md` |
| Console / diagnostics | `ConsolePanel.tsx`, IdeShell diagnostic wiring |
| Debugger | `DebugSidebar.tsx`, `VariableInspector.tsx` |
| Coach | `AiAssistantPanel.tsx`, `useAICoach.ts`, heuristic provider id |
| Docs | `DocumentationView.tsx`, `DocSidebar.tsx`, `discover.ts` / `defaultDocSlug` |
| Prior audits | `RELEASE_READINESS.md`, `FINAL_RELEASE_AUDIT.md`, `FILE_EXPLORER_AUDIT.md`, `UI.md` |

### Not done in this pass

- Live browser click-through / screen reader session (inferred from code + screenshots/docs).
- Hosted production URL verification.
- Implementing any product fixes (docs-only deliverable).

### Severity calibration

Aligned with RELEASE / FINAL **P0–P3** language; FTUE Critical ≈ workflow blockers for Paper 2 practice even when language correctness is fine.

---

## Document control

| Item | Value |
| --- | --- |
| Type | FTUE audit (+ Critical remediation notes) |
| Persona | Year 13 Cambridge 9618, first visit |
| Verdict | **With caveats — yes** for Pseudocode-first Paper 2; Critical C1–C3 addressed |
| Deliverable | This file |
| Next refresh | After remaining High FTUE items (Run honesty, docs IA, Search stub, etc.) |
