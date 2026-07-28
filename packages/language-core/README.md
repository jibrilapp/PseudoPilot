# @pseudopilot/language-core

Cambridge pseudocode language core: lexer → parser → AST.

**Version:** `0.10.0`

## Supported (parser)

- `//` comments
- Assignment (`←` or `<-`)
- `INPUT` / `OUTPUT`
- `IF` / `THEN` / `ELSE IF` / `ELSE` / `ENDIF` (including nesting)
- `WHILE` / `[DO]` / `ENDWHILE`, `REPEAT` / `UNTIL`, `FOR` / `TO` / `[STEP]` / `NEXT`
- `CASE OF` / `OTHERWISE` / `ENDCASE`
- `PROCEDURE` / `ENDPROCEDURE`, `FUNCTION` / `RETURNS` / `ENDFUNCTION`
- Parameters, `DECLARE` locals/globals, **`CONSTANT` literal bindings**, `CALL`, `RETURN`, function `CallExpression`
- Arrays: `ARRAY[l:u] OF Type`, indexing `Name[i]` / `Name[i, j]`
- Files: `OPENFILE` / `READFILE` / `WRITEFILE` / `CLOSEFILE`, modes `READ|WRITE|APPEND`, `EOF(…)`
- Arithmetic, relational (`= <> < <= > >=`), and logical (`AND` `OR` `NOT`) expressions
- Literals: integer, real, string, char (`'A'`), boolean
- Identifiers (case-insensitive keywords)

Not yet (parser): `BYREF`/`BYVAL`, DATE, OOP/Extended, many Extended builtins.

> **Note:** Parsing DECLARE/CONSTANT/files does not imply every construct is lowered by the translator. See `@pseudopilot/translator` and `docs/language/TRANSLATION.md`.

## Limits

`parse()` rejects sources larger than the default character budget (256 KiB) to protect browsers and CI. Pass `{ maxSourceChars }` to raise within the hard ceiling.

## Usage

```ts
import { parse } from '@pseudopilot/language-core';

const { ast, ok, diagnostics } = parse(`
DECLARE Count : INTEGER
CONSTANT Limit = 10
Count ← Limit
OUTPUT Count
`);
```

## Test

```bash
pnpm --filter @pseudopilot/language-core test
```
