import type { CoachResponse } from '../context.js';
import type { AIProvider } from '../provider.js';
import { AIProviderError } from '../provider.js';

/**
 * Placeholder remote provider — swap for OpenAI / Anthropic / local models later.
 * Keeps the {@link AIProvider} surface stable without requiring API keys.
 */
export class UnconfiguredAIProvider implements AIProvider {
  readonly id: string;

  constructor(id = 'unconfigured') {
    this.id = id;
  }

  async complete(): Promise<CoachResponse> {
    throw new AIProviderError(
      'NOT_CONFIGURED',
      `AI provider "${this.id}" is not configured. Use HeuristicAIProvider for offline coaching, or supply an API-backed provider.`,
    );
  }
}
