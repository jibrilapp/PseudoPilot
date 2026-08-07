# AI Coach

> **v1.0.0-beta UI:** The AI Coach is **disabled** in the student IDE for this
> beta (feature flag `ENABLE_AI_COACH` in `apps/web/lib/featureFlags.ts`).
> Implementation, package APIs, and this document remain; the coach UI is
> reserved for a future update. Set `ENABLE_AI_COACH = true` to restore it.

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

## Intent classification pipeline

Before generating an answer, `classifyCoachIntent(question, context?)` assigns
**exactly one** category. `HeuristicAIProvider` (and the system prompt for future
LLMs) route on that intent.

### Routing order (first match wins)

1. **Product capability** — outranks concept keyword matches (e.g. “translate to
   HTML” must not become STRING / translation theory). Also catches IDE-locale
   questions: “Can I write HTML **here**?”, “in PseudoPilot”, “in this IDE”.
2. **Compiler / runtime diagnostics** — grounded in `C_*` / `E_*` / `T_*` / `R_*`
3. **Current code** — selection, AST walkthrough, pane compare
4. **General programming topic** — HTML, JS, JSON, Git, OOP, “recursion in
   Python”, “Can Python generate HTML?”, **and coding how-tos** (“How do I add
   two variables?”, FOR loops, CALL PROCEDURE, …). Checked **before** Cambridge
   concept cards so ordinary CS / basics are never forced into the tutor
   template (specific theory like BYREF still matches later).
5. **Cambridge theory** — syllabus concept match (BYREF, DIV, TYPE vs CLASS, …)
6. Otherwise **general programming** (still answered; see fallback policy)

| Intent | Examples | Response shape |
| --- | --- | --- |
| `product_capability` | “Can I translate to HTML?”, “Can I write HTML here?”, “Does PseudoPilot support Java?”, “Can I export to PDF?”, “Does this work offline?” | Direct product facts — **no** Cambridge tutor template |
| `cambridge_theory` | “Why use BYREF?”, “Explain recursion.” | Tutor card (Direct answer → … → Exam tip) |
| `current_code` | “Explain this”, “Walk through my algorithm”, compare panes | Grounded in `AIContext` (selection / AST / translation buffers) |
| `compiler_runtime_diagnostics` | “Why is this undeclared?”, “Why did it crash?” | Grounded in `C_*` / `E_*` / `T_*` / `R_*` |
| `general_programming` | “What is HTML?”, “How do I add 2 variables together?”, “How do I call a procedure?”, “Can Python generate HTML?” | Real educational answer (direct + example) — **not** the shrug; Cambridge 9618 Pseudocode examples preferred for syntax how-tos |

Shared helpers in `@pseudopilot/ai-coach`:

- `classifyCoachIntent()` — pure classifier (routes only; never the final answer)
- `answerProductCapability()` / `PRODUCT_FACTS` — accurate IDE capabilities
- `answerGeneralProgramming()` / `looksLikeCodingHowTo()` — offline how-to cards
  + CS topics + “what is X” explainer; Cambridge examples for coding syntax
- `isUnintelligibleQuestion()` — gates the rare shrug fallback

**Final routing flow (HeuristicAIProvider):** classify → switch on intent → for
`general_programming`, **always** call `answerGeneralProgramming()` and return
that message. The shrug phrase is used only when the answerer returns `null`
**and** `isUnintelligibleQuestion()` is true.

**Product facts (do not invent features):**

- **Translate:** Pseudocode ↔ Python only (live sync) — not HTML / Java / C++ / SQL / …
- **Editors:** Cambridge 9618 Pseudocode + Python teaching pane — not an HTML / JS / Java IDE
- **Debug / Run:** Pseudocode interpreter only; Python pane is a teaching translation
- **PDF export:** not supported
- **Offline:** parse / run / translate / Heuristic coach work offline; a remote LLM provider needs network

### Fallback policy

The canned shrug (“looks like a general programming question rather than…”) is
**not** the general-programming response. Classification never stops there.
After routing to `general_programming`, the coach generates a real answer
(direct explanation + example at minimum). The shrug is reserved for input that
is genuinely impossible to understand (empty noise, gibberish). Target: well
under **1%** of normal student prompts. Recognised product, theory, diagnostics,
code, how-tos, and general CS questions must always get a substantive answer.
## Initial capabilities

1. Explain compiler errors (`C_*` / `E_*`)
2. Explain runtime errors (`R_*`)
3. Explain selected code
4. Line-by-line algorithm outline (AST summary)
5. Cambridge concept tutoring (DECLARE, ARRAY, BYREF, recursion, …) — structured Direct answer / Explanation / Example / Common mistake
6. Suggest fixes from diagnostic codes / `help`
7. Compare Pseudocode ↔ Python
8. Product capability Q&A (supported translate targets, debug, offline, …)
9. General programming Q&A without forcing Cambridge theory

Primary product intent is **teaching**, not code generation.

## Educational response format (Cambridge theory)

For syllabus / concept questions, the coach answers like a **patient Cambridge
teacher**, not a reference manual. Offline `HeuristicAIProvider` cards (and the
system prompt for future LLM providers) use this fixed structure:

1. **Direct answer** — 1–3 sentences that answer the question asked
2. **Explanation** — concise teaching prose
3. **Example** — small Cambridge Pseudocode snippet (with `OUTPUT` when helpful)
4. **Common mistake** — what students usually get wrong
5. **Exam tip** — optional Paper 2 / mark-scheme guidance

Shared helper: `formatTutorResponse()` in `@pseudopilot/ai-coach`. Section
labels use bold markdown (`**Direct answer**`) plus fenced `pseudocode` blocks
so the IDE `CoachMarkdown` renderer stays compatible (no ATX headings required).

Concept matching prioritises the student’s wording (e.g. “How do I change a
variable inside a procedure?” → BYREF tutoring), but only **after** product
intent classification. Compiler diagnostics are only mentioned when the
question is about the student’s code or an error.

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
heuristic answers, intent classification (product vs theory vs general
programming), regression prompts that must not hit the shrug fallback,
diagnostic/runtime extraction, and AST summary.

## Non-goals (this milestone)

- Remote LLM HTTP / `apps/worker` job queue
- AI-authored code as the default answer
- Redesign of CompilerService / LanguageService / Runtime / Monaco
