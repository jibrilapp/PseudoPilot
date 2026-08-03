/**
 * Singleton language service for the student IDE buffer.
 * Backed by `@pseudopilot/compiler-service` incremental caches.
 */

import {
  createCompilerSession,
  type LanguageService,
} from '@pseudopilot/language-service';
import type { CompilerService } from '@pseudopilot/compiler-service';

export const IDE_DOCUMENT_URI = 'ide://main' as const;

type Session = {
  languageService: LanguageService;
  compilerService: CompilerService;
};

let session: Session | null = null;

function getSession(): Session {
  if (!session) {
    const created = createCompilerSession();
    session = {
      languageService: created.languageService,
      compilerService: created.compilerService,
    };
  }
  return session;
}

export function getIdeLanguageService(): LanguageService {
  return getSession().languageService;
}

export function getIdeCompilerService(): CompilerService {
  return getSession().compilerService;
}

/** Test helper — reset singleton between Vitest cases. */
export function resetIdeLanguageServiceForTests(): void {
  session = null;
}
