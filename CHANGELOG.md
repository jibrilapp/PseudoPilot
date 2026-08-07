# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **AI Coach UI disabled** for `v1.0.0-beta` via `ENABLE_AI_COACH = false` in
  `apps/web/lib/featureFlags.ts` — entry points hidden; package + APIs kept.
  Set the flag to `true` to restore the previous coach chrome.

### Added

- Honest **single-program workspace** chrome (`ProgramWorkspace`): Current program /
  `Untitled.pp`, Pseudocode + Python views only, New program / Open example, and a
  session-only persistence note — closes release readiness **P0-2** (see
  [`docs/FILE_EXPLORER_AUDIT.md`](./docs/FILE_EXPLORER_AUDIT.md))
- Production **CI build gate** for `@pseudopilot/web` and Vercel deploy path
  ([`docs/DEPLOY.md`](./docs/DEPLOY.md), `vercel.json`, `.github/workflows/deploy.yml`)
- **Autosave / restore** of the single program (Pseudocode + Python) in browser
  `localStorage` (`pseudopilot.ide.workspace.v1`), with a dismissible “Restored
  previous session” banner — FTUE Critical C1/C2
- **Save / Export** in the Program workspace: Save locally, Download `.pp`,
  Download `.py`
- **Problems** panel and status bar include language-service / checker diagnostics
  (`C_*` codes, severity, location, message) alongside translation + runtime —
  FTUE Critical C3

### Planned

- Remaining P1 usability items from the release readiness audit (Search stub, etc.)
- Attach live Vercel production URL once project secrets / dashboard link exist
- Re-enable AI Coach UI for a post-beta update (`ENABLE_AI_COACH`)

## [1.0.0-beta.0] — 2026-08-06

Public **beta** packaging pass. Not a stable `1.0.0` claim.

### Added

- In-product **Cambridge affiliation disclaimer** on Welcome and status bar
- Root README rewritten for public users (features, install, screenshots, CONFORMANCE pointer)
- `SECURITY.md` updated for the shipped Worker interpreter + VFS reality
- Workspace product versions aligned to **`1.0.0-beta.0`**

### Known limitations (beta)

- Reverse translation (Python → Pseudocode) is best-effort
- **AI Coach UI is disabled** for this beta (`ENABLE_AI_COACH`); implementation kept for a future update
- Browser Worker execution has instruction / depth caps — **not** an OS security sandbox
- Some IDE chrome stubs remain (Search, Past Paper — see release readiness P1); buffer autosave/restore and Problems=`C_*` shipped (see Unreleased)
- Hosted production URL pending Vercel project link / secrets (pipeline configured — see [`docs/DEPLOY.md`](./docs/DEPLOY.md))

### Included product surface (from prior 0.x work)

- Student IDE: Monaco dual editors, live Pseudocode ↔ Python sync, Run / Debug / Console / Variables
- Web Worker interpreter with VFS text + random file I/O
- Language stack: language-core, checker, compiler-service, language-service, translator, conformance
- In-app documentation corpus; offline AI Coach (package intact, **UI gated off** in beta)

## [0.10.0] — semantic checker

### Added

- **`@pseudopilot/checker`**: Cambridge semantic analysis (scopes, symbols, types, calls, returns)
- `docs/language/SEMANTICS.md`
- Translator option `semanticCheck` (default `true`) — parse → check → lower → print

### Changed

- Language duplicate/const diagnostics moved to `C_*` checker codes; translator keeps Python-target `T_*` rules
- Checker: case-insensitive identifiers; structured `help`; diagnostic soft-cap; missing FUNCTION RETURN is an error
- Translator: first-declaration casing rewritten into Python IR (avoids NameError)

## [0.8.0] - 2026-07-27

### Added

- Cambridge **FUNCTION** / `RETURNS` / `ENDFUNCTION` / `RETURN` and expression calls
- Bidirectional mapping with Python `def … -> type` and `return`
- Diagnostics for missing `RETURN`, unreachable code after `RETURN`, keyword/duplicate parameters

### Previously (0.1–0.7 summary)

- Assignment, INPUT/OUTPUT, expressions, CHAR, array indexes
- IF / ELSE / ELSE IF, WHILE, REPEAT, FOR, CASE OF
- PROCEDURE / CALL (Python `def` without return annotation)
- Live student IDE (`apps/web`) with debounced pseudocode → Python translation

[Unreleased]: https://github.com/jibrilapp/PseudoPilot/compare/v1.0.0-beta.0...HEAD
[1.0.0-beta.0]: https://github.com/jibrilapp/PseudoPilot/releases/tag/v1.0.0-beta.0
[0.10.0]: https://github.com/jibrilapp/PseudoPilot/compare/v0.8.0...v0.10.0
[0.8.0]: https://github.com/jibrilapp/PseudoPilot/releases/tag/v0.8.0
