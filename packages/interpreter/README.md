# @pseudopilot/interpreter

Cambridge **9618 AST interpreter** — executes validated pseudocode directly.

**Version:** `0.4.0`  
**Does not** execute translated Python. Translator remains a separate package.

## Pipeline

```
parse → semantic check → async tree-walk AST
```

Host I/O may be sync or `Promise`-based (browser INPUT). Pass `signal` for cooperative Stop.
`DebuggerHooks.onBeforeStatement` may return a `Promise` so the IDE can suspend without aborting.
Text files use `RuntimeHost.files` / `VirtualFileSystem` — never the OS disk.

Docs: [`docs/language/INTERPRETER.md`](../../docs/language/INTERPRETER.md) · Files: [`src/files/README.md`](./src/files/README.md)

## Quick use

```ts
import { runPseudocode, MemoryHost, SeededRandom } from '@pseudopilot/interpreter';

const host = new MemoryHost(['Ada']);
const result = runPseudocode(
  `
DECLARE Name : STRING
INPUT Name
OUTPUT "Hello " & Name
`,
  { host, random: new SeededRandom(1) },
);
```

## Supported

DECLARE / CONSTANT, assignment, INPUT/OUTPUT (via `RuntimeHost`; multi-value OUTPUT space-separated), IF / CASE / WHILE / REPEAT / FOR, PROCEDURE / FUNCTION / RETURN / recursion, arrays with bounds checks, Core builtins, `&`, arithmetic / logic / comparisons (AND/OR short-circuit), BYREF, DATE, record `TYPE`, OOP `CLASS`, random files, enum / pointer / SET `TYPE` + `DEFINE`.

`DIV`/`MOD` truncate toward zero (including negatives).

## Not yet

Security sandbox (OS isolation).

## Test

```bash
pnpm --filter @pseudopilot/interpreter test
```
