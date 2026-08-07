# PseudoPilot IDE UI

Presentation and interaction guide for the student IDE (`apps/web`). Language
semantics are frozen — this document covers chrome, layout, and accessibility
only. Monaco integration details live in [MONACO.md](./MONACO.md).

## Design system

Tokens live in `apps/web/tailwind.config.js` (`pp.*`) and CSS variables in
`apps/web/app/globals.css`:

| Token | Role |
| --- | --- |
| `pp-canvas` / `pp-shell` / `pp-panel` / `pp-editor` | Layered surfaces (canvas → chrome → panels → editors) |
| `pp-accent` (`#0d7370`) | Primary actions, active indicators |
| `pp-line` / `pp-lineStrong` | Hairlines and splitters |
| `pp-ink` / `pp-muted` / `pp-faint` | Text hierarchy |
| `--pp-focus-ring` | Keyboard focus outline |
| `--pp-space-*` / `--pp-radius-*` | Shared spacing / radius |

Buttons use `.pp-btn`, `.pp-btn-primary`, `.pp-btn-ghost`, `.pp-icon-btn`. Tabs use
`.pp-tab`. Prefer refining these over inventing new visual languages.

## Layout

```
┌ Toolbar ─────────────────────────────────────────────────────┐
│ Activity │ Sidebar │ Dual editors │ Right (AI / Vars)        │
│          │         │──────────────│                          │
│          │         │ Console / Problems                      │
└ Status bar ──────────────────────────────────────────────────┘
```

- **Draggable splitters** resize sidebar, right panel, console, and the
  Pseudocode↔Python editor ratio (pointer + arrow keys; Shift = larger step).
- **Remembered layout** is stored in `localStorage` under
  `pseudopilot.ide.layout.v1` (`lib/ide/layoutPersistence.ts`): sidebar / right /
  console sizes, editor split ratio, timestamp preference, welcome dismissal.
- **Program buffers** autosave under `pseudopilot.ide.workspace.v1` (see Program
  workspace below).
- Mobile uses `MobileDock` views; only one Monaco `DualEditor` mounts at a time
  (desktop vs mobile) to protect startup cost.
- Screenshot helpers: `?welcome=1` forces the landing; `?welcome=0` opens editors.

## Program workspace

Cambridge programs are **single-file**. The Activity Bar **Program** item (and
mobile dock) opens an honest workspace panel — not a multi-file explorer:

- Title: **Current program** / `Untitled.pp`
- Two selectable **views** (Pseudocode / Python) that focus the matching dual
  editor pane — same buffers the tabs expose
- **New program** / **Open example** (same actions as Welcome)
- **Save / Export**: Save locally (browser storage), Download Pseudocode (`.pp`),
  Download Python (`.py`)
- Footer note that the program **autosaves** in this browser (refresh restores);
  use Download for a file copy

Buffers persist under `localStorage` key `pseudopilot.ide.workspace.v1`
(Pseudocode + Python + title). A dismissible **Restored previous session** banner
appears above the editors after a successful restore. Optional `beforeunload`
warns when there are unsaved edits relative to the last successful persist.

There is no fake folder tree, no decoy files, and no implication of a project
VFS. See [`FILE_EXPLORER_AUDIT.md`](../FILE_EXPLORER_AUDIT.md) (path A).

## Editors

- Tabs: `Untitled.pp` / `Untitled.py` — the dual panes only.
- Active editor column gets a subtle accent inset + header tint.
- Minimap: characters off, slider on mouseover.
- Padding / line metrics stay aligned with `CODE_SURFACE_LAYOUT` /
  `MONACO_FONT` (see layout contract tests).
- Bidirectional sync must not reintroduce peer-apply reverse loops — see
  [MONACO.md](./MONACO.md).

## Toolbar

Consistent iconography for Program workspace, Console, Side panel,
Continue / Pause / Step*, Restart, Run / Stop. A **Live Translation** status chip
replaces manual Translate / Reverse Translate actions — editing either editor
updates the other automatically. Chip states: Translating… / Synced /
Translation failed (`aria-live="polite"`). Brand mark reopens the welcome screen.
(AI Coach toolbar entry is gated off for **v1.0.0-beta** — see below.)

## Live sync

Origin-aware Pseudocode ↔ Python sync runs on every edit (debounced). There is
**no** manual Translate button. Failures keep the last good peer buffer and
surface diagnostics in Console / Monaco; the next edit retries automatically.
Status also appears in the status bar when no run is active.

## Console & Problems

- **Output** tab: runtime stdout/stderr, INPUT prompt, optional timestamps (`Ts`).
- **Problems** tab: **compiler** (language-service / checker, including `C_*`),
  translation, and runtime diagnostics; rows are clickable and reveal the
  Pseudocode line in Monaco. Empty state only when all three sources are clean.
- Status bar problem count includes compiler + translation + runtime diagnostics
  and opens the Problems tab.

## Debugger

Activity → Debug: breakpoints list (enable / remove / reveal), call stack with
current-frame emphasis, paused-line badge. Variables stay in the right panel.

## AI Coach

> **Disabled in v1.0.0-beta UI.** The coach panel, Activity Bar entry, toolbar
> spark, and mobile AI view are hidden via `ENABLE_AI_COACH` in
> `apps/web/lib/featureFlags.ts`. Flip that flag to `true` to restore the
> previous chrome. Package and docs remain — see [AI_COACH.md](../ai/AI_COACH.md).

When enabled: quick actions, empty-state prompt suggestions, lightweight
markdown (fenced code, inline code, bold, italic) without extra deps, loading
dots, auto-scroll.

## Welcome screen

First visit (until dismissed) shows New File, Open Example, Cambridge examples,
in-app **Documentation** (opens the Documentation workspace — not GitHub), and
Past Paper Mode (coming soon). Copy explains that editing either editor
auto-updates the other. Persisted via `welcomeDismissed`.

## Documentation

Activity Bar → Documentation (or Welcome → Documentation, or `?docs=1`) mounts an
in-app viewer over the editor area. Markdown is loaded from repo `docs/` via a
build-time corpus — see [DOCUMENTATION_SYSTEM.md](./DOCUMENTATION_SYSTEM.md).

## Accessibility

- Splitters are `role="separator"` with keyboard nudging and focus rings.
- Toolbar / activity / tabs / coach composer use `:focus-visible` outlines.
- Console Problems rows and status updates are operable by keyboard.
- `prefers-reduced-motion` short-circuits shell / panel animations.
- Status label uses `aria-live="polite"`.

## Screenshots

| Shot | Path |
| --- | --- |
| Welcome | [`screenshots/welcome.png`](./screenshots/welcome.png) |
| Dual editors | [`screenshots/editors.png`](./screenshots/editors.png) |
| Console shell frame | [`screenshots/console.png`](./screenshots/console.png) |
| Docs viewer | [`screenshots/docs-viewer.png`](./screenshots/docs-viewer.png) |
| Welcome docs CTA | [`screenshots/docs-welcome.png`](./screenshots/docs-welcome.png) |

Captured with headless Chrome against the local Next dev server using
`?welcome=1` / `?welcome=0` / `?docs=1`. Editors shot refreshed after the
single-program workspace chrome (P0-2) landed. Monaco may still be hydrating in
some frames; chrome and layout are representative.

## Testing

UI logic without a DOM harness (vitest `environment: 'node'`):

- `lib/ide/layoutPersistence.test.ts`
- `lib/ide/coachMarkdown.test.ts`
- `lib/ide/welcomeExamples.test.ts`
- `lib/ide/programWorkspace.test.ts`
- `lib/ide/codeSurfaceLayout.test.ts`
- `lib/docs/docs.test.ts`
- `lib/translation/liveSyncStatus.test.ts`

Run: `pnpm --filter @pseudopilot/web test`

## Polish backlog

- Search activity panel (currently a stub entry)
- Watch expressions in the debugger
- Command Palette wiring for `DOCS_COMMANDS`
- Past Paper Mode
- Optional Playwright visual snapshots once a browser harness is added
