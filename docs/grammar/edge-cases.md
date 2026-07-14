# Edge-case charter

## Files

| Suite | Focus | Count | Status |
|-------|--------|------:|--------|
| `edge-if.test.ts` | IF / ELSE / ELSE IF | 25 | passing |
| `edge-routines.test.ts` | PROCEDURE / FUNCTION | 30 | passing |
| `edge-arrays-files.test.ts` | Arrays + files | 34 | passing |
| `edge-loops.test.ts` | WHILE / FOR / REPEAT | 26 | 20 known-red (`it.fails`), 6 passing rejects |

## Bugs found by edge suites

| Area | Case | Fix |
|------|------|-----|
| IF | Newline / EOL comment between condition and `THEN` | `skipNewlines()` before `THEN` |
| Routines | — | None |
| Arrays / files | — | None (34/34 passed as-is) |
| Loops | Not implemented | Charter via `it.fails` |
