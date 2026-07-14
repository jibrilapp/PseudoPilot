# @pseudopilot/translator

Bidirectional **Cambridge 9618 pseudocode ↔ Python** translation via a canonical IR.

## V1 subset

| Supported | Not supported |
| --- | --- |
| Assignment (`←` / `=`) | IF / CASE |
| `INPUT` / `OUTPUT` | Loops |
| Literals, variables | DECLARE, routines |
| Arithmetic, relational, logical exprs | Arrays, files, builtins |

## Usage

```ts
import {
  translatePseudocodeToPython,
  translatePythonToPseudocode,
} from '@pseudopilot/translator';

const py = translatePseudocodeToPython(`
Count ← 2 + 3 * 4
OUTPUT Count
`);

const ps = translatePythonToPseudocode(`
count = 2 + 3 * 4
print(count)
`);
```

## Architecture

See [`docs/language/TRANSLATION.md`](../../docs/language/TRANSLATION.md) and [ADR 0006](../../docs/adr/0006-canonical-ir-translation.md).

## Design decisions (V1)

1. **IR-centric** — never string-rewrite between dialects.
2. **Cambridge parse** reuses `@pseudopilot/language-core`; Python has a dedicated V1 subset parser.
3. **`DIV`/`MOD` ↔ `//`/`%`**; `=`/`<>` ↔ `==`/`!=`; `AND`/`OR`/`NOT` ↔ `and`/`or`/`not`.
4. **`INPUT x` ↔ `x = input()`**; `OUTPUT a, b` ↔ `print(a, b)`.
5. **`input(prompt)`** preserves prompt on IR; Cambridge print emits `OUTPUT prompt` then `INPUT x`.
6. **Trivia** — line comments / blank lines attach to statements; marker style adapts (`//` ↔ `#`).
7. **Unsupported constructs fail** with `T_UNSUPPORTED_*` / `T_PY_*` diagnostics (`ok: false`).

## Test

```bash
pnpm --filter @pseudopilot/translator test
```
