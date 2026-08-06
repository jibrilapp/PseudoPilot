# AI Coach

Educational assistant for the PseudoPilot student IDE. The coach **explains**
Cambridge 9618 Pseudocode using structured compiler and runtime data. It is
**never authoritative** for execution or translation ([ADR 0005](../adr/0005-ai-never-authoritative.md)).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ IdeShell / AiAssistantPanel                                 │
│   asks questions → useAICoach → AICoachService.ask()        │
└────────────────────────────┬────────────────────────────────┘
                             │ CoachRequest { question, AIContext }
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ @pseudopilot/ai-coach                                       │
│   AICoachService ──► AIProvider.complete()                  │
│        │                 │                                  │
│        │                 ├─ HeuristicAIProvider (offline)   │
│        │                 └─ UnconfiguredAIProvider (swap)   │
│        └─ buildCoachPrompt(AIContext)                       │
└─────────────────────────────────────────────────────────────┘
                             ▲
                             │ collectAIContext()  (apps/web)
         ┌───────────────────┼───────────────────┐
         │                   │                   │
 LanguageService      RuntimeController    Translation hook
 CompilerService      (pause / vars /      (pseudocode +
 (diags / symbols /    stack / R_*)         python + T_*)
  AST) + Monaco selection snapshot
```

**Rule:** The UI talks only to `AICoachService`. Providers never call the
compiler. Context assembly lives in `apps/web/lib/aiCoach/collectContext.ts`
and reads existing public APIs — no duplicated parse/check/translate logic.

## AIContext

Clean, JSON-serialisable DTO (no Monaco handles, IR nodes, or checker maps):

| Field | Source |
| --- | --- |
| `pseudocode` / `python` | Bidirectional translation buffers |
| `parserDiagnostics` | `DocumentAnalysis.parseDiagnostics` |
| `semanticDiagnostics` | `checkResult.diagnostics` (`C_*`) |
| `translationDiagnostics` | Live translate / reverse (`T_*`) |
| `symbols` | `LanguageService.getSymbols` + `formatType` |
| `astSummary` | Compact walk of `CompilerService.getAst` |
| `debugger.*` | `RuntimeSnapshot` (state, pause line, variables, call stack, `R_*`) |
| `selectedText` | Monaco selection via `CodeSurface.onSelectionChange` |

Built by `collectAIContext()` immediately before each `ask()`.

## AICoachService

```ts
const service = new AICoachService({
  provider: new HeuristicAIProvider(), // default offline coach
});
const response = await service.ask({ question, context, capability? });
```

- `setProvider()` swaps OpenAI / Anthropic / local models later
- Soft-fails provider errors into `CoachResponse.ok === false`
- `buildPrompt()` exposes the grounded prompt for tests

## Initial capabilities

1. Explain compiler errors (`C_*` / `E_*`)
2. Explain runtime errors (`R_*`)
3. Explain selected code
4. Line-by-line algorithm outline (AST summary)
5. Cambridge concept primers (DECLARE, ARRAY, PROCEDURE, …)
6. Suggest fixes from diagnostic codes / `help`
7. Compare Pseudocode ↔ Python
8. General 9618 Q&A (heuristic / future LLM)

Primary product intent is **teaching**, not code generation.

## IDE integration

- Dockable right **AI** tab + ActivityBar **AI Coach** + mobile AI view
- Quick-action chips in `AiAssistantPanel`
- Default provider: `HeuristicAIProvider` (works without API keys)
- Selection grounding: DualEditor → `setEditorSelection`

## Packages

| Path | Role |
| --- | --- |
| `packages/ai-coach` | Types, prompts, `AICoachService`, providers |
| `apps/web/lib/aiCoach` | Context collection, selection, React hook |
| `apps/web/components/ide/AiAssistantPanel.tsx` | Chat UI |

## Testing

```bash
pnpm --filter @pseudopilot/ai-coach test
pnpm --filter @pseudopilot/web test
```

Coverage includes AIContext shape, prompt construction, provider swap,
heuristic answers, diagnostic/runtime extraction, and AST summary.

## Non-goals (this milestone)

- Remote LLM HTTP / `apps/worker` job queue
- AI-authored code as the default answer
- Redesign of CompilerService / LanguageService / Runtime / Monaco
