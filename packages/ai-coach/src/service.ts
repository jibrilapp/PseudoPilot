import type { CoachRequest, CoachResponse } from './context.js';
import type { AIProvider } from './provider.js';
import { AIProviderError } from './provider.js';
import { buildCoachPrompt } from './prompts.js';

export type AICoachServiceOptions = {
  readonly provider: AIProvider;
};

/**
 * IDE-facing coach façade. UI must talk only to this service —
 * not to CompilerService / RuntimeController / providers directly.
 */
export class AICoachService {
  private provider: AIProvider;

  constructor(options: AICoachServiceOptions) {
    this.provider = options.provider;
  }

  getProviderId(): string {
    return this.provider.id;
  }

  setProvider(provider: AIProvider): void {
    this.provider = provider;
  }

  /** Expose prompt text for tests / debugging (no network). */
  buildPrompt(request: CoachRequest): { system: string; user: string } {
    return buildCoachPrompt(request);
  }

  async ask(request: CoachRequest): Promise<CoachResponse> {
    const question = request.question.trim();
    if (!question) {
      return {
        ok: false,
        providerId: this.provider.id,
        groundedLocally: true,
        citations: [],
        message: 'Please enter a question for the coach.',
      };
    }
    try {
      const response = await this.provider.complete({
        ...request,
        question,
      });
      return response;
    } catch (err) {
      if (err instanceof AIProviderError) {
        return {
          ok: false,
          providerId: this.provider.id,
          groundedLocally: true,
          citations: [],
          message: err.message,
        };
      }
      const message =
        err instanceof Error ? err.message : 'Unexpected coach failure.';
      return {
        ok: false,
        providerId: this.provider.id,
        groundedLocally: true,
        citations: [],
        message: `Coach error: ${message}`,
      };
    }
  }
}
