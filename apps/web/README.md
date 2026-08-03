# @pseudopilot/web

Student IDE for PseudoPilot — **Monaco Editor**, live Cambridge ↔ Python translation, and an AST interpreter in a Web Worker.

## Run

From the monorepo root:

```bash
pnpm install
pnpm --filter @pseudopilot/web dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Turbo builds workspace deps first.

## Editor (Monaco)

Pseudocode and Python panes use Monaco (`components/ide/CodeSurface.tsx`).

- Pseudocode: Monarch highlighting, LS providers (hover, completion, definition, rename, …), breakpoints, exec-line highlight
- Python: read-only highlighting of the live translation

Details: [`docs/ide/MONACO.md`](../../docs/ide/MONACO.md).

## Live translation

Editing the **Pseudocode** pane debounces (~250ms) and calls
`translatePseudocodeToPython()` from `@pseudopilot/translator`.

- On success, the **Python** pane updates.
- On failure, the last successful Python text stays visible and diagnostics
  appear in the Console panel (and as Monaco markers from the language service).

## Run / Debug

Toolbar Run uses `RuntimeController` → Web Worker → `@pseudopilot/interpreter`.
Debugger: breakpoints (glyph margin), Continue / Pause / Step Into / Over / Out, Restart, Stop.
