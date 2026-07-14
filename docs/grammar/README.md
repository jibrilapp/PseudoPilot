# Grammar notes (implementation)

Design notes and milestone scratchpads for the recursive-descent / Pratt parser live here.

**Official source of truth** for the Cambridge 9618 dialect:

→ [`docs/language/`](../language/README.md)

| File | Topic |
| --- | --- |
| [if-statements.md](./if-statements.md) | ELSE IF disambiguation |
| [routines.md](./routines.md) | PROCEDURE / FUNCTION |
| [arrays-files.md](./arrays-files.md) | Arrays + text files |
| [edge-cases.md](./edge-cases.md) | Adversarial cases |
| [parser-hardening.md](./parser-hardening.md) | Line ends, glue tokens |
| [milestone-3-subset.md](./milestone-3-subset.md) | Early subset |

When grammar behaviour changes, update **`docs/language/SPECIFICATION.md`** first, then these notes, then code.
