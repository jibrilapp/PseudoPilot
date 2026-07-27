# @pseudopilot/language-core

Cambridge pseudocode language core: lexer → parser → AST.

**Version:** `0.8.0`

## Supported (parser)

- `//` comments
- Assignment (`←` or `<-`)
- `INPUT` / `OUTPUT`
- `IF` / `THEN` / `ELSE IF` / `ELSE` / `ENDIF` (including nesting)
- `WHILE` / `[DO]` / `ENDWHILE`, `REPEAT` / `UNTIL`, `FOR` / `TO` / `[STEP]` / `NEXT`
- `CASE OF` / `OTHERWISE` / `ENDCASE`
- `PROCEDURE` / `ENDPROCEDURE`, `FUNCTION` / `RETURNS` / `ENDFUNCTION`
- Parameters, `DECLARE` locals/globals, `CALL`, `RETURN`, function `CallExpression`
- Arrays: `ARRAY[l:u] OF Type`, indexing `Name[i]` / `Name[i, j]`
- Files: `OPENFILE` / `READFILE` / `WRITEFILE` / `CLOSEFILE`, modes `READ|WRITE|APPEND`, `EOF(…)`
- Arithmetic, relational (`= <> < <= > >=`), and logical (`AND` `OR` `NOT`) expressions
- Literals: integer, real, string, char (`'A'`), boolean
- Identifiers (case-insensitive keywords)

Not yet (parser): `CONSTANT`, `BYREF`/`BYVAL`, `&` concatenation, DATE, OOP/Extended, many builtins.

> **Note:** Parsing DECLARE/files does not imply the translator lowers them yet. See `@pseudopilot/translator` and `docs/language/TRANSLATION.md`.

## Limits

`parse()` rejects sources larger than the default character budget (256 KiB) to protect browsers and CI. Pass `{ maxSourceChars }` to raise within the hard ceiling.

## Usage

```ts
import { parse } from '@pseudopilot/language-core';

const { ast, ok, diagnostics } = parse(`
Count ← 2 + 3 * 4
OUTPUT Count
`);
```

## Test

```bash
pnpm --filter @pseudopilot/language-core test
```
