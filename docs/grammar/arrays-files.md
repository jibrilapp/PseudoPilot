# Arrays & file handling

## Arrays

```
declare     → DECLARE Ident ("," Ident)* ":" typeRef
typeRef     → typeName | arrayType
arrayType   → "ARRAY" "[" dimension ("," dimension)* "]" "OF" typeName
dimension   → expression ":" expression

indexExpr   → Ident "[" expression ("," expression)* "]"
assignTarget→ Ident | indexExpr
```

Examples:

```
DECLARE Scores : ARRAY[1:10] OF INTEGER
DECLARE Grid : ARRAY[1:5, 1:5] OF REAL
Scores[1] ← 10
OUTPUT Grid[I, J]
INPUT Scores[3]
```

AST:

- `DeclareStatement.typeRef` is `TypeName | ArrayType`
- `ArrayType` holds `dimensions[]` + `elementType`
- `IndexExpression` is both an expression and an `AssignTarget`

## Files (Cambridge OPENFILE style)

```
open  → OPENFILE expression "FOR" ("READ"|"WRITE"|"APPEND")
read  → READFILE expression "," assignTarget
write → WRITEFILE expression "," expression
close → CLOSEFILE expression
eof   → "EOF" "(" expression ")"
```

Appending is opening with `FOR APPEND`, then using `WRITEFILE` (same AST node as write). The open mode distinguishes write vs append at runtime.

Examples:

```
OPENFILE "log.txt" FOR WRITE
WRITEFILE "log.txt", "hello"
CLOSEFILE "log.txt"

OPENFILE "log.txt" FOR APPEND
WRITEFILE "log.txt", "more"
CLOSEFILE "log.txt"

IF NOT EOF(Path) THEN
    READFILE Path, Line
ENDIF
```

AST:

- `OpenFileStatement` (`mode: READ | WRITE | APPEND`)
- `ReadFileStatement` / `WriteFileStatement` / `CloseFileStatement`
- `EofExpression` for `EOF(…)`
