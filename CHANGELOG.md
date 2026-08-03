# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
with the usual **0.x** caveat: breaking changes may land in minor bumps until 1.0.0.

## [Unreleased]

### Added (execution worker)

- **Web Worker execution** (`apps/web/lib/worker`): `WorkerController`, structured protocol, `WorkerRuntimeHost`, `WorkerDebuggerBridge`
- UI thread never calls `runPseudocode`; in-process port for Vitest

### Fixed (RC audit)

- Checker: isolate `openFiles` when analysing PROCEDURE/FUNCTION bodies (no false `C_FILE_*` at top level)
- Checker: `READFILE` requires a STRING-assignable target (`C_ASSIGN_TYPE`)
- Debugger: Step Over / Step Out still stop on enabled breakpoints
- IDE: Restart awaits the prior interpreter; diagnostics no longer double-printed in the console
- IDE: editable editor uses one scroll container so gutter breakpoints stay aligned
- Translator: reverse-lift dynamic `_pp_files[path]` open/read/write/close; parse `_pp_files[p].write/close()`

### Added

- **Cambridge text file I/O** across checker / interpreter (VirtualFileSystem) / translator (forward + reverse)
- IDE `IdeRuntimeHost.files` in-tab VFS (never OS disk)

### Added (earlier)

- **IDE debugger** (`apps/web/lib/debugger`): line breakpoints, pause/continue, step into/over/out, call stack, current-line highlight
- Interpreter **async debugger hooks** (`onBeforeStatement` may await; exposes `depth`) — `@pseudopilot/interpreter` `0.3.0`

### Fixed

- **IDE runtime review:** stable `useSyncExternalStore` snapshots; Stop/Restart bump session generation before abort (no stale `R_CANCELLED` / OUTPUT races); console soft-cap; INPUT cancel + restart regression tests

### Added (earlier)

- **Web IDE Run integration** (`apps/web/lib/runtime`): Run / Stop / Restart, Console INPUT/OUTPUT, Variables panel via `RuntimeController`
- Interpreter **async RuntimeHost** + `AbortSignal` cancellation (`R_CANCELLED`)
- `docs` / `apps/web/lib/runtime/README.md` for session lifecycle

### Changed

- `@pseudopilot/interpreter` `0.4.0` — virtual text files
- `@pseudopilot/checker` `0.11.0` — `C_FILE_*` diagnostics
- `@pseudopilot/translator` `0.12.0` — file IR + Python mapping
- Architecture: IDE consumes interpreter through controller + debugger session only
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
