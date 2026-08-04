# @pseudopilot/translator

Bidirectional **Cambridge 9618 pseudocode ↔ Python** translation via a canonical IR.

**Version:** `0.14.0` · **Subset id:** `v14-assign-io-expr-control-procedure-function-declare-check-builtins-files-type-class`

## Supported subset (current)

| Supported | Not supported |
| --- | --- |
| Assignment (`←` / `<-` / Python `=`) including `A[i]` / `A[i, j]` | BYREF / BYVAL |
| `INPUT` / `OUTPUT` (incl. indexed targets) | DATE / Extended beyond Cambridge Core |
| Control flow, PROCEDURE/FUNCTION, DECLARE/CONSTANT | RANDOM files / REWRITE |
| **Text file I/O** (`OPENFILE` / `READFILE` / `WRITEFILE` / `CLOSEFILE` / `EOF`) | General Python (`lambda`, `async`, `with`, `try`, comprehensions as stmts, …) |
| **`TYPE` / `ENDTYPE`** ↔ `@dataclass` (both directions) | |
| **`CLASS` / `ENDCLASS`** ↔ plain `class` (both directions, PseudoPilot emit shape) | |
| **Semantic check** via `@pseudopilot/checker` | |
| **Builtins:** LENGTH, LEFT, RIGHT, MID, LCASE, UCASE, INT, RAND | |
| **`&` string concatenation** | |
| Literals + arithmetic / relational / logical expressions | |

See [`docs/language/SEMANTICS.md`](../../docs/language/SEMANTICS.md) and [`docs/language/TRANSLATION.md`](../../docs/language/TRANSLATION.md).

### Builtin → Python mappings

| Cambridge | Python |
| --- | --- |
| `LENGTH(s)` | `len(s)` |
| `LEFT(s, n)` | `s[:n]` |
| `RIGHT(s, n)` | `s[-(n):]` (parens so `n+1` cannot become `-n+1`) |
| `MID(s, start, length)` | `s[(start)-1 : (start)-1+(length)]` (1-based) |
| `LCASE(s)` / `UCASE(s)` | `s.lower()` / `s.upper()` |
| `INT(x)` | `int(x)` (truncate toward zero) |
| `RAND(x)` | `random.random() * (x)` (+ `import random`) → REAL in `[0, x)` |
| `a & b` | `a + b` |

## Usage

```ts
import {
  translatePseudocodeToPython,
  translatePythonToPseudocode,
} from '@pseudopilot/translator';

const py = translatePseudocodeToPython(`
DECLARE Name : STRING
OUTPUT UCASE(LEFT(Name, 3)) & "!"
`);

const cam = translatePythonToPseudocode(py.code);
```

Pipeline: **parse → semantic check (default, Cambridge→Python) → lower → print**.  
Reverse: **Python subset parse → IR → Cambridge print**.

## Test

```bash
pnpm --filter @pseudopilot/translator test
```
