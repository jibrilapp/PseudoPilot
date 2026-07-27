# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| `0.x` (experimental) | Best-effort security fixes on `main` |
| Pre-release / untagged | No guarantee |

PseudoPilot is currently an **experimental (0.x)** monorepo. Packages are not yet published to npm as stable releases.

## What this project executes

Today the student IDE translates Cambridge pseudocode ↔ Python **in the browser**. There is **no** user-code interpreter or remote sandbox wired into the public web app yet.

Planned future components (`@pseudopilot/interpreter`, `services/runtime-sandbox`) will execute student code. Until those ship with documented isolation guarantees, **do not treat any PseudoPilot surface as a safe place to run untrusted code on a shared host**.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

1. Email the maintainers at **security@pseudopilot.dev** (or open a private GitHub Security Advisory if that channel is enabled on the repository).
2. Include: affected package/path, reproduction steps, impact assessment, and any suggested fix.
3. Allow **72 hours** for an initial acknowledgement.

We will coordinate a fix and public disclosure after a patch is available (or after agreeing that the report is out of scope).

## Scope

In scope:

- Denial of service via unbounded parse/translate of pasted input (client or library)
- Injection risks if diagnostics or source are rendered unsafely
- Supply-chain issues in release artifacts / CI
- Future sandbox escape once runtime execution is enabled

Out of scope (for now):

- Academic integrity / exam cheating concerns
- Flaws that require a compromised developer machine
- Theoretical issues in unimplemented packages (`interpreter`, `sandbox`, `ai-coach`) unless they are reachable from a published entrypoint

## Hardening expectations (maintainers)

- Enforce source size limits on public translate/parse entrypoints
- Never `eval` user source in the IDE translation path
- Keep language packages free of network I/O
- Treat future sandboxes as untrusted-code hosts with CPU/memory/time budgets
