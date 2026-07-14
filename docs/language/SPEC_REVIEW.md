# Specification Review — Production Readiness

**Reviewer role:** Principal Software Engineer / Compiler Engineer  
**Scope:** Official language docs under `docs/language/` (five documents)  
**Date:** 2026-07-14  
**Verdict:** Strong foundation for Core dialect intent; **not production-locked** until contradictions below are resolved and a Translation & Semantics companion is added.

Legend for this review only: severity **P0** must fix before treating the suite as frozen source of truth; **P1** before translation engine; **P2** before claiming full 9618 compliance.

---

## Executive summary

The five documents correctly aim at Cambridge 9618 and separate *language law* (SPEC + EBNF) from *delivery status* (PARSER_COVERAGE + IMPLEMENTATION_CHECKLIST). That separation is right.

They are **not yet a producible compiler frontend contract**, because:

1. Implementation status is duplicated in four places and will drift.
2. Several PseudoPilot “resolutions” **contradict** the official Teacher Guide (notably `WHILE`/`DO`, `NEXT` binding strictness).
3. There is **no semantics or translation mapping** document—checklists track translator columns as ❌ without defining behaviour.
4. EBNF is incomplete for line-oriented surface forms exams actually print.
5. Builtin reservation model mixes **hard keywords** with **library names**.

---

## 1. Inconsistencies

| ID | Severity | Issue |
| --- | --- | --- |
| I1 | **P0** | **`WHILE` / `DO`:** SPEC §9.3 / §13.2 / EBNF require `DO`. Official Teacher Guide examples use `WHILE Number > 9` … `ENDWHILE` with **no** `DO`; `DO` is **absent** from the Cambridge keyword index. Classroom sites often add `DO`. Spec currently picks the non-official mandatory form. |
| I2 | **P0** | **`NEXT` identifier:** SPEC §13.3 requires `NEXT i` matching binder. Cambridge §7.1 formal line is `NEXT` and calls repeating the identifier “good practice,” not mandatory. Spec is stricter than Cambridge without labelling it a **strict-mode extension**. |
| I3 | **P0** | **Builtin reservation:** SPEC §1.9 says `LENGTH`/`RIGHT`/… are identifiers with special semantics; §1.11 lists them in the **reserved word** index alongside true keywords (`IF`, `FOR`). Hard-keywording them rejects legal `DECLARE Length : INTEGER` / student names. PARSER marks builtins ❌ while user `CallExpression` ✅—same surface form. |
| I4 | **P1** | **Whole-array assignment:** SPEC §6.2 says “❌ not yet modelled”; §13.11 says identifier target is fine and runtime decides. PARSER/IMPLEMENTATION mark 🟡. Three different stories. |
| I5 | **P1** | **Recursion status:** SPEC §7.2 Parse ✅; IMPLEMENTATION Parse 🟡. Same fact, different marks. |
| I6 | **P1** | **CASE arm body:** SPEC §8.2 allows “a block until next label”; EBNF §4.2 allows only a **single** `statement`. |
| I7 | **P1** | **`OF` dual status:** SPEC §1.1 `OF` ✅ (ARRAY); §1.4 `OF` 🟡 (CASE OF). One keyword, conflicting inventory rows. |
| I8 | **P1** | **Strict REAL policy:** SPEC §13.9 offers warning *or* reject under `--strict-cambridge`; EBNF encodes only strict `real_lit`; PARSER 🟡. No Modes table elsewhere. |
| I9 | **P1** | **Status ownership:** Parser marks appear in SPEC keyword tables, EBNF comments, PARSER_COVERAGE, and IMPLEMENTATION_CHECKLIST. README says checklists track status; SPEC still embeds ✅/❌ columns—violate single source of truth. |
| I10 | **P2** | **Stale sibling docs:** `docs/grammar/milestone-3-subset.md` still describes a tiny DECLARE-free subset; README now points to `docs/language/`, but old notes can mislead implementers. |
| I11 | **P2** | **Comments “Run ✅”:** IMPLEMENTATION §A marks comments executable—vacuous / confusing for a runtime column. |
| I12 | **P2** | **Index vs tables:** Alphabetical reserved list includes `DO`, `INT`, `LENGTH`, `STEP`, etc., implying hard keywords even where §1.9 soft-reserves library names. |
| I13 | **P1** | **Authority order vs adherence:** README ranks PseudoPilot resolutions **above** Cambridge. Acceptable for a product dialect, but undocumented as “PseudoPilot Cambridge-compatible with listed extensions/strictnesses.” Marketing vs engineering conflict. |
| I14 | **P2** | **N-D arrays:** Syllabus requires 1D/2D; SPEC allows N-D without listing it under §13 extensions. |

---

## 2. Missing features

### 2.1 Language (vs Teacher Guide Core)

| Missing / under-specified | Notes |
| --- | --- |
| Semantics document | Types, evaluation order, short-circuit?, division by zero, EOF before open, uninitialised DECLARE |
| Translation mapping table | Pseudocode ↔ Python for every construct (see §4) |
| Conformance levels | e.g. Core-Parse, Core-Run, Extended |
| Soft-reserved vs hard-keyword policy | Library builtins vs true keywords |
| Optional `DO` / optional `NEXT Ident` | Needed for Guide fidelity + classroom variants |
| `ELSEIF` / `ELSEIF` single token | Student code appears; accept or diagnostic |
| Same-line statement packing | `IF c THEN OUTPUT x` / `ENDIF` patterns exams use |
| CHAR literal orthography | Guide uses typographic quotes; ASCII `'` policy missing |
| String escape / Unicode / newline in strings | SPEC says TBD |
| `CONSTANT` expression ban | Stated once; no EBNF constraint beyond `literal` |
| DECLARE before use (required or recommended?) | Cambridge “good practice”; product rule undefined |
| Array bound evaluation time | Static vs runtime for `ARRAY[1:N]` |
| Multi-statement CASE arms | SPEC intends blocks; EBNF doesn’t |
| Bare `NEXT` | Cambridge-legal; PseudoPilot not |
| `CALL` of function / `CALL`-less procedure | Diagnostic policy missing |
| Library/insert pack schema | Mentioned; no format |
| Negative `STEP` termination rule | Only positive default partially stated |
| `MOD`/`DIV` with negatives | Undefined (Python vs Cambridge exam inserts) |
| ADT section (stack/queue/…) | Syllabus mentions ADTs; not in dialect surface (OK if “teach in host language”)—state explicitly |
| Error taxonomy | Codes listed ad hoc (`E_NESTED_ROUTINE`); no catalogue |

### 2.2 Product / maintainability gaps

| Missing | Notes |
| --- | --- |
| Changelog / SPEC versioning policy | Version 1.0 with no Change Log |
| Test-corpus → grammar binding | Which gold files prove which productions |
| Machine-readable grammar | Markdown EBNF cannot gate CI alone |
| Dialect mode matrix | `compat` / `strict-cambridge` / `extended` |

---

## 3. Ambiguous grammar rules

| ID | Production / rule | Ambiguity |
| --- | --- | --- |
| G1 | `WHILE` | Condition termination: official form has **no** `DO`; optional `DO` not in EBNF. How is `WHILE NOT EOF(f)` parsed vs call? (Fine.) Where does condition end without `DO`? → must end at `NL` then block until `ENDWHILE`. |
| G2 | `if_stmt` | EBNF requires `THEN NL` then `block`. Is `IF c THEN stmt` on one line legal? Cambridge often packs then-clause. Spec silent. |
| G3 | `ELSE` | EBNF: `"ELSE" NL block`. Same-line `ELSE OUTPUT x`? Forbidden by EBNF, undocumented in SPEC. |
| G4 | `else_if_clause` | “No newline between ELSE and IF”—tabs? Comments `ELSE //x` then `IF`? Comment consumption may flip line discipline. |
| G5 | `case_arm` | One statement vs block; colon and nested IF/`CALL`; empty arm; multiple labels (Cambridge shows one label per arm). |
| G6 | `case_label` | `expression TO expression` vs relational `TO` keyword in FOR—context-sensitive. Char labels need `char_lit` not yet lexer-defined. |
| G7 | `for_stmt` | Control var assign on same line as `FOR`; `STEP 0`? `NEXT` without ident? Nested `FOR` vs file `FOR`. |
| G8 | `assign_target` / `index_expr` | EBNF `index_expr` is `identifier […]` only; `postfix` allows indexing after calls—assigns cannot use that; expressions can. Intentional? Spec doesn’t say “index only after identifier.” |
| G9 | `primary` call vs keyword statement | `OUTPUT(x)` vs `OUTPUT x`; `INPUT(x)`? |
| G10 | `param_list` optional brackets | `PROCEDURE P` vs `PROCEDURE P()` both allowed (SPEC); EBNF uses `[ param_list ]` only—does not state bare name form explicitly beyond optional list. OK but easy to miss: need `procedure_decl = "PROCEDURE" identifier [ param_list ]`. Matches. |
| G11 | `CONSTANT … =` | `=` is assign for constants only; relational `=` elsewhere. Fine if statement-led. |
| G12 | `TYPE` enum vs `TYPE` record | Disambiguation: `TYPE Name =` vs `TYPE Name NL DECLARE`—needs lookahead note in EBNF. |
| G13 | `NEW` | Keyword for instantiation vs method name `PROCEDURE NEW` inside CLASS—lexer/keyword conflict. |
| G14 | `^` | Type position vs postfix dereference vs entirely unused—precedence vs unary missing. |
| G15 | Line-oriented `statement` | Multi-statement lines and continuation lines (Cambridge §1.4) not modelled. |
| G16 | Block emptiness | Zero-statement bodies—allowed by `{ statement }`—confirm for FOR/WHILE/IF. |
| G17 | `READ`/`WRITE` as identifiers | Soft keywords only valid after `FOR` in `OPENFILE`; elsewhere student may use `Write` as name—case-insensitive keyword map currently hard-keywords them (implementation risk; SPEC should declare contextual keywords). |

---

## 4. Translation edge cases

*No translation mapping document exists.* Before any Py↔PS bridge is truthful, lock decisions for at least:

| Area | Edge case | Why it bites |
| --- | --- | --- |
| T1 | **1-based arrays** ↔ Python lists | `A[1:10]` → size 10 list with unused index 0, or dict, or OffsetList |
| T2 | **Inclusive FOR** ↔ `range` | `FOR i ← 1 TO n` → `range(1, n+1)`; negative STEP |
| T3 | **`DIV`/`MOD`** ↔ `//` `%` | Sign of remainder for negatives differs across languages |
| T4 | **`/` always REAL** ↔ Python 3 `/` | OK; warn when both OPERANDS INTEGER in PS |
| T5 | **`&` vs `+`** | Python `+` for str; refuse int+str silently |
| T6 | **`TRUE`/`FALSE`** ↔ `True`/`False` | Casefolding round-trip |
| T7 | **Identifier case-insensitivity** | Round-trip must pick canonical spelling |
| T8 | **`DECLARE` / no Python declare** | Emit annotations, comments, or `name: type` only |
| T9 | **`CONSTANT`** ↔ final / UPPER_CASE / comment |
| T10 | **`INPUT`/`OUTPUT`** | `INPUT` typing (always STRING then cast?); multi-`OUTPUT` separator; Python `print` end |
| T11 | **`BYREF`** | Translate to mutable cell, list length-1, or prohibit →Python unless container |
| T12 | **`CALL` vs expression call** | Procedures → statements; functions → expressions; reject `CALL f` if f is function |
| T13 | **`ELSE IF` extension** | → `elif` is natural; Py→PS must choose nested IF vs `ELSE IF` |
| T14 | **`CASE`** | `match`/`case` (3.10+) vs if-elif; range arms; CHAR quotes |
| T15 | **`LENGTH`/`MID` 1-based** | Python slices 0-based; off-by-one gold tests |
| T16 | **`LCASE`/`UCASE` CHAR-only** | Python `str.lower()` on one char vs whole string inserts |
| T17 | **`RAND(x)` half-open** | `random.random()*x` vs `randrange` |
| T18 | **Files** | Line endings, `EOF`, APPEND; Python file objects vs path strings as IDs |
| T19 | **Whole-array assign** | Shallow copy vs reference semantics |
| T20 | **Records / OOP (Extended)** | `@dataclass` / classes; `SUPER.NEW`; private name mangling |
| T21 | **Round-trip fidelity** | `<-` vs `←`; formatting loss |
| T22 | **Exam-insert functions** | Must not invent Python helpers without pack |
| T23 | **`DATE`** | `datetime.date` parsing `dd/mm/yyyy` locale traps |
| T24 | **Short-circuit `AND`/`OR`** | If Python `and`/`or` used, define evaluation model |
| T25 | **Nested routines rejected** | Python nested `def` from Py→PS must hoist or reject |

---

## 5. Parser edge cases

| ID | Edge case | Spec guidance today |
| --- | --- | --- |
| P1 | `ELSE` + NL + `IF` vs `ELSE IF` | Documented ✅; still fragile with trailing comments on `ELSE` line |
| P2 | Missing `ENDIF` / wrong nesting | Recovery / error sync not specified |
| P3 | `FOR` after failed `OPENFILE` parse | Dual-use keyword—partially noted |
| P4 | `WHILE` without `DO` (Guide-legal) | Currently planned as illegal—**wrong** |
| P5 | `NEXT` without identifier | Planned illegal—stricter than Guide |
| P6 | `STEP` not in lexer | Loop implementation blocked even if grammar ready |
| P7 | Contextual keywords `READ`/`WRITE`/`APPEND` | Hard keywordization vs Ident |
| P8 | `EOF` as special primary vs user `FUNCTION EOF` | Shadowing rejected? Unspecified |
| P9 | Soft builtins parse as `CallExpression` today | Checklist marking ❌ is misleading |
| P10 | Char literal vs empty `''` vs `'''` | Not defined |
| P11 | Real `.5` / `5.` | Dual policy |
| P12 | Glue tokens `2x`, trailing commas | Hardening exists; not in official EBNF |
| P13 | Unicode minus `−` vs ASCII `-` | Guide PDFs use typographic minus—lexer? |
| P14 | `←` vs `<-` vs `←` NFC | Documented ✅ for arrows; NFC not |
| P15 | Array index arity ≠ declared dims | Semantic, not parse |
| P16 | `RETURN` outside function | Already rejected—good; catalogue missing |
| P17 | Statement on same line after `THEN` | Ambiguous G2 |
| P18 | `CASE OF x` with `x` expression containing `:` | Unlikely; still |
| P19 | Empty program / only comments | Allowed? |
| P20 | Maximum identifier length / reserved prefix | Unspecified |

---

## 6. Recommended improvements

### 6.1 Document architecture (maintainability / scalability)

1. **Split law from status**  
   - SPEC + EBNF = normative language (no ✅/❌ columns).  
   - PARSER_COVERAGE + IMPLEMENTATION_CHECKLIST = **only** status (generated or manually synced from one tables file).

2. **Add three companion specs before coding translator**  
   - `SEMANTICS.md` — evaluation, types, errors  
   - `TRANSLATION.md` — construct↔Python mapping + non-goals  
   - `CONFORMANCE.md` — Core / Strict / Extended / Insert-pack levels  

3. **Add `MODES.md`**  
   - `strict-guide` (Teacher Guide orthodoxy: optional `DO`, optional `NEXT` ident)  
   - `compat-classroom` (accept `DO`, `ELSE IF`, `<-`)  
   - `extended-alevel` (TYPE, OOP, random files)

4. **Keyword classes**  
   - Hard keywords · Contextual keywords (`READ` after `FOR`) · Soft-reserved library names · Exam-insert names  

5. **Normative EBNF upgrades**  
   - Optional `DO`; optional `NEXT` identifier; multi-statement CASE arms; same-line THEN/ELSE bodies **or** explicit forbid with diagnostic  
   - Contextual keyword productions  
   - Lookahead notes for `TYPE` / `NEW` / `FOR`

6. **Error code catalogue** in SPEC or `DIAGNOSTICS.md`

7. **Deprecate or banner** stale `docs/grammar/milestone-3-subset.md`

8. **Versioning** — semver the dialect; changelog on every norm change; parser refuses to claim compliance without matching dialect version string

### 6.2 Cambridge adherence fixes (P0)

1. Change §13.2: **`DO` optional**; prefer Guide form without `DO`; accept classroom `DO`.  
2. Change §13.3: **`NEXT` identifier recommended**; required only in `strict-pedantic` mode—or warn if omitted.  
3. Remove library builtins from hard reserved index; soft-reserve with redefinition diagnostics.  
4. Publish an **Extensions vs Guide** table (ELSE IF, `<-`, N-D arrays, ASCII quotes, optional DO accept).

### 6.3 Grammar completeness

1. Resolve CASE arm = block.  
2. Specify line packing rules.  
3. Document contextual keywords.  
4. Define CHAR literal ASCII policy.  
5. Encode negative FOR-STEP termination math in SEMANTICS.

### 6.4 Translation readiness

1. Write `TRANSLATION.md` covering §4 table as mandatory decisions.  
2. Prefer **AST→AST** with shared Core IR rather than string templates.  
3. Gold corpus: Guide examples + past-paper style snippets per production.  
4. Round-trip tests only for Core-strict subset first.

### 6.5 Parser completeness process

1. One checklist row ↔ ≥1 positive + ≥1 negative parse test.  
2. Soft builtins: parse ✅ as calls; check layer validates arity.  
3. Machine-check status badges aren’t copied into SPEC.

---

## 7. Updated implementation priorities

Replaces IMPLEMENTATION_CHECKLIST “Recommended order.” Optimized for **truthful Core Paper 2** then **translator**, with P0 spec fixes first.

| Priority | Work | Rationale |
| --- | --- | --- |
| **0** | Spec errata: `DO` optional, `NEXT` policy, soft builtins, remove status columns from SPEC | Stop coding against wrong law |
| **0b** | Add `SEMANTICS.md` skeleton + `CONFORMANCE.md` levels | Enables Check/Run without guesswork |
| **1** | Lexer: `STEP`; optional `DO`; contextualize `READ`/`WRITE`/`APPEND` plan | Unblock loops |
| **2** | Parse **WHILE** (Guide form ± optional DO) + **REPEAT** | Highest frequency after IF; file-copy pattern needs WHILE+EOF |
| **3** | Parse **FOR** + `STEP` + `NEXT` [Ident] | Completes iteration |
| **4** | Parse `&` + CHAR literals; soft-bind builtins `LENGTH`/`RIGHT`/`MID`/`LCASE`/`UCASE`/`INT`/`RAND` | Everyday Paper 2 expressions |
| **5** | `CONSTANT` + strict/compat REAL modes | Low risk, Guide completeness |
| **6** | `CASE OF` (multi-statement arms, ranges, OTHERWISE) | Completes Core selection |
| **7** | Semantic **Check** layer: scopes, types light, NEXT match warn, CALL vs function | Prerequisite for Run and →Py |
| **8** | Interpreter Core (assign, IF, loops, routines, arrays, text files, builtins) | Executable gold before translate |
| **9** | `TRANSLATION.md` decisions + **→Py** for Core | Product milestone |
| **10** | **Py→** (subset) with hoist nested defs / reject unsupported | Harder; after →Py stable |
| **11** | `BYVAL`/`BYREF` parse + Run | Needs clear Python strategy |
| **12** | Extended: records → random files → OOP | After Core credibility |

### Explicit de-prioritize (for now)

- Full DATE orthodoxy  
- Pointer ADTs / sets  
- Perfect round-trip of Extended  
- Exam-insert UI before registry schema  

### Gate criteria (replacing vague “1–3 Parse ✅”)

**Translation engine may start** when:

- Priority **0** errata merged  
- Priorities **2–4** Parse ✅  
- Priority **7** Check covers DECLARE/CALL/types-light  
- `TRANSLATION.md` has locked decisions for T1–T18  

**Translation engine may claim Production Core** when:

- Priority **8** Run ✅ on Guide Core examples corpus  
- →Py gold tests green for that corpus  
- Conformance level `Core-Run` published  

---

## Adherence scorecard (9618 Teacher Guide)

| Area | Doc quality | Cambridge fit |
| --- | --- | --- |
| Keywords / operators inventory | High | High, modulo soft-vs-hard builtins |
| Types / DECLARE / ARRAY / files text | High | High |
| IF | High | High (+ documented ELSE IF extension) |
| CASE / loops | Medium (incomplete EBNF) | **WHILE/DO and NEXT policies currently misaligned** |
| Routines / BYREF | Medium | Correct intent; BYREF not done |
| Builtins | Medium | Signatures good; reservation model wrong |
| TYPE / OOP / random files | Adequate as Extended stubs | Deferred appropriately |
| Semantics / translation | **Missing** | Cannot claim adherence of runtime/translate |

---

## Bottom line

Treat the five documents as **v1.0 draft law**, not frozen production law.

Highest-leverage next documentation edits (still no application code required for this review’s follow-up): resolve **I1–I3**, strip status marks from SPEC, and add **SEMANTICS + TRANSLATION + CONFORMANCE** so the checklists have something normative to track.
