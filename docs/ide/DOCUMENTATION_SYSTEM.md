# PseudoPilot Documentation System

In-app help for the student IDE (`apps/web`). Markdown under the repo `docs/`
tree is the **single source of truth** — content is never duplicated into the
web app. Users open Documentation from Welcome, the Activity Bar, or (later) the
Command Palette without leaving PseudoPilot.

## Architecture

```
docs/ (all .md files, recursive)
      │
      ▼
scripts/generate-docs-corpus.mjs   (predev / prebuild / pretest)
      │
      ▼
lib/docs/corpus.generated.ts       (bundled raw markdown)
      │
      ├── discover.ts   → categories, slugs, titles, headings
      ├── links.ts      → relative link resolve + broken-link check
      ├── search.ts     → title / heading / content index
      ├── parseDocMarkdown.ts + highlight.ts
      └── catalog.ts    → getDocTree()
            │
            ▼
DocumentationView → DocSidebar + DocMarkdown + DocToc
            │
            ▼
IdeShell (activity === 'docs' | ?docs=1 | Welcome → Docs)
```

Next.js does not ship Vite’s `import.meta.glob`, so discovery is a small Node
generator that walks `../../docs` and emits a typed corpus module. Adding a new
`.md` file under `docs/` is enough — the next `dev` / `test` / `build` regenerates
the index; no hardcoded page lists.

## Loading & routing

| Concept | Value |
| --- | --- |
| Path | Repo-relative under `docs/`, e.g. `ide/UI.md` |
| Slug | Path without `.md`, e.g. `ide/UI` |
| Category | Top-level folder (`language`, `ide`, …) or **Getting Started** for root files |
| Default page | `ide/UI` when present |

`IdeShell` keeps a `showDocs` workspace flag (alongside welcome / editor). Opening
docs sets Activity Bar → Documentation, hides the file explorer / AI side chrome,
and mounts `DocumentationView` in the main area. Query `?docs=1` forces the view
(screenshot helper).

Internal markdown links (`./MONACO.md`, `../language/SPECIFICATION.md`) navigate
inside the viewer via `resolveDocHref`. `http(s)` / `mailto:` open in a new tab.
Images resolve through `GET /api/docs-asset?path=…` (files under `docs/` only).

## Search

`searchDocs(tree, query)` tokenizes the query and ranks:

1. Title matches  
2. Heading matches  
3. Body (`searchText` — markdown stripped)

Results highlight matched tokens in the sidebar. Focus search with
**Ctrl/Cmd+Shift+F** while docs are open (command stub companion).

## Command Palette (future-ready)

`lib/docs/commands.ts` exports `DOCS_COMMANDS` and `registerDocsCommands(handlers)`.
Ids: `docs.open`, `docs.search`, `docs.goHome`, `docs.next`, `docs.prev`. Wire these
into a palette when one lands; `DocumentationView` already registers a subset.

## Adding a page

1. Create `docs/<category>/<Name>.md` (or a root file such as `docs/FOO.md`).
2. Use a single `# Title` H1 — it becomes the nav label.
3. Link to siblings with relative paths (`./OTHER.md`).
4. Run `pnpm --filter @pseudopilot/web docs:corpus` (or any `dev` / `test`).
5. The new page appears under the category derived from its folder.

Optional category label niceties live in `discover.ts` (`CATEGORY_LABELS`); unknown
folders title-case automatically. **Do not** hardcode individual pages.

## Rendering

`DocMarkdown` parses a docs-oriented subset without extra dependencies: headings,
paragraphs, lists, tables, fenced code, blockquotes / callouts (`**Note**` /
`**Warning**` / `**Tip**`), images, and inline emphasis / links. Code fences get
lightweight highlighting for pseudocode, Python, TypeScript/JavaScript, and JSON,
plus a Copy button.

## Testing

`lib/docs/docs.test.ts` covers corpus discovery, search, markdown parsing,
highlighting, internal link resolution, and broken-link detection against the
real corpus. Regenerate the corpus before tests (`pretest`).

## Screenshots

| Shot | Path | Helper |
| --- | --- | --- |
| Docs viewer | [`screenshots/docs-viewer.png`](./screenshots/docs-viewer.png) | `?docs=1` |
| Welcome docs CTA | [`screenshots/docs-welcome.png`](./screenshots/docs-welcome.png) | `?welcome=1` |

Capture with headless Chrome against the local Next server when available.
