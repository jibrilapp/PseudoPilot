# IF / ELSE / ELSE IF grammar notes

```
ifStmt     → "IF" expression "THEN" NEWLINE* block
             ("ELSE" "IF" expression "THEN" NEWLINE* block)*
             ("ELSE" NEWLINE* block)?
             "ENDIF"

block      → statement*
```

## Disambiguation

`ELSE IF` (elseif clause) requires `IF` immediately after `ELSE` with **no newline** between.

```
ELSE IF x = 1 THEN    → else-if clause (shared ENDIF)
ELSE
    IF x = 1 THEN     → nested IF inside else (own ENDIF)
    ENDIF
```

## AST

`IfStatement` holds `elseIfClauses[]` plus optional `alternate` (final ELSE).
Not desugared into nested IFs — one surface `ENDIF` maps to one AST node.
