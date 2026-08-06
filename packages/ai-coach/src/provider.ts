import type { CoachRequest, CoachResponse } from './context.js';

/**
 * Pluggable LLM / local coach backend.
 * The IDE talks only to {@link AICoachService}, which owns the provider.
 */
export type AIProvider = {
  readonly id: string;
  complete(request: CoachRequest): Promise<CoachResponse>;
};

export type AIProviderErrorCode =
  | 'NOT_CONFIGURED'
  | 'PROVIDER_ERROR'
  | 'EMPTY_QUESTION';

export class AIProviderError extends Error {
  readonly code: AIProviderErrorCode;

  constructor(code: AIProviderErrorCode, message: string) {
    super(message);
    this.name = 'AIProviderError';
    this.code = code;
  }
}
