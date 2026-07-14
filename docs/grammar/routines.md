# Procedures & functions

```
procedureDecl → "PROCEDURE" Ident parameterList? NEWLINE* block "ENDPROCEDURE"
functionDecl  → "FUNCTION" Ident parameterList? "RETURNS" type NEWLINE* block "ENDFUNCTION"
parameterList → "(" (Ident ":" type ("," Ident ":" type)*)? ")"
declareStmt   → "DECLARE" Ident ("," Ident)* ":" type
callStmt      → "CALL" Ident ("(" args? ")")?
returnStmt    → "RETURN" expression
callExpr      → Ident "(" args? ")"   // primary expression
```

## Design notes

- **Parameters** typed with `: INTEGER` etc.
- **Locals** via `DECLARE` inside routine bodies (also allowed globally).
- **Return values** via `RETURN` in functions; `CallExpression` for `Result ← F(x)`.
- **Recursion** is not a special parse mode — a `CallExpression` / `CALL` may name the current routine; the interpreter will later stack frames.
- Nested `PROCEDURE`/`FUNCTION` declarations are rejected (`E_NESTED_ROUTINE`).
- `RETURN` inside `PROCEDURE` is rejected (`E_RETURN_IN_PROCEDURE`).
