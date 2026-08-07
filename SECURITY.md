# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| `1.0.0-beta.x` | Best-effort security fixes on `main` |
| Older `0.x` tags | Best-effort only while still in active use; prefer upgrading to the current beta line |
| Untagged / local forks | No guarantee |

PseudoPilot packages remain **`private: true`** in this monorepo (not published to npm as a stable public registry release yet). Treat the student IDE and library entrypoints as **beta**.

## What this project executes

The student IDE (`apps/web`) **does execute** Cambridge pseudocode:

- `@pseudopilot/interpreter` runs an AST tree-walk of student source
- Execution is hosted in a **browser Web Worker** (`apps/web/lib/worker`) so the UI thread never calls `runPseudocode` directly
- File I/O uses an in-tab **virtual filesystem (VFS)** — not the host OS disk
- Cooperative limits apply (for example default instruction / call-depth caps). These are teaching safeguards, **not** a hardened multi-tenant sandbox

Translation (Pseudocode ↔ Python) runs in-process in the browser and does **not** `eval` Python. The **Run** button executes Pseudocode only.

`@pseudopilot/sandbox` / `services/runtime-sandbox` are **stubs** for a future remote/OS isolation path. **Do not** treat the shipped browser IDE as safe isolation for untrusted code on a shared host, exam kiosk farm, or multi-tenant server. See [`docs/language/INTERPRETER.md`](./docs/language/INTERPRETER.md) (known limitations).

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

1. Email the maintainers at **security@pseudopilot.dev** (or open a private GitHub Security Advisory if that channel is enabled on the repository).
2. Include: affected package/path, reproduction steps, impact assessment, and any suggested fix.
3. Allow **72 hours** for an initial acknowledgement.

We will coordinate a fix and public disclosure after a patch is available (or after agreeing that the report is out of scope).

## Scope

In scope:

- Denial of service via unbounded parse / translate / interpret of pasted input (client or library)
- Injection risks if diagnostics, coach markdown, or source are rendered unsafely in the IDE
- Escape from intended VFS / Worker boundaries that could touch unexpected browser capabilities
- Supply-chain issues in release artifacts / CI
- Future remote sandbox escape once OS isolation ships

Out of scope:

- Academic integrity / exam cheating concerns
- Flaws that require a compromised developer machine
- Expecting OS-level CPU / memory isolation from the current browser Worker + step limits
- Theoretical issues in unimplemented stubs (`@pseudopilot/sandbox`, curriculum profiles, LSP process server) unless reachable from a shipped entrypoint

## Hardening expectations (maintainers)

- Enforce source size / diagnostic soft-caps on public parse / translate / interpret entrypoints
- Never `eval` user source on the translation path
- Keep language packages free of network I/O
- Run IDE execution only through the Worker + `RuntimeController` boundary
- Treat any future remote sandbox as an untrusted-code host with CPU / memory / time budgets
