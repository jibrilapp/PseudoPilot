# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
with the usual **0.x** caveat: breaking changes may land in minor bumps until 1.0.0.

## [Unreleased]

### Added

- Open-source release scaffolding: `LICENSE` (MIT), `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, GitHub Actions CI, issue/PR templates
- Source size limits on `@pseudopilot/language-core` `parse` and `@pseudopilot/translator` entrypoints (DoS / browser freeze guard)
- Configurable `maxSourceChars` on `TranslateOptions`
- Full IR type surface + `SourceSpan`/`Position` re-exports from `@pseudopilot/translator`
- Package version identity tests; npm metadata (`repository`, `bugs`, `homepage`, `engines`)

### Changed

- Root and package READMEs updated to match the current V8 translator/IDE subset
- Aligned `@pseudopilot/language-core` and `@pseudopilot/translator` package versions to `0.8.0`
- `language-core` build excludes `*.test.ts` from `dist/`
- Implementation checklist reconciled with V8 translator (CASE no longer marked Run ✅)
- Web IDE: translate-only disclaimer, highlight length cap, dropped unused `language-core` direct dependency
- Cambridge affiliation disclaimer on root README

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
