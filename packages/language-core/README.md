# @pseudopilot/language-core

Cambridge pseudocode language core: lexer → parser → AST.

## Milestone (current)

Supported:

- `//` comments
- Assignment (`←` or `<-`)
- `INPUT` / `OUTPUT`
- `IF` / `THEN` / `ELSE IF` / `ELSE` / `ENDIF` (including nesting)
- `PROCEDURE` / `ENDPROCEDURE`, `FUNCTION` / `RETURNS` / `ENDFUNCTION`
- Parameters, `DECLARE` locals/globals, `CALL`, `RETURN`, function `CallExpression` (recursion-ready)
- Arrays: `ARRAY[l:u] OF Type`, indexing `Name[i]` / `Name[i, j]`
- Files: `OPENFILE` / `READFILE` / `WRITEFILE` / `CLOSEFILE`, modes `READ|WRITE|APPEND`, `EOF(…)`
- Arithmetic, relational (`= <> < <= > >=`), and logical (`AND` `OR` `NOT`) expressions
- Literals: integer, real, string, **char** (`'A'`), boolean
- Identifiers

Not yet: loops (`WHILE` / `FOR` / `REPEAT`).

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
