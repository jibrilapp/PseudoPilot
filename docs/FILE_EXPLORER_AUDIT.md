# File Explorer Audit (v1.0)

**Audit date:** 2026-08-06  
**Workspace:** `/Users/neemaawale/pseudopilot`  
**Scope:** Whether the current File Explorer / workspace chrome is a **release blocker** for public v1.0.  
**Constraint (audit pass):** Docs only — no product code changes in that pass.

> **Implementation update (2026-08-06):** Path A shipped. Decoy `DUMMY_FILES` / `FileExplorer` removed;
> sidebar is [`ProgramWorkspace.tsx`](../apps/web/components/ide/ProgramWorkspace.tsx)
> (Current program / `Untitled.pp`, Pseudocode + Python views, session note). See acceptance
> criteria below (all checked). Historical “Current architecture” sections describe pre-fix state.

**Related:** [`RELEASE_READINESS.md`](./RELEASE_READINESS.md) **P0-2** (fake multi-file workspace — **done**), score “File handling (explorer / tabs)” updated after path A.

---

## Verdict (tl;dr)

| Question | Answer |
| --- | --- |
| Is the **fake file tree** a release blocker? | **Yes** — it misleads first-time users into believing they have a multi-file project. |
| Is a **full VS Code–style explorer** required for v1.0? | **No** — Cambridge programs are single-file; the IDE is a dual-buffer teaching surface. |
| Recommended path | **Remove / collapse the stub** into an honest single-program workspace (smallest production-ready fix). Do **not** build real multi-file CRUD for v1.0. |
| Est. for recommended path | **2–4 hours** (honest single-file chrome). Real multi-file: **2–4 days** (out of scope for v1). |

---

## Current architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ IdeShell                                                        │
│  activeFileId: string  (UI only — does not select a buffer)     │
│                                                                 │
│  usePseudocodeTranslation(DUMMY_PSEUDOCODE)                     │
│    ├── pseudocode: string   ←── single in-memory buffer         │
│    └── python: string       ←── peer buffer (live sync)         │
│                                                                 │
│  localStorage: pseudopilot.ide.layout.v1                        │
│    └── sidebar/right/console sizes, welcomeDismissed,           │
│        timestamps — NOT editor source                           │
└───────────────┬─────────────────────────────┬───────────────────┘
                │                             │
                ▼                             ▼
        FileExplorer                    DualEditor
        tree = DUMMY_FILES              tabs = DUMMY_TABS
        onSelect → setActiveFileId      always shows same two panes
                                        paths hardcoded:
                                        src/main.pseudo / src/main.py
```

### Components & data

| Piece | Role today |
| --- | --- |
| [`FileExplorer.tsx`](../apps/web/components/ide/FileExplorer.tsx) | Presentational tree: expand/collapse folders, highlight `activeId`, call `onSelect(id)` for files. No I/O, no context menu, no mutations. |
| [`dummy.ts`](../apps/web/lib/dummy.ts) `DUMMY_FILES` | Static decoy tree: `src/` (`main.pseudo`, `main.py`, `helpers.pseudo`), `exercises/` (`01-loops`, `02-arrays`), `README.md`. Hardcoded workspace title in explorer: “loops-lab · Cambridge 9618 · preview”. |
| `DUMMY_TABS` | Two tabs only: `main.pseudo` / `main.py`. Not derived from the tree. |
| [`IdeShell.tsx`](../apps/web/components/ide/IdeShell.tsx) | Wires explorer + tabs to `activeFileId`. Selecting a tree node **never** loads content. Welcome “New File” / examples only call `setPseudocode(...)`. |
| [`DualEditor.tsx`](../apps/web/components/ide/DualEditor.tsx) | Always mounts both panes with the shared buffers. Tab / explorer selection only tweaks **emphasis** (`pseudoEmphasis` / `pythonEmphasis` via id string heuristics). Path headers are literals. |
| [`usePseudocodeTranslation`](../apps/web/hooks/usePseudocodeTranslation.ts) | Document model = two React strings + bidirectional sync. Bootstrapped once from `DUMMY_PSEUDOCODE`. |
| [`layoutPersistence.ts`](../apps/web/lib/ide/layoutPersistence.ts) | Persists chrome layout only. |
| Monaco / LS | Single-document URI model for Pseudocode analysis (teaching IDE, not a project workspace). Language docs note Cambridge programs are **single-file**. |

### How documents are actually stored

- **Not** a multi-document store.
- **Not** written to disk or `localStorage`.
- **Two volatile strings** in the client: Pseudocode + Python, kept in sync by the translation engine.
- Refresh → buffers reset to the default starter (`DUMMY_PSEUDOCODE` / translated Python).
- Welcome “New File” replaces the Pseudocode string with `NEW_FILE_TEMPLATE`; it does not create a node in the tree.

---

## Current limitations

| Area | Behaviour |
| --- | --- |
| Open file | Clicking tree entries (e.g. `helpers.pseudo`, exercises, `README.md`) changes highlight only; editor content unchanged. No OS / File System Access open. |
| Save file | No save, download, or copy-as-file. Edits are lost on refresh (see RELEASE P1-2). |
| Create file | Welcome “New File” resets the single buffer. Explorer cannot create nodes. |
| Rename / delete | Absent. |
| Folders | Visual expand/collapse only; no real folder semantics. |
| Tabs | Decorative dual tabs for the two panes; tree files have no corresponding tabs or buffers. |
| Unsaved indicators | None (no dirty bit, no “•”, no beforeunload). |
| Persistence | Layout + welcome flag only; source not persisted. |
| Drag & drop | Absent (splitters drag; not files). |
| Keyboard shortcuts | No explorer/file shortcuts. Docs search shortcut exists elsewhere; Run/file ops unwired. |
| Search activity | Activity Bar “Search” still shows the same `FileExplorer` (separate stub; RELEASE P1-1). |

**Trust problem:** The chrome looks like a project IDE. The product is a **single dual-pane program**. That gap is what makes P0-2 a packaging / honesty blocker — not the absence of Git-style file management.

---

## Capability matrix

Classification relative to a **defensible public student IDE v1.0** (Cambridge single-program teaching loop), not a general-purpose IDE.

| Capability | Status today | Classification | Notes |
| --- | --- | --- | --- |
| Honest workspace chrome (no fake files) | Missing | **Required for v1.0** | Closes P0-2; stops FTU confusion. |
| Dual Pseudocode ↔ Python surface | Works | **Required** | Core product; not “explorer”, but the real document model. |
| Welcome New File / Open Example | Works (buffer replace) | **Required** | Keep; do not pretend they create tree files. |
| Tab labels that match real panes | Partial (2 tabs OK if honest) | **Required** | Tabs for non-existent files must not appear. |
| Editor buffer persistence **or** explicit “not saved” | Missing | **Required** (product P1; adjacent to explorer) | Persistence preferred; banner acceptable as interim honesty. |
| Unsaved / dirty indicator | Missing | **Nice to have** | Needed if multi-buffer or if persistence exists with discard. |
| Download / copy Pseudocode (and optionally Python) | Missing | **Nice to have** | Cheap “export” without a VFS. |
| Upload / paste into buffer | Partial (paste in Monaco) | **Nice to have** | File picker open is optional polish. |
| Create / rename / delete files | Missing | **Out of scope** | No multi-document model for v1. |
| Real folders / project tree | Decorative only | **Out of scope** | Language is single-file. |
| Multi-buffer / multi-tab documents | Missing | **Out of scope** | Would be a new product surface (days). |
| Drag & drop files into workspace | Missing | **Out of scope** | |
| Explorer keyboard shortcuts (rename, etc.) | Missing | **Out of scope** | |
| OS File System Access / cloud sync | Missing | **Out of scope** | |
| Workspace Search panel | Stub | Separate P1 — **not** this explorer MVP | Remove or stub-label; don’t conflate with tree honesty. |

---

## Recommended minimum viable explorer

**Goal:** Make the sidebar tell the truth in the smallest change set.

### Preferred: Honest single-program chrome (**implement this**)

1. Replace `DUMMY_FILES` with a **one- or two-node** tree that maps 1:1 to the dual buffers, **or** replace the explorer body with a short “Current program” panel:
   - `main.pseudo` → focuses Pseudocode pane (`activeFileId = main-pseudo`)
   - `main.py` → focuses Python pane (`activeFileId = main-py`)
2. Remove decoys: `helpers.pseudo`, `exercises/*`, `README.md`.
3. Rename workspace header from “loops-lab · … preview” to something honest, e.g. **“Current program”** / **“Single program”** + product version (aligns RELEASE P2-6).
4. Keep DualEditor tabs as the two real panes only (already `DUMMY_TABS`); optionally drop the tab strip if pane headers are enough.
5. Document in CHANGELOG / RELEASE exit criteria: **single-file workspace** (already listed in RELEASE suggested exit criteria §6).

**Optional same-sprint honesty (not explorer CRUD):**

- Persist Pseudocode (+ Python) under a size-capped `localStorage` key, **or** show a persistent “Edits are not saved across refresh” banner (RELEASE P1-2).

### Explicitly recommend **removal / non-implementation** for v1.0

Building these would create a **worse** v1 than shipping an honest single program:

| Feature | Why remove / defer |
| --- | --- |
| Fake multi-file tree | Actively harmful; remove, don’t “finish” it. |
| Real multi-file create/rename/delete | Cambridge dialect + LS + Run path are single-document; multi-file implies import/project model not shipped. |
| Drag & drop project folders | Implies OS workspace; conflicts with browser-only teaching IDE. |
| Markdown / README preview in explorer | No doc buffer; docs already have Documentation activity. |
| Closing tabs / dirty multi-doc UX | No multi-doc store; complexity without teaching value. |

**Hide explorer entirely?** Viable if Activity Bar “Explorer” opens a thin “Program” info panel or is removed and students rely on DualEditor only. Prefer **collapsed honest tree** over empty chrome so mobile dock “explorer” still has a purpose.

---

## Estimated implementation time

| Path | Effort | Outcome |
| --- | --- | --- |
| **A. Honest single-file MVP** (recommended) | **2–4 hours** | Closes P0-2; matches QW-2 spirit (~20–30 min for decoy removal alone; 2–4 h with copy, tabs, tests, mobile). |
| **B. Hide explorer + label DualEditor only** | **1–2 hours** | Also closes P0-2; slightly weaker mobile story. |
| **C. Buffer persistence or “not saved” banner** | **+2–4 hours** | Closes P1-2; strongly recommended with A. |
| **D. Real multi-file buffers + tree CRUD** | **2–4 days** | Not required for v1; defer. |
| **E. Full IDE file UX** (DnD, FS Access, dirty, shortcuts) | **1+ week** | Out of scope. |

---

## Release-blocker verdict

### Is File Explorer a release blocker? **Yes — as currently shipped.**

**Rationale:**

1. **Honesty / trust:** First-run users click non-functional files and conclude the product is broken. RELEASE already scores file handling at **28/100** and lists this as **P0-2**.
2. **Not because students need multi-file projects.** The dialect and runtime are single-program. A **missing** full explorer is fine; a **lying** explorer is not.
3. Closing the blocker does **not** require implementing create/rename/delete/DnD. It requires **removing or collapsing the stub** (path A or B above).
4. After path A/B, file handling ceases to be P0. Remaining gaps (persistence, Search stub) stay P1 / polish.

### Recommended path summary

| Decision | Choice |
| --- | --- |
| Implement full explorer MVP? | **No** (full = multi-file CRUD). |
| Implement **honest single-program** MVP? | **Yes**. |
| Remove / hide stub decoys? | **Yes — required.** |
| Est. for recommended path | **2–4 hours** (explorer honesty); **+2–4 hours** if bundling buffer persistence / unsaved banner. |

---

## Suggested acceptance criteria (post-fix)

- [x] Explorer (or replacement panel) lists only real, selectable surfaces (Pseudocode and/or Python).
- [x] Clicking a listed item changes focus/emphasis to that pane; no dead nodes.
- [x] No `helpers.pseudo` / exercises / README decoys.
- [x] Workspace title does not invent a fake project name without content.
- [x] RELEASE P0-2 marked done; CHANGELOG notes single-program workspace.
- [x] (Preferred) Buffer persistence or explicit non-persistence messaging.

---

## Document control

| Item | Value |
| --- | --- |
| Type | Focused product audit |
| Companion | [`RELEASE_READINESS.md`](./RELEASE_READINESS.md) P0-2 / QW-2, [`ide/UI.md`](./ide/UI.md) |
| Code inspected | `FileExplorer.tsx` (removed), `ProgramWorkspace.tsx`, `IdeShell.tsx`, `DualEditor.tsx`, `dummy.ts`, `layoutPersistence.ts`, `usePseudocodeTranslation.ts`, Welcome / Activity Bar |
| Status | **Path A implemented (2026-08-06)** — honest single-program workspace; decoy tree removed |
| Next step | Optional buffer persistence (P1-2); do not expand into multi-file for v1.0 |
