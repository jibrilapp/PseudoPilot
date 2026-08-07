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
- Python: **editable** first-class peer — live reverse translation into Pseudocode

Details: [`docs/ide/MONACO.md`](../../docs/ide/MONACO.md) · UI chrome: [`docs/ide/UI.md`](../../docs/ide/UI.md).

## Live bidirectional translation

Origin-aware sync (`lib/translation/bidirectionalSync.ts`):

| Edit | Action |
| --- | --- |
| Pseudocode | Debounced forward `translatePseudocodeToPython` → update Python (**no** reverse) |
| Python | Debounced reverse `translatePythonToPseudocode` → update Pseudocode (**no** forward) |

- On success, the peer pane updates via Monaco `executeEdits` (undo/cursor/scroll preserved where practical).
- On failure, the last successful peer text stays visible; diagnostics go to the Console (and Python Monaco markers for reverse errors). CompilerService / breakpoints / debugger state are not cleared.
- Run/Debug always executes the Pseudocode buffer.

## Run / Debug

Toolbar Run uses `RuntimeController` → Web Worker → `@pseudopilot/interpreter`.
Debugger: breakpoints (glyph margin), Continue / Pause / Step Into / Over / Out, Restart, Stop.

## AI Coach

> **v1.0.0-beta:** Coach UI is **disabled** (`ENABLE_AI_COACH` in
> `lib/featureFlags.ts`). Set to `true` to restore the dockable panel.

Dockable **AI** panel (`AiAssistantPanel`) talks only to `AICoachService`.
Context is assembled from LanguageService / CompilerService / RuntimeController /
translation buffers — see [`docs/ai/AI_COACH.md`](../../docs/ai/AI_COACH.md).

## Deploy

Production hosting runbook: [`docs/DEPLOY.md`](../../docs/DEPLOY.md) (Vercel + CI build gate).

