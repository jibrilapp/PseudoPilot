# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
with the usual **0.x** caveat: breaking changes may land in minor bumps until 1.0.0.

## [Unreleased]

### Fixed

- **IDE runtime review:** stable `useSyncExternalStore` snapshots; Stop/Restart bump session generation before abort (no stale `R_CANCELLED` / OUTPUT races); console soft-cap; INPUT cancel + restart regression tests

### Added

- **Web IDE Run integration** (`apps/web/lib/runtime`): Run / Stop / Restart, Console INPUT/OUTPUT, Variables panel via `RuntimeController`
- Interpreter **async RuntimeHost** + `AbortSignal` cancellation (`R_CANCELLED`)
- `docs` / `apps/web/lib/runtime/README.md` for session lifecycle

### Changed

- `@pseudopilot/interpreter` `0.2.0` — `runPseudocode` / `interpret` are async
- Architecture: IDE consumes interpreter through controller only (not React → interpreter)
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
