/**
 * @pseudopilot/ai-coach — educational AI Coach (provider abstraction + prompts).
 * Never authoritative for runtime (ADR 0005). Grounding via {@link AIContext}.
 */

export const PACKAGE_NAME = '@pseudopilot/ai-coach' as const;
export const PACKAGE_VERSION = '1.0.0-beta.0' as const;

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

export { formatTutorResponse } from './tutorFormat.js';
export type { TutorCard } from './tutorFormat.js';
export { matchConcept, formatConceptAnswer } from './concepts.js';
export { classifyCoachIntent } from './intent.js';
export type { CoachIntent } from './intent.js';
export {
  answerProductCapability,
  PRODUCT_FACTS,
} from './productCapabilities.js';
export type { ProductCapabilityAnswer } from './productCapabilities.js';
export {
  answerGeneralProgramming,
  isUnintelligibleQuestion,
  looksLikeCodingHowTo,
  looksLikeGeneralProgrammingTopic,
} from './generalProgramming.js';
export type { GeneralProgrammingAnswer } from './generalProgramming.js';
export { GENERIC_FALLBACK_PHRASE } from './providers/heuristic.js';
