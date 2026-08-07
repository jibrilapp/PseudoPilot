# PseudoPilot Cambridge Regression Corpus

On-disk fixtures for `@pseudopilot/conformance`.

Each entry is `<category>/<id>/` with:

| File | Purpose |
| --- | --- |
| `program.pp` | Pseudocode source |
| `meta.json` | Title, tags, I/O, diagnostics, reverse policy |
| `expect.python` | Gold Python translation (clean programs) |
| `expect.reverse.pp` | Gold reverse Pseudocode when `reverse: "check"` |

See [`docs/REGRESSION_SUITE.md`](../../../docs/REGRESSION_SUITE.md).

Seeded 80 entries. Reverse skipped at seed time: 6.
