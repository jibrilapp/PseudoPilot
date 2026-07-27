# Milestone 3 — Pseudocode parser (subset)

> **Historical scratchpad.** Current coverage lives in [`docs/language/PARSER_COVERAGE.md`](../language/PARSER_COVERAGE.md) and package READMEs. Do not treat this file as the supported dialect.

## Parsing strategy

**Hybrid:** recursive descent for statements + **Pratt** parsing for expressions.

## Milestone 3 grammar (supported)

```
program        → statement* EOF
statement      → comment? (assignment | inputStmt | outputStmt) NEWLINE?
assignment     → IDENTIFIER "←" expression
inputStmt      → "INPUT" IDENTIFIER
outputStmt     → "OUTPUT" expression ("," expression)*
expression     → Pratt: unary/binary arithmetic with parentheses
primary        → INTEGER | REAL | STRING | BOOLEAN | IDENTIFIER | "(" expression ")"
```

Comments (`// …`) are consumed by the lexer and do not appear in the AST.

Deferred: DECLARE, IF, loops, arrays, procedures, etc.
