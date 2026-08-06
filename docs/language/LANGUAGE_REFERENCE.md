# Language reference (quick index)

Student-facing map of PseudoPilot Cambridge 9618 support. Detailed rules live in:

- [`SPECIFICATION.md`](./SPECIFICATION.md) — normative dialect
- [`BUILTINS.md`](./BUILTINS.md) — builtin library audit & coverage
- [`SEMANTICS.md`](./SEMANTICS.md) — checker rules
- [`EBNF.md`](./EBNF.md) — grammar
- [`OBJECT_ORIENTED_PROGRAMMING.md`](./OBJECT_ORIENTED_PROGRAMMING.md) — CLASS
- [`FILE_IO.md`](./FILE_IO.md) — text + random files

## Types

`INTEGER`, `REAL`, `STRING`, `BOOLEAN`, `CHAR`, `DATE`, `ARRAY[…] OF T`, `TYPE` (record / enum / pointer / SET), `CLASS`.

## Builtins (summary)

Guide: `LENGTH`, `RIGHT`, `MID`, `LCASE`, `UCASE`, `INT`, `RAND`, `EOF`, `&`  
Insert: `ASC`, `CHR`, `IS_NUM`, `DAY`, `MONTH`, `YEAR`, `DAYINDEX`, `SETDATE`, `TODAY`  
PseudoPilot Core: `LEFT`  

Full table: [`BUILTINS.md`](./BUILTINS.md).

## Control & routines

`IF` / `CASE` / `FOR` / `WHILE` / `REPEAT`, `PROCEDURE` / `FUNCTION` / `CALL` / `RETURN`,
text files (`OPENFILE` / `READFILE` / `WRITEFILE` / `CLOSEFILE` / `EOF`),
random files (`OPENFILE FOR RANDOM` / `SEEK` / `GETRECORD` / `PUTRECORD`),
OOP `CLASS` / `NEW` / `INHERITS` / `SUPER`.
