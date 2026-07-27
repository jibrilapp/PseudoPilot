# @pseudopilot/translator

Bidirectional **Cambridge 9618 pseudocode ↔ Python** translation via a canonical IR.

**Version:** `0.8.0` · **Subset id:** `v8-assign-io-expr-control-procedure-function`

## Supported subset (current)

| Supported | Not supported |
| --- | --- |
| Assignment (`←` / `<-` / Python `=`) including `A[i]` / `A[i, j]` | DECLARE, CONSTANT |
| `INPUT` / `OUTPUT` (incl. indexed targets) | BYREF / BYVAL |
| `IF` / `THEN` / `ELSE` / `ELSE IF` / `ENDIF` | File I/O |
| `WHILE` / `[DO]` / `ENDWHILE` | `&` concatenation |
| `REPEAT` / `UNTIL` | Builtins (`LENGTH`, `MID`, …) |
| `FOR` / `TO` / `[STEP]` / `NEXT` | DATE / OOP / Extended |
| `CASE OF` / `OTHERWISE` / `ENDCASE` | |
| `PROCEDURE` / `ENDPROCEDURE` / `CALL` | |
| `FUNCTION` / `RETURNS` / `ENDFUNCTION` / `RETURN` + expression calls | |
| Literals: integer, real, string, char, boolean | |
| Arithmetic / relational / logical expressions | |

### Notable mappings

- **FOR** inclusive bounds → Python `range(start, end±1 [, step])`
- **CASE OF \<expr\>** (Cambridge order) → Python `match` / `case`
- **PROCEDURE** → `def name(...):` (no return annotation)
- **FUNCTION** → `def name(...) -> type:` with `return`
- **REPEAT** → `while True:` + trailing `if condition: break`

### Limits

Public entrypoints reject oversized sources by default (`maxSourceChars`, default 256 KiB characters) to avoid browser freezes and DoS. Override via `TranslateOptions.maxSourceChars` (hard ceiling still applies).

## Usage

```ts
import {
  translatePseudocodeToPython,
  translatePythonToPseudocode,
} from '@pseudopilot/translator';

const py = translatePseudocodeToPython(`
FUNCTION Double(n : INTEGER) RETURNS INTEGER
    RETURN n * 2
ENDFUNCTION

OUTPUT Double(21)
`);
```

## Architecture

See [`docs/language/TRANSLATION.md`](../../docs/language/TRANSLATION.md) and [ADR 0006](../../docs/adr/0006-canonical-ir-translation.md).

## Test

```bash
pnpm --filter @pseudopilot/translator test
```
