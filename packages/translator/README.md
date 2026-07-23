# @pseudopilot/translator

Bidirectional **Cambridge 9618 pseudocode ↔ Python** translation via a canonical IR.

## Supported subset (current)

| Supported | Not supported |
| --- | --- |
| Assignment (`←` / `=`) including `A[i]` / `A[i, j]` | CASE |
| `INPUT` / `OUTPUT` (incl. indexed targets) | Loops (`WHILE` / `FOR` / `REPEAT`) |
| **`IF` / `THEN` / `ELSE` / `ELSE IF` / `ENDIF`** | DECLARE, routines |
| Literals: integer, real, string, char, boolean | File I/O, builtins, `&` |
| Variables + arithmetic / relational / logical exprs | |

### IF mapping

```
IF x > 5 THEN          if x > 5:
    OUTPUT x               print(x)
ELSE                   else:
    OUTPUT 0               print(0)
ENDIF
```

Empty branches → Python `pass`. `ELSE IF` ↔ `elif`. Nested IF preserved with indentation (4 spaces).

## Usage

```ts
import {
  translatePseudocodeToPython,
  translatePythonToPseudocode,
} from '@pseudopilot/translator';

const py = translatePseudocodeToPython(`
IF Score >= 50 THEN
    OUTPUT "Pass"
ELSE
    OUTPUT "Fail"
ENDIF
`);
```

## Architecture

See [`docs/language/TRANSLATION.md`](../../docs/language/TRANSLATION.md) and [ADR 0006](../../docs/adr/0006-canonical-ir-translation.md).

## Test

```bash
pnpm --filter @pseudopilot/translator test
```
