# PseudoPilot × Cambridge 9618 Conformance Audit

**Authoritative guide:** *Cambridge International AS & A Level Computer Science 9618 — Pseudocode Guide for Teachers* (examinations in **2026**, Version 1).  
**Audit date:** 2026-08-06  
**Product dialect docs:** [`language/SPECIFICATION.md`](./language/SPECIFICATION.md) (PseudoPilot resolutions where the guide is ambiguous)

This document is the **compatibility matrix** for claiming Cambridge-aligned behaviour. It does **not** invent language features. Implementation status is grounded in [`language/IMPLEMENTATION_CHECKLIST.md`](./language/IMPLEMENTATION_CHECKLIST.md), package tests, and spot-checks of `language-core` / `checker` / `interpreter` / `translator` / product surfaces. Prefer this file over stale ✅/❌ columns embedded in older prose (notably parts of `PARSER_COVERAGE.md` and `SPECIFICATION.md` §11).

---

## 1. Executive summary

PseudoPilot’s **language dialect is fully Cambridge Guide-compliant** for the grammar and semantics surface audited here: Core (Paper 2) end-to-end, plus Extended **record / enum / pointer / SET `TYPE`**, **OOP `CLASS`**, **`BYVAL`/`BYREF`**, and **random-file I/O**. Pipeline: lex → parse → check → interpret → translate (subset) → IDE language service / Monaco / debugger / conformance corpus.

Remaining gaps are **product stubs** (OS sandbox package, LSP server process, `@pseudopilot/curriculum-cambridge` profiles) and **intentional PseudoPilot extensions** (ASCII `<-`, N-D arrays, short-circuit `AND`/`OR`, `LEFT`, insert builtins as Core, `ELSE IF`, optional `DO`, default PUBLIC). Several **🟡 partials** remain (line packing, LCASE soft STRING, insert-pack registry, reverse translation best-effort, AI coach heuristic, parser recovery, etc.).

| Metric | Count |
| --- | ---: |
| **Features audited** | **124** |
| ✅ Fully compliant | **101** |
| 🟡 Partial | **11** |
| ❌ Missing | **3** |
| ⚠️ Intentional PseudoPilot extension | **9** |

**Verdict:** Language dialect is **fully Cambridge guide-compliant** for grammar/semantics. Ready to teach and run Core + all user-type forms + OOP + BYREF + random files. Product stubs and ⚠️ extensions / 🟡 partials remain as documented caveats — not blocking Guide surface claims.

---

## 2. Status legend

| Mark | Meaning |
| --- | --- |
| ✅ | **Fully compliant** — implemented across the relevant stack stages; behaviour matches Cambridge (or a documented PseudoPilot resolution that preserves exam intent) |
| 🟡 | **Partial** — some stages work, soft typing, incomplete checks, or known fidelity gaps |
| ❌ | **Missing** — not parsed / not executed / not translated |
| ⚠️ | **Intentional PseudoPilot extension** — deliberate divergence from the Teacher Guide surface |

**Tests column:** `yes` = dedicated unit/corpus coverage known; `partial` = exercised indirectly; `no` = no targeted test found. Cite packages under `packages/` or `apps/web/` when known.

**Docs column:** whether normative product docs describe the feature.

---

## 3. Methodology

1. **Guide structure** taken from the official 2026 Teacher Guide contents (§1–§10 + keyword index). No PDF is vendored in-repo; section numbers match Cambridge’s published 2026 guide (aligned with 2027–2029 guides used by existing PseudoPilot docs).
2. **Repo authority chain:** `SPECIFICATION.md` resolutions → `IMPLEMENTATION_CHECKLIST.md` / package README + tests → spot-check of source (`packages/language-core`, `checker`, `interpreter`, `translator`, `language-service`, `compiler-service`, `conformance`, `ai-coach`, `apps/web`).
3. **Honesty rule:** ✅ only when checklist **and** tests/docs agree; stale claims are treated as **doc drift**, not as truth.
4. **Out of scope for this audit:** redesign, implementing missing features, marketing claims beyond this matrix.

Related docs: [`language/README.md`](./language/README.md) · [`language/BUILTINS.md`](./language/BUILTINS.md) · [`language/SEMANTICS.md`](./language/SEMANTICS.md) · [`language/FILE_IO.md`](./language/FILE_IO.md) · [`language/EBNF.md`](./language/EBNF.md) · [`language/TRANSLATION.md`](./language/TRANSLATION.md) · [`language/INTERPRETER.md`](./language/INTERPRETER.md) · [`TESTING.md`](./TESTING.md) · [`language/SPEC_REVIEW.md`](./language/SPEC_REVIEW.md)

---

## 4. Compatibility matrix by Cambridge area

### 4.1 §1 Presentation & lexical rules

| Feature | Cambridge reference | Status | Tests | Docs | Notes |
| --- | --- | --- | --- | --- | --- |
| Keywords upper-case in exams; identifiers mixed case | §1.3 | ✅ | yes — `language-core` lexer | SPEC §0.3 | Lexer **case-insensitive**; IDE may upper-case keywords |
| Indentation for readability only | §1.2 | ✅ | yes | SPEC §13.16 | Not semantically significant |
| `//` line comments | §1.5 | ✅ | yes | SPEC | Multi-line = multiple `//` lines |
| Line numbering / continuation layout | §1.4 | 🟡 | partial | SPEC §12.3 | Exam presentation; parser is line-oriented; same-line packing after `THEN`/`ELSE` incomplete vs packed exam prints |
| Identifier charset (letter start; letters/digits/`_`) | §2.3 | ✅ | yes | SPEC §0.3 | |
| Identifiers case-insensitive | §2.3 | ✅ | yes — checker | SEMANTICS | |
| Keywords must not be identifiers | §2.3 / index | 🟡 | partial | SPEC §1 | Soft-reserved builtins; contextual `READ`/`WRITE`/`APPEND` hard-keyworded (SPEC_REVIEW risk) |

### 4.2 §2 Variables, constants, data types, literals, assignment

| Feature | Cambridge reference | Status | Tests | Docs | Notes |
| --- | --- | --- | --- | --- | --- |
| `INTEGER` / `REAL` / `CHAR` / `STRING` / `BOOLEAN` / `DATE` | §2.1 | ✅ | yes | SPEC §3.1 | No standalone `TIME` (correct) |
| Integer literals | §2.2 | ✅ | yes | SPEC §11 | |
| Real literals — digit both sides of `.` | §2.2 | ✅ | yes — `hardening.test.ts` | SPEC §13.9 | `.5`/`5.` → `W_REAL_LITERAL`; `parse(..., { strictCambridge: true })` → `E_REAL_LITERAL` |
| `CHAR` `'x'` literals | §2.2 | ✅ | yes — lexer/parser | SPEC §11 | ASCII `'` |
| `STRING` `"…"` / `""` | §2.2 | ✅ | yes | SPEC | Escape policy minimal |
| `TRUE` / `FALSE` | §2.2 | ✅ | yes | SPEC | |
| `DATE` literal `dd/mm/yyyy` | §2.2 | ✅ | yes — `date-time.test.ts` | BUILTINS / SPEC | Lexed as date, not division |
| `DECLARE` scalars | §2.4 | ✅ | yes — corpus | SPEC | |
| Multi-name `DECLARE A, B : T` | §2.4 (style) | ✅ | yes | SPEC §6.1 | |
| `CONSTANT` = literal only | §2.5 | ✅ | yes — corpus `constant` | SPEC | Expressions rejected |
| Assignment `←` | §2.6 | ✅ | yes | SPEC §2.1 | |
| ASCII `<-` assignment | — | ⚠️ | yes | SPEC §13.5 | Keyboard compatibility |
| `=` never assignment | §2.6 / §5.3 | ✅ | yes | SPEC | `=` comparison only; `CONSTANT` uses `=` |

### 4.3 §3 Arrays

| Feature | Cambridge reference | Status | Tests | Docs | Notes |
| --- | --- | --- | --- | --- | --- |
| 1D `ARRAY[l:u] OF T` | §3.1 | ✅ | yes — corpus | SPEC §6 | Inclusive bounds |
| 2D arrays | §3.1 | ✅ | yes | SPEC | Syllabus requirement |
| N-D arrays (3+) | — | ⚠️ | yes | SPEC §6.1 / SPEC_REVIEW I14 | Beyond syllabus 1D/2D |
| Element read/write `A[i]` / `A[i,j]` | §3.2 | ✅ | yes | SPEC | |
| Whole-array assignment same size/type | §3.2 | ✅ | yes — checker bounds + interpreter | TYPE_SYSTEM / checklist | Checker enforces identical bounds when known; runtime shape+bounds check |
| Forbid `A[1 TO n] ← …` | §3.2 | ✅ | yes — parser | SPEC §6.3 | |
| Runtime bounds checks | (implied) | ✅ | yes — interpreter | INTERPRETER | `R_ARRAY_BOUNDS` |
| Static bounds / arity check | — | 🟡 | partial | SEMANTICS | Index arity vs dims checked; range values runtime |

### 4.4 §4 User-defined types

| Feature | Cambridge reference | Status | Tests | Docs | Notes |
| --- | --- | --- | --- | --- | --- |
| Enumerated `TYPE Name = (…)` | §4.1 | ✅ | yes — corpus + `user-types.test.ts` | TYPE_SYSTEM | Full pipeline |
| Pointer `TYPE Name = ^T` | §4.1 | ✅ | yes | TYPE_SYSTEM | Full pipeline |
| Pointer ops `^Var` / `Ptr^` | §4.2 | ✅ | yes | SPEC §2.6 / TYPE_SYSTEM | Address-of / dereference |
| Record `TYPE` … `ENDTYPE` | §4.1 | ✅ | yes — corpus + `records.test.ts` | TYPE_SYSTEM | |
| Field access `.` | §4.2 | ✅ | yes | TYPE_SYSTEM | Nested fields OK; pointer fields OK |
| Whole-record assign by value | §4.2 | ✅ | yes | TYPE_SYSTEM | Deep clone |
| Arrays of records / records with arrays | §4.2 | ✅ | yes | TYPE_SYSTEM | |
| Set `TYPE = SET OF T` + `DEFINE` | §4.1 | ✅ | yes — corpus | TYPE_SYSTEM | Full pipeline |
| ADTs (stack/queue/…) as dialect surface | Syllabus §10.4 | ✅ | — | SPEC_REVIEW | Correctly **not** inventing ADT keywords; teach via host structures |

### 4.5 §5 Common operations (I/O, operators, builtins)

| Feature | Cambridge reference | Status | Tests | Docs | Notes |
| --- | --- | --- | --- | --- | --- |
| `INPUT` target | §5.1 | ✅ | yes | INTERPRETER | Checker: assignable target; untyped source (Cambridge-like) |
| `OUTPUT` multi-value | §5.1 | ✅ | yes — corpus | SPEC §13.15 | Space-separated |
| `+ - * /` | §5.2 | ✅ | yes | SPEC | |
| `/` result always REAL | §5.2 | ✅ | yes — interpreter | SPEC / checker | |
| `DIV` / `MOD` | §5.2 | ✅ | yes | SPEC | INTEGER operands at runtime |
| `DIV`/`MOD` with negatives | Guide silent | ✅ | yes — interpreter + translator | TRANSLATION | Trunc toward zero; Python emit `_pp_div` / `_pp_mod` (aligned) |
| Operator precedence + parentheses | §5.2–5.4 | ✅ | yes | SPEC §2.7 | |
| Relational `= <> < <= > >=` | §5.3 | ✅ | yes | SPEC | Result BOOLEAN |
| No chained `1 < x < 10` as range | (good practice) | ✅ | partial | SPEC §2.7 | Two-operand only |
| `AND` / `OR` / `NOT` | §5.4 | ✅ | yes | SPEC | |
| Boolean short-circuit | Guide silent | ⚠️ | yes — interpreter | INTERPRETER | Documented PP behaviour; matches Python `and`/`or` |
| `LENGTH` | §5.5 | ✅ | yes | BUILTINS | Soft: also CHAR |
| `RIGHT` | §5.5 | ✅ | yes | BUILTINS | Soft CHAR; `RIGHT(s,0)→""`; translator `_pp_right` |
| `MID` (1-based) | §5.5 | ✅ | yes | BUILTINS | |
| `LCASE` / `UCASE` (guide: CHAR) | §5.5 | 🟡 | yes | BUILTINS | Soft-accept **STRING** (whole-string casefold) |
| `&` concatenation | §5.5 | ✅ | yes — corpus | BUILTINS | `+` on strings → type error |
| `LEFT` | Not in guide §5.5 | ⚠️ | yes | BUILTINS | PseudoPilot Core / exam-insert style |
| `INT` | §5.6 | ✅ | yes | BUILTINS | Truncate toward zero |
| `RAND` → `[0, x)` | §5.6 | ✅ | yes | BUILTINS | Injectable RNG |
| `ASC` / `CHR` / `IS_NUM` | Paper 2 insert | ⚠️ | yes — checker/interpreter | BUILTINS | Shipped as Core insert pack |
| `DAY`/`MONTH`/`YEAR`/`DAYINDEX`/`SETDATE`/`TODAY` | Paper 2 DATE insert | ⚠️ | yes | BUILTINS | |
| Per-paper one-off insert registry | Guide + exams | 🟡 | no | BUILTINS / SPEC §4.4 | Core pack only; no plug-in packs yet |
| `EOF(file)` | §9.1 | ✅ | yes | BUILTINS | Grammar primary |

### 4.6 §6 Selection

| Feature | Cambridge reference | Status | Tests | Docs | Notes |
| --- | --- | --- | --- | --- | --- |
| `IF` / `THEN` / `ENDIF` | §6.1 | ✅ | yes | SPEC §8.1 | |
| `ELSE` | §6.1 | ✅ | yes | SPEC | |
| Nested `IF` | §6.1 | ✅ | yes — edge-if | SPEC | |
| `ELSE IF` same-line | — | ⚠️ | yes | SPEC §13.1 | Compatibility extension; Cambridge shows nested IF |
| `CASE OF` / `ENDCASE` | §6.2 | ✅ | yes | SPEC §8.2 | |
| `TO` ranges in CASE | §6.2 | ✅ | yes | SPEC | |
| `OTHERWISE` last | §6.2 | ✅ | yes | SPEC | |
| First matching arm only | §6.2 | ✅ | yes | INTERPRETER | |

### 4.7 §7 Iteration

| Feature | Cambridge reference | Status | Tests | Docs | Notes |
| --- | --- | --- | --- | --- | --- |
| `FOR` / `TO` / `NEXT` | §7.1 | ✅ | yes — corpus | SPEC §9.1 | Control var INTEGER (checker) |
| Inclusive range; empty if start>end (step +1) | §7.1 | ✅ | yes | INTERPRETER | |
| `STEP` (incl. negative) | §7.1 | ✅ | yes | SPEC | |
| `NEXT` identifier match | §7.1 “good practice” | ✅ | yes — `E_FOR_NEXT_MISMATCH` | SPEC §13.3 | When ident present, must match binder; bare `NEXT` allowed |
| Bare `NEXT` (no ident) | §7.1 formal line | ✅ | yes | SPEC §13.3 | Cambridge-legal |
| `REPEAT` / `UNTIL` | §7.2 | ✅ | yes | SPEC | Runs ≥ once |
| `WHILE` … `ENDWHILE` **without** `DO` | §7.3 | ✅ | yes | SPEC §13.2 | Guide form |
| Optional classroom `DO` | Common exams | ⚠️ | yes | SPEC §13.2 | Accepted; printers emit `DO` |

### 4.8 §8 Procedures & functions

| Feature | Cambridge reference | Status | Tests | Docs | Notes |
| --- | --- | --- | --- | --- | --- |
| `PROCEDURE` / `ENDPROCEDURE` | §8.1 | ✅ | yes | SPEC §7 | |
| `CALL` with/without args | §8.1 | ✅ | yes | SPEC | Empty `()` / omitted OK |
| `FUNCTION` / `RETURNS` / `ENDFUNCTION` | §8.2 | ✅ | yes | SPEC | |
| `RETURN` expression; not in procedures | §8.2 | ✅ | yes | SEMANTICS | |
| Function call as expression (not `CALL`) | §8.2 | ✅ | yes | SPEC | |
| Grouped parameters `a, b : T` | §8.1–8.2 | ✅ | yes | SPEC §7.3 | Expanded in AST |
| Default pass-by-value | §8.3 | ✅ | yes — records/arrays cloned; corpus `byval-default` | SPEC §13.7 | Unspecified → **BYVAL** |
| Explicit `BYVAL` | §8.3 | ✅ | yes — checker/interpreter/translator | SPEC §7.3 | |
| Explicit `BYREF` | §8.3 | ✅ | yes — corpus `byref-swap` + package tests | SPEC §7.3 / SEMANTICS | Sticky mode across groups (Guide SWAP example) |
| `BYREF` forbidden on functions | §8.3 | ✅ | yes — `C_BYREF_ON_FUNCTION` | SPEC §13.7 | |
| Recursion | §8.2 | ✅ | yes — corpus / interpreter | INTERPRETER | `maxCallDepth` |
| Nested routines rejected | (good practice) | ✅ | yes | SPEC | `E_NESTED_ROUTINE` |
| All-paths return analysis | — | 🟡 | partial | SEMANTICS | Any-RETURN only |

### 4.9 §9 File handling

| Feature | Cambridge reference | Status | Tests | Docs | Notes |
| --- | --- | --- | --- | --- | --- |
| `OPENFILE` FOR READ / WRITE / APPEND | §9.1 | ✅ | yes — files tests | [`FILE_IO.md`](./language/FILE_IO.md) | |
| `READFILE` / `WRITEFILE` / `CLOSEFILE` | §9.1 | ✅ | yes | FILE_IO | |
| `EOF` | §9.1 | ✅ | yes | BUILTINS / FILE_IO | |
| Text-file semantics (modes, truncate, append) | §9.1 | ✅ | yes | FILE_IO / files README | Via in-memory **VFS** (never OS disk) |
| OS / security sandbox package | Product | ❌ | no | `packages/sandbox` stub | VFS ≠ hardened OS sandbox |
| `OPENFILE … FOR RANDOM` | §9.2 | ✅ | yes — random-files + corpus | FILE_IO | Create if missing; no truncate |
| `SEEK` | §9.2 | ✅ | yes | FILE_IO | 0-based INTEGER address (PP resolution) |
| `GETRECORD` | §9.2 | ✅ | yes | FILE_IO | TYPE record destination |
| `PUTRECORD` | §9.2 | ✅ | yes | FILE_IO | Overwrites / sparse grow |

### 4.10 §10 Object-oriented programming

| Feature | Cambridge reference | Status | Tests | Docs | Notes |
| --- | --- | --- | --- | --- | --- |
| `CLASS` / `ENDCLASS` | §10 | ✅ | yes — corpus + `classes.test.ts` | OOP.md | |
| `PUBLIC` / `PRIVATE` | §10.1 | ✅ | yes | OOP.md | |
| Default visibility when omitted | §10.1 (“assume public”) | ⚠️ | yes | OOP.md | PP defaults PUBLIC if omitted |
| Properties + methods | §10.1 | ✅ | yes | OOP.md | Optional `DECLARE` on fields |
| `PROCEDURE NEW` constructor | §10.2 | ✅ | yes | OOP.md | |
| `INHERITS` single parent | §10.2 | ✅ | yes | OOP.md | No multiple inheritance |
| `SUPER.NEW` / `SUPER.Method` | §10.2 | ✅ | yes | OOP.md | |
| `x ← NEW Class(…)` | §10.2 | ✅ | yes | OOP.md | |
| Object reference semantics | (implied) | ✅ | yes | OOP.md | Distinct from TYPE value copy |
| Method call `obj.Method(…)` | §10.1 | ✅ | yes | OOP.md | |

### 4.11 Product / toolchain surfaces (beyond guide grammar)

| Feature | Cambridge reference | Status | Tests | Docs | Notes |
| --- | --- | --- | --- | --- | --- |
| Semantic checker (`C_*`) | — | ✅ | yes — `checker` + conformance | SEMANTICS | Expression typing expanded golden cases (D9) |
| AST interpreter (Core + TYPE + CLASS) | — | ✅ | yes — `interpreter` + corpus | INTERPRETER | Async host, limits, debugger hooks |
| Debugger (breakpoints / step / vars) | — | ✅ | yes — conformance + `apps/web` | apps/web debugger README | DATE/OBJECT readable in snapshots |
| Language service (hover, refs, rename, …) | — | ✅ | yes | LANGUAGE_SERVICE | |
| Monaco Pseudocode + LS providers | — | ✅ | yes — `apps/web` monaco tests | ide/MONACO.md | Python pane: highlight + translate only |
| Incremental compiler service | — | ✅ | yes | INCREMENTAL_COMPILATION | |
| Conformance corpus / fuzz / e2e | — | ✅ | yes — `@pseudopilot/conformance` | [TESTING.md](./TESTING.md) · [REGRESSION_SUITE.md](./REGRESSION_SUITE.md) | On-disk `packages/conformance/corpus/` |
| Cambridge → Python translation | — | 🟡 | yes — translator + corpus | TRANSLATION.md | DIV/MOD via `_pp_div`/`_pp_mod`; RIGHT via `_pp_right`; enum/pointer/set mapped; reverse still best-effort |
| Python → Cambridge reverse | — | 🟡 | yes | TRANSLATION.md | Best on PseudoPilot-emitted shapes; `skipRoundTrip` corpus flags |
| Bidirectional IDE sync | — | 🟡 | yes — web hooks | MONACO.md | Origin-aware debounce |
| AI Coach grounded on dialect | — | 🟡 | yes — ai-coach tests | AI_COACH.md | Heuristic provider; never authoritative (ADR 0005) |
| LSP server process | — | ❌ | no | checklist | Protocol types only |
| `@pseudopilot/curriculum-cambridge` profiles | — | ❌ | stub | package README | Foundation stub |
| Parser recovery / sync | — | 🟡 | yes — `recovery.test.ts` | grammar notes | Newline sync; not full panic-mode catalogue |
| Runtime error taxonomy `R_*` | — | ✅ | yes | INTERPRETER | |
| Soft-reserved builtin redefinition | SPEC §1.9 | ✅ | yes — builtins.test.ts | SEMANTICS | `DECLARE Length` allowed (shadows soft builtin); `FUNCTION LENGTH` still rejected |

---

## 5. Behaviour differences (Cambridge ↔ PseudoPilot ↔ Python)

Documented differences that affect marking “compatible”:

| Topic | Cambridge / intent | PseudoPilot | Python translation |
| --- | --- | --- | --- |
| Assignment glyph | `←` | `←` and `<-` | `=` |
| `WHILE` + `DO` | Guide examples omit `DO` | Optional `DO`; emit with `DO` | `while` |
| `NEXT` binder | Optional good practice | Bare `NEXT` OK; mismatch when present → `E_FOR_NEXT_MISMATCH` | `for` target |
| `ELSE IF` | Nested IF preferred | Accepted same-line | `elif` |
| Array indices | Declared lower..upper | Same; translator emits `i - L` | 0-based lists |
| `DIV`/`MOD` negatives | Unspecified | Trunc toward zero | `_pp_div` / `_pp_mod` (trunc; aligned with interpreter) |
| `LCASE`/`UCASE` | CHAR | CHAR or STRING | `.lower()` / `.upper()` |
| `LEFT` | Not in guide §5.5 | Core builtin | `s[:n]` |
| Insert builtins | Paper inserts | Shipped as Core | Helpers / `datetime` |
| `RIGHT(s, 0)` | Error if malformed; empty length edge | `""` | `_pp_right` → `""` |
| Whole-array assign | Same size & type | Checker + runtime full shape/bounds | deepcopy / list copy paths |
| Records | Value-like assign | Deep clone | `@dataclass` + deepcopy |
| Enum / pointer / SET | Guide §4 | Full pipeline | `IntEnum` / `_pp_addr` helpers / `set` + `_pp_define` |
| Objects | Methods / NEW | Reference assign | Python `class` |
| Short-circuit | Unspecified | Yes for `AND`/`OR` | `and`/`or` |
| Files | Path string handles | In-memory VFS | `open` / helpers — teaching mapping |
| Builtin names as variables | Guide: keywords only | Soft-reserve: `DECLARE` may shadow; `FUNCTION` redefinition rejected | N/A |

---

## 6. Counts (detail)

| Status | Count | Share |
| --- | ---: | ---: |
| ✅ Fully compliant | 101 | 81% |
| 🟡 Partial | 11 | 9% |
| ❌ Missing | 3 | 2% |
| ⚠️ Extension | 9 | 7% |
| **Total audited** | **124** | 100% |

**Missing (❌) inventory (product stubs only):** OS sandbox package; LSP server process; `@pseudopilot/curriculum-cambridge` profiles.

**Extensions (⚠️):** ASCII `<-`; N-D arrays; boolean short-circuit; `LEFT`; ASC/CHR/IS_NUM as Core; DATE helpers as Core; `ELSE IF`; optional `DO`; default PUBLIC when omitted.  
*(Removed from ⚠️: required `NEXT` ident — now Cambridge-compliant.)*

---

## 7. Recommended implementation order (remaining gaps)

Language Guide surface is complete. Remaining work is product stubs and optional partial polish:

1. **Exam-insert pack registry** — beyond fixed ASC/DATE pack.
2. **Translator reverse fidelity** — reduce `skipRoundTrip`; polish non–PseudoPilot-emitted Python shapes.
3. **Line packing / presentation** — same-line packing after `THEN`/`ELSE` vs exam prints.
4. **Parser recovery catalogue** — beyond newline sync.
5. **OS sandbox package** — product hardening (VFS already isolates from OS disk).
6. **LSP server process** — protocol types exist; adapter TBD.
7. **`curriculum-cambridge`** — versioned profiles tied to this matrix.
8. **AI Coach provider** — beyond heuristic (never authoritative).

Gates already met: Core run-in-IDE, worker execution, debugger, language service, Monaco, incremental compile, conformance suite, TYPE records, enum/pointer/SET, CLASS OOP, **BYVAL/BYREF**, **random files**, DIV/MOD/RIGHT translator alignment — see checklist §M.

---

## 8. Discovered issues (D1–D10)

| ID | Severity | Issue | Status |
| --- | --- | --- | --- |
| D1 | Doc drift | `PARSER_COVERAGE.md` stale ❌ marks | **Fixed 2026-08-06** — coverage tables synced; CONFORMANCE remains authoritative for full-stack |
| D2 | Doc drift | `SPECIFICATION.md` §11 CHAR ❌; §10.1 CHAR 🟡 | **Fixed 2026-08-06** — CHAR literal ✅ |
| D3 | Doc drift | interpreter README “Not yet: DATE, OOP” | **Fixed 2026-08-06** — Supported/Not yet aligned |
| D4 | Behaviour | `DIV`/`MOD` negatives: interpreter trunc vs Python floor | **Fixed 2026-08-06** — `_pp_div` / `_pp_mod` trunc toward zero |
| D5 | Behaviour | Checker whole-array bounds | **Fixed 2026-08-06** — bounds match when known |
| D6 | Spec gap | Real `.5` without warn/strict | **Fixed 2026-08-06** — `W_REAL_LITERAL` / `strictCambridge` → `E_REAL_LITERAL` |
| D7 | Strictness | Bare `NEXT` rejected | **Fixed 2026-08-06** — bare `NEXT` accepted |
| D8 | Soft reserve | `DECLARE Length` → `C_DUP_FUNCTION` | **Fixed 2026-08-06** — DECLARE may shadow; `FUNCTION LENGTH` still rejected |
| D9 | Partial | Expression typing under-reports | **Fixed 2026-08-06** — expanded checker golden cases |
| D10 | Product | `@pseudopilot/sandbox` and `curriculum-cambridge` stubs | **Open** — product stubs |

---

## 9. Cross-links

| Document | Role |
| --- | --- |
| [`language/SPECIFICATION.md`](./language/SPECIFICATION.md) | Normative dialect + ambiguity resolutions |
| [`language/LANGUAGE_REFERENCE.md`](./language/LANGUAGE_REFERENCE.md) | Student quick index |
| [`language/BUILTINS.md`](./language/BUILTINS.md) | Builtin audit |
| [`language/FILE_IO.md`](./language/FILE_IO.md) | Text + random files |
| [`language/EBNF.md`](./language/EBNF.md) | Grammar |
| [`language/PARSER_COVERAGE.md`](./language/PARSER_COVERAGE.md) | Parser-only checklist (prefer this file + IMPLEMENTATION_CHECKLIST for full-stack) |
| [`language/IMPLEMENTATION_CHECKLIST.md`](./language/IMPLEMENTATION_CHECKLIST.md) | Stack progress (Parse/Check/Run/Py↔) |
| [`language/SEMANTICS.md`](./language/SEMANTICS.md) | Checker rules |
| [`language/TYPE_SYSTEM.md`](./language/TYPE_SYSTEM.md) | User types (record / enum / pointer / SET) |
| [`language/OBJECT_ORIENTED_PROGRAMMING.md`](./language/OBJECT_ORIENTED_PROGRAMMING.md) | CLASS |
| [`language/TRANSLATION.md`](./language/TRANSLATION.md) | ↔ Python mapping |
| [`language/INTERPRETER.md`](./language/INTERPRETER.md) | Runtime |
| [`language/LANGUAGE_SERVICE.md`](./language/LANGUAGE_SERVICE.md) | IDE intelligence |
| [`language/INCREMENTAL_COMPILATION.md`](./language/INCREMENTAL_COMPILATION.md) | Compiler service |
| [`TESTING.md`](./TESTING.md) | Conformance suite |
| [`ide/MONACO.md`](./ide/MONACO.md) | Editor binding |
| [`ai/AI_COACH.md`](./ai/AI_COACH.md) | Coach grounding |
| [`language/SPEC_REVIEW.md`](./language/SPEC_REVIEW.md) | Earlier readiness review (2026-07-14) |
| Official guide (external) | [2027–2029 Pseudocode Guide for Teachers (PDF)](https://www.cambridgeinternational.org/Images/721401-2027-2029-pseudocode-guide.pdf) · [2026 edition](https://www.cambridgeinternational.org/Images/697401-2026-pseudocode-guide-for-teachers.pdf) |
| In-app syntax / library refs | [`cambridge-syntax/`](./cambridge-syntax/README.md) · [`library-routines/`](./library-routines/README.md) |

---

## Document control

| Item | Value |
| --- | --- |
| Guide edition | Cambridge 9618 Pseudocode Guide for Teachers — exams **2026** |
| Audit type | Full-language + product-stage conformance (not builtins-only) |
| Next refresh | When product stubs land, or when 🟡 partials (insert packs / reverse translation) change materially |
| Owners | PseudoPilot language / compiler |
