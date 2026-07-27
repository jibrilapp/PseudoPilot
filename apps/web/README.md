# @pseudopilot/web

Student IDE for PseudoPilot.

## Run

From the monorepo root:

```bash
pnpm install
pnpm --filter @pseudopilot/language-core build
pnpm --filter @pseudopilot/translator build
pnpm --filter @pseudopilot/web dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Live translation

Editing the **Pseudocode** pane debounces (~250ms) and calls
`translatePseudocodeToPython()` from `@pseudopilot/translator` (package
`exports` → built `dist/`, not live TypeScript source). Prefer starting via
`pnpm --filter @pseudopilot/web dev` so turbo builds workspace deps first.

- On success, the **Python** pane updates.
- On failure, the last successful Python text stays visible and diagnostics
  appear in the bottom Console / Diagnostics panel.

Translator subset: assignment, INPUT/OUTPUT, expressions, CHAR, indexes, **IF**, **WHILE**, **REPEAT**, **FOR**, **CASE**, **PROCEDURE**/**CALL**, **FUNCTION**/**RETURN**.
Unsupported constructs (DECLARE, BYREF, builtins, …) show diagnostics without crashing the UI.
Oversized pastes are rejected by the translator's source size limit (default 256 KiB) so the tab stays responsive.

**Translate-only:** this IDE does **not** run pseudocode or Python. Sandbox/interpreter packages in the monorepo are stubs.
