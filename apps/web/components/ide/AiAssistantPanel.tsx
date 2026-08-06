'use client';

import { useState } from 'react';
import type { CoachCapability } from '@pseudopilot/ai-coach';
import type { CoachChatMessage } from '@/lib/aiCoach';
import { cn } from '@/lib/cn';

const QUICK_ACTIONS: { label: string; question: string; capability: CoachCapability }[] = [
  {
    label: 'Explain errors',
    question: 'Why do I have these compiler errors?',
    capability: 'explain_compiler_error',
  },
  {
    label: 'Explain selection',
    question: 'Explain the selected code.',
    capability: 'explain_selection',
  },
  {
    label: 'Line-by-line',
    question: 'Explain this algorithm line by line.',
    capability: 'explain_algorithm',
  },
  {
    label: 'Compare Python',
    question: 'Compare the Pseudocode with the Python translation.',
    capability: 'compare_pseudocode_python',
  },
];

type AiAssistantPanelProps = {
  messages: readonly CoachChatMessage[];
  busy?: boolean;
  onAsk: (question: string, capability?: CoachCapability) => void;
  providerId?: string;
};

export function AiAssistantPanel({
  messages,
  busy = false,
  onAsk,
  providerId,
}: AiAssistantPanelProps) {
  const [draft, setDraft] = useState('');

  const send = () => {
    const q = draft.trim();
    if (!q || busy) return;
    setDraft('');
    onAsk(q);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-pp-panel">
      <div className="px-4 pb-3 pt-4">
        <p className="pp-section-label mb-1.5">Coach</p>
        <h2 className="text-[13px] font-semibold tracking-[-0.02em] text-pp-ink">
          AI Coach
        </h2>
        <p className="mt-0.5 text-[12px] leading-snug text-pp-muted">
          Grounded on compiler, translation, and debugger context
          {providerId ? ` · ${providerId}` : ''}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 px-3 pb-2">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.capability}
            type="button"
            disabled={busy}
            className="rounded-full border border-pp-line bg-white px-2 py-0.5 text-[10px] font-medium text-pp-muted transition-colors hover:border-pp-accent/40 hover:text-pp-ink disabled:opacity-50"
            onClick={() => onAsk(a.question, a.capability)}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-auto px-3 pb-3">
        {messages.map((msg, index) => (
          <article
            key={msg.id}
            className={cn(
              'max-w-[92%] whitespace-pre-wrap rounded-[12px] px-3 py-2.5 text-[13px] leading-[1.5] tracking-[-0.01em] animate-panel-in',
              msg.role === 'assistant'
                ? 'border border-pp-line bg-white text-pp-ink'
                : 'ml-auto bg-pp-ink text-white/95',
            )}
            style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
          >
            {msg.content}
          </article>
        ))}
        {busy && (
          <p className="px-1 text-[11px] text-pp-faint">Thinking…</p>
        )}
      </div>

      <div className="border-t border-pp-line p-3">
        <label className="sr-only" htmlFor="ai-draft">
          Ask the coach
        </label>
        <div className="flex items-end gap-2 rounded-[12px] border border-pp-line bg-pp-shell/80 px-3 py-2 focus-within:border-pp-accent/40">
          <textarea
            id="ai-draft"
            rows={2}
            placeholder="Why is this variable undeclared?"
            className="max-h-24 flex-1 resize-none bg-transparent text-[13px] leading-snug tracking-[-0.01em] outline-none placeholder:text-pp-faint"
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            type="button"
            className="pp-btn-primary shrink-0"
            disabled={busy || !draft.trim()}
            onClick={send}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
