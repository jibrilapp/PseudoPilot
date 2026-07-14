# Parser review notes (pre-IF)

## Hardening landed before IF

1. Shared `TokenCursor` — statement + Pratt parsers mutate one index.
2. `expectStatementEnd()` — line-oriented statements; blocks can relax this later inside `THEN`…`ENDIF`.
3. Trailing-comma / incomplete-expression errors with stable codes.
4. Lexer rejects `2x` and non-safe integers.
5. Expression terminators centralized (`isExpressionTerminator`) for upcoming `THEN`/`ELSE`.

## Still deferred (intentionally)

- Relational / logical operators (belong with IF)
- Block structure / indentation vs explicit END*
- Semantic analysis (undeclared vars) — separate pass
- String concatenation `&` (curriculum-dependent)
