# @pseudopilot/translator

Bidirectional **Cambridge 9618 pseudocode ↔ Python** translation via a canonical IR.

## Supported subset (current)

| Supported | Not supported |
| --- | --- |
| Assignment (`←` / `=`) including `A[i]` / `A[i, j]` | CASE |
| `INPUT` / `OUTPUT` (incl. indexed targets) | `FOR` |
| **`IF` / `THEN` / `ELSE` / `ELSE IF` / `ENDIF`** | DECLARE, routines |
| **`WHILE` / `[DO]` / `ENDWHILE`** | File I/O, builtins, `&` |
| **`REPEAT` / `UNTIL`** | |
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

### REPEAT mapping

```
REPEAT                      while True:
    OUTPUT Count               print(Count)
    Count ← Count + 1          Count = Count + 1
UNTIL Count > 10           if Count > 10:
                                break
```

REPEAT requires a final condition. Reverse translation recognizes the specific Python pattern `while True:` with a trailing `if <condition>:
    break`. Nested REPEAT↔WHILE↔IF combinations are supported.

## Usage

```ts
import {
  translatePseudocodeToPython,
  translatePythonToPseudocode,
} from '@pseudopilot/translator';

const py = translatePseudocodeToPython(`
REPEAT
    OUTPUT Count
    Count ← Count + 1
UNTIL Count > 10
`);
```

## Architecture

See [`docs/language/TRANSLATION.md`](../../docs/language/TRANSLATION.md) and [ADR 0006](../../docs/adr/0006-canonical-ir-translation.md).

## Test

```bash
pnpm --filter @pseudopilot/translator test
```
