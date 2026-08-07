'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AICoachService,
  HeuristicAIProvider,
  type CoachCapability,
  type CoachResponse,
} from '@pseudopilot/ai-coach';
import type { RuntimeSnapshot } from '@/lib/runtime/types';
import type { IdeDiagnostic, TranslationStatus } from '@/lib/translation/types';
import type { EditOrigin } from '@/lib/translation/bidirectionalSync';
import { collectAIContext } from './collectContext';

export type CoachChatMessage = {
  readonly id: string;
  readonly role: 'assistant' | 'user';
  readonly content: string;
};

export type UseAICoachInput = {
  readonly pseudocode: string;
  readonly python: string;
  readonly translationStatus: TranslationStatus;
  readonly translationErrorSide: EditOrigin | null;
  readonly translationDiagnostics: readonly IdeDiagnostic[];
  readonly runtime: RuntimeSnapshot;
};

let messageSeq = 0;
function nextId(prefix: string): string {
  messageSeq += 1;
  return `${prefix}-${messageSeq}`;
}

/**
 * React binding: UI talks only to {@link AICoachService}.
 */
export function useAICoach(input: UseAICoachInput) {
  const serviceRef = useRef(
    new AICoachService({ provider: new HeuristicAIProvider() }),
  );
  const [messages, setMessages] = useState<CoachChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hi — I am the PseudoPilot AI Coach. I use your compiler diagnostics, symbols, translation, and debugger state to explain Cambridge Pseudocode. Ask about an error, a selection, or a syllabus concept.',
    },
  ]);
  const [busy, setBusy] = useState(false);

  const snapshotInput = useMemo(() => input, [
    input.pseudocode,
    input.python,
    input.translationStatus,
    input.translationErrorSide,
    input.translationDiagnostics,
    input.runtime,
  ]);

  const ask = useCallback(
    async (question: string, capability?: CoachCapability) => {
      const trimmed = question.trim();
      if (!trimmed || busy) return;

      setMessages((prev) => [
        ...prev,
        { id: nextId('user'), role: 'user', content: trimmed },
      ]);
      setBusy(true);
      try {
        const context = collectAIContext(snapshotInput);
        const response: CoachResponse = await serviceRef.current.ask({
          question: trimmed,
          context,
          ...(capability != null ? { capability } : {}),
        });
        const citationNote =
          response.citations.length > 0
            ? `\n\n— ${response.citations
                .map((c) =>
                  [c.code, c.line != null ? `L${c.line}` : null, c.label]
                    .filter(Boolean)
                    .join(' '),
                )
                .slice(0, 4)
                .join(' · ')}`
            : '';
        setMessages((prev) => [
          ...prev,
          {
            id: nextId('assistant'),
            role: 'assistant',
            content: response.message + citationNote,
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy, snapshotInput],
  );

  return {
    messages,
    busy,
    ask,
    providerId: serviceRef.current.getProviderId(),
  };
}
