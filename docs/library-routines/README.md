# Library Routines

Reference for **Cambridge 9618 pseudocode library routines** (built-in functions and related operators) as taught and examined, plus PseudoPilot support status.

## Sources

Cambridge does **not** publish a separate standalone “Library Routines” booklet in the materials used for this dialect. The routines students must know come from:

| Source | Contents |
| --- | --- |
| [Pseudocode Guide for Teachers (2027–2029)](https://www.cambridgeinternational.org/Images/721401-2027-2029-pseudocode-guide.pdf) §5.5, §5.6, §9.1 | `LENGTH`, `RIGHT`, `MID`, `LCASE`, `UCASE`, `&`, `INT`, `RAND`, `EOF` |
| [June 2024 Paper 2 Insert](https://www.cambridgeinternational.org/Images/673618-june-2024-insert-paper-21.pdf) | Exam-insert string/character/DATE helpers and operators (`LEFT`, `ASC`, `CHR`, `IS_NUM`, `TO_UPPER`, …) |

© Cambridge University Press & Assessment. Summaries are PseudoPilot wording; signatures and examples follow Cambridge forms.

No local PDF copy of a separate Library Routines document was found in the repo; this section is built from the official Guide + Paper 2 insert (and PseudoPilot’s Core registry).

## Pages

| Page | Contents |
| --- | --- |
| [Guide string routines](./guide-string.md) | `LENGTH`, `RIGHT`, `MID`, `LCASE`, `UCASE`, `&` |
| [Guide numeric routines](./guide-numeric.md) | `INT`, `RAND` |
| [EOF](./eof.md) | `EOF` (text files) |
| [Paper 2 insert — string & character](./insert-string-character.md) | `LEFT`, `TO_UPPER`, `TO_LOWER`, `NUM_TO_STR`, `STR_TO_NUM`, `IS_NUM`, `ASC`, `CHR` |
| [Paper 2 insert — DATE](./insert-date.md) | `DAY`, `MONTH`, `YEAR`, `DAYINDEX`, `SETDATE`, `TODAY` |
| [Insert operators](./insert-operators.md) | `&`, `AND`, `OR`, `NOT`, `MOD`, `DIV`, comparisons |

## Status legend

| Status | Meaning |
| --- | --- |
| **SUPPORTED** | In PseudoPilot Core registry and runtime |
| **PARTIALLY SUPPORTED** | Supported with soft type extensions vs Guide wording |
| **NOT YET SUPPORTED** | On exam inserts but not in the fixed Core pack |

**LEFT:** included in PseudoPilot Core because it appears on common Paper 2 inserts; it is **not** in the Teacher Guide §5.5 index. Marked as a Core extension where relevant.

Grammar and control-flow syntax: [Cambridge Pseudocode Syntax](../cambridge-syntax/README.md).
