/**
 * @pseudopilot/ai-coach — educational AI Coach (provider abstraction + prompts).
 * Never authoritative for runtime (ADR 0005). Grounding via {@link AIContext}.
 */

export const PACKAGE_NAME = '@pseudopilot/ai-coach' as const;
export const PACKAGE_VERSION = '0.1.0' as const;

export type {
  AIAstNodeSummary,
  AIContext,
  AIDebuggerState,
  AIDiagnostic,
  AIDiagnosticSeverity,
  AIStackFrame,
  AISymbol,
  AITranslationState,
  AIVariable,
  CoachCapability,
  CoachCitation,
  CoachRequest,
  CoachResponse,
} from './context.js';

export type { AIProvider, AIProviderErrorCode } from './provider.js';
export { AIProviderError } from './provider.js';

export {
  buildCoachPrompt,
  buildSystemPrompt,
  summariseContextForPrompt,
} from './prompts.js';

export { AICoachService } from './service.js';
export type { AICoachServiceOptions } from './service.js';

export { HeuristicAIProvider } from './providers/heuristic.js';
export { UnconfiguredAIProvider } from './providers/unconfigured.js';
