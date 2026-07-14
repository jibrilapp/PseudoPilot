# Load tests (k6)

These scenarios exist so we never “discover” classroom spikes in production.

## Scenarios to implement when APIs exist

| Script (planned) | Models | Pass criteria |
|------------------|--------|---------------|
| `classroom-spike.js` | 3,000 students save + optional sandbox run in 60s | Error rate < 1%; sandbox queue soft-fails, API stays up |
| `steady-dau.js` | Mix of auth, project save, ClientLocal (no sandbox) | API p95 < 200ms |
| `ai-budget.js` | Concurrent AI jobs | Worker scales; API latency unaffected |

## Run (later)

```bash
# Example once scripts land:
# k6 run tests/load/classroom-spike.js
```

Foundation includes this folder so CI can eventually gate merge on load regressions for execute/save paths.
