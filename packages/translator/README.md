# @pseudopilot/translator

Bidirectional **Cambridge 9618 pseudocode ↔ Python** translation via a canonical IR.

## Supported subset (current)

| Supported | Not supported |
| --- | --- |
| Assignment (`←` / `=`) including `A[i]` / `A[i, j]` | CASE |
| `INPUT` / `OUTPUT` (incl. indexed targets) | `FOR` / `REPEAT` |
| **`IF` / `THEN` / `ELSE` / `ELSE IF` / `ENDIF`** | DECLARE, routines |
| **`WHILE` / `[DO]` / `ENDWHILE`** | File I/O, builtins, `&` |
| Literals: integer, real, string, char, boolean | |
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

### WHILE mapping

```
WHILE Count < 10 DO        while Count < 10:
    Count ← Count + 1          Count = Count + 1
ENDWHILE
```

`DO` is optional on input (Teacher Guide omits it); Cambridge print always emits `DO`. Nested WHILE and WHILE↔IF nesting are supported. Empty body → Python `pass`.

## Usage

```ts
import {
  translatePseudocodeToPython,
  translatePythonToPseudocode,
} from '@pseudopilot/translator';

const py = translatePseudocodeToPython(`
WHILE Count < 10
    OUTPUT Count
    Count ← Count + 1
ENDWHILE
`);
```

## Architecture

See [`docs/language/TRANSLATION.md`](../../docs/language/TRANSLATION.md) and [ADR 0006](../../docs/adr/0006-canonical-ir-translation.md).

## Test

```bash
pnpm --filter @pseudopilot/translator test
```
