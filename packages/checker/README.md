# @pseudopilot/checker

Cambridge 9618 **semantic checker**: scopes, symbols, types, and diagnostics over a `language-core` AST.

**Version:** `0.10.0`

## Pipeline

```
Lexer → Parser → AST → Semantic Checker → IR → Translator → Interpreter
```

## Usage

```ts
import { parse } from '@pseudopilot/language-core';
import { check } from '@pseudopilot/checker';

const { ast } = parse(`
DECLARE Count : INTEGER
Count ← 1
OUTPUT Count
`);

const { ok, diagnostics, globalSymbols } = check(ast);
```

## Docs

See [`docs/language/SEMANTICS.md`](../../docs/language/SEMANTICS.md).

## Test

```bash
pnpm --filter @pseudopilot/checker test
```
