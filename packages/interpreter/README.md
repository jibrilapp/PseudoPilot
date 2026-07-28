# @pseudopilot/interpreter

Cambridge **9618 AST interpreter** — executes validated pseudocode directly.

**Version:** `0.2.0`  
**Does not** execute translated Python. Translator remains a separate package.

## Pipeline

```
parse → semantic check → async tree-walk AST
```

Host I/O may be sync or `Promise`-based (browser INPUT). Pass `signal` for cooperative Stop.

Docs: [`docs/language/INTERPRETER.md`](../../docs/language/INTERPRETER.md)

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

DECLARE / CONSTANT, assignment, INPUT/OUTPUT (via `RuntimeHost`; multi-value OUTPUT space-separated), IF / CASE / WHILE / REPEAT / FOR, PROCEDURE / FUNCTION / RETURN / recursion, arrays with bounds checks, Core builtins, `&`, arithmetic / logic / comparisons (AND/OR short-circuit).

## Not yet

File I/O, BYREF, DATE, OOP, debugger UI, security sandbox.

## Test

```bash
pnpm --filter @pseudopilot/interpreter test
```
