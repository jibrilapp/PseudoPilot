# Cambridge 9618 builtins

Official builtin library supported by PseudoPilot.

Sources:

1. **Teacher guide** (2027–2029) §5.5 string functions, §5.6 numeric functions, §9.1 `EOF`
2. **Paper 2 exam insert** (character / numeric-string / DATE helpers) — shipped as Core so
   students can practice without loading a per-paper pack

PseudoPilot does **not** invent extra builtins beyond these sources (plus noted soft
extensions). See [`SPECIFICATION.md`](./SPECIFICATION.md) §4 and ADR 0005 (AI never invents
runtime).

## Coverage table

| Builtin | Kind | Source | Status | Notes |
| --- | --- | --- | --- | --- |
| `LENGTH(s)` | Function → INTEGER | Guide §5.5 | ✅ | Soft: also accepts CHAR |
| `RIGHT(s, x)` | Function → STRING | Guide §5.5 | ✅ | Soft: also accepts CHAR |
| `MID(s, x, y)` | Function → STRING | Guide §5.5 | ✅ | 1-based start `x`; soft CHAR |
| `LCASE(c)` | Function → CHAR/STRING | Guide §5.5 | ✅ | Guide: CHAR; soft STRING |
| `UCASE(c)` | Function → CHAR/STRING | Guide §5.5 | ✅ | Guide: CHAR; soft STRING |
| `&` | Operator | Guide §5.5 | ✅ | Concatenation (not a call) |
| `INT(x)` | Function → INTEGER | Guide §5.6 | ✅ | Truncate toward zero |
| `RAND(x)` | Function → REAL | Guide §5.6 | ✅ | `[0, x)` |
| `EOF(file)` | Function → BOOLEAN | Guide §9.1 | ✅ | Dedicated primary in grammar |
| `LEFT(s, x)` | Function → STRING | PseudoPilot Core / common insert | ✅ | **Not** in teacher-guide index |
| `ASC(c)` | Function → INTEGER | Paper 2 insert | ✅ | CHAR only |
| `CHR(x)` | Function → CHAR | Paper 2 insert | ✅ | Code point → character |
| `IS_NUM(s)` | Function → BOOLEAN | Paper 2 insert | ✅ | STRING or CHAR |
| `DAY` / `MONTH` / `YEAR` | Function → INTEGER | Paper 2 DATE insert | ✅ | |
| `DAYINDEX` | Function → INTEGER | Paper 2 DATE insert | ✅ | Sunday = 1 … Saturday = 7 |
| `SETDATE(d, m, y)` | Function → DATE | Paper 2 DATE insert | ✅ | |
| `TODAY()` | Function → DATE | Paper 2 DATE insert | ✅ | |

Operators `DIV` / `MOD` are **not** builtins — they are binary operators.

## Undefined / documented behaviour

| Topic | Policy |
| --- | --- |
| `IS_NUM` empty / whitespace | `FALSE` (not specified by Cambridge; empty is not a number) |
| `IS_NUM` exponents / hex | `FALSE` — only optional sign + decimal digits (matches insert example `-12.36`) |
| `CHR` out of Unicode range | Runtime `R_BUILTIN` error |
| `ASC` empty CHAR | Runtime `R_BUILTIN` error (should not arise from well-formed CHAR literals) |
| `MID` start `< 1` | Runtime `R_BUILTIN` |
| `RAND` non-positive | Runtime `R_BUILTIN` |
| `LEFT` vs guide | Kept as PseudoPilot Core for teaching convenience |

## Diagnostics

Checker codes (existing pipeline):

- `C_BUILTIN_ARG_COUNT` — wrong arity
- `C_BUILTIN_ARG_TYPE` — wrong argument types
- `C_DUP_FUNCTION` — redefining a soft-reserved builtin name
- Procedures vs functions: builtins are **functions** (expression calls only; not `CALL`)

## Translation

| Cambridge | Python |
| --- | --- |
| `LENGTH(s)` | `len(s)` |
| `LEFT(s, n)` | `s[:n]` |
| `RIGHT(s, n)` | `s[-n:]` / `s[-(expr):]` |
| `MID(s, x, y)` | `s[(x)-1:(x)-1+(y)]` |
| `LCASE` / `UCASE` | `.lower()` / `.upper()` |
| `INT(x)` | `int(x)` |
| `RAND(x)` | `random.random() * (x)` |
| `ASC(c)` | `ord(c)` |
| `CHR(x)` | `chr(x)` |
| `IS_NUM(s)` | `_pp_is_num(s)` helper |
| DATE helpers | `datetime.date` attrs / ctor / `date.today()` |

Reverse recovers those Python forms to Cambridge names when possible.

## Remaining unsupported

- **Per-paper one-off inserts** not in the standard character/DATE pack (e.g. hypothetical
  `TO_UPPER` renamed variants) — require a future exam pack registry.
- **BYREF** procedures such as exam sample `SWAP` — language feature, not a builtin library
  entry.
- Random-file I/O (`SEEK`, `GETRECORD`, `PUTRECORD`) — see [`FILE_IO.md`](./FILE_IO.md); not library builtins
  library.

## Pipeline

Registry: `packages/language-core/src/builtins/registry.ts`  
Runtime: `packages/interpreter/src/builtins.ts`  
Python emit/reverse: `packages/translator/src/builtins/emit.ts`  
LS / Monaco / AI Coach consume the same registry (or name list) — no duplicate truth.
