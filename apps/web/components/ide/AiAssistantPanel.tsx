'use client';

import { useEffect, useRef, useState } from 'react';
import type { CoachCapability } from '@pseudopilot/ai-coach';
import type { CoachChatMessage } from '@/lib/aiCoach';
import { cn } from '@/lib/cn';
import { CoachMarkdown } from './CoachMarkdown';

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

const PROMPT_SUGGESTIONS = [
  'What does this FOR loop do?',
  'Why is my variable undeclared?',
  'How does INPUT map to Python?',
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
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const send = () => {
    const q = draft.trim();
    if (!q || busy) return;
    setDraft('');
    onAsk(q);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-pp-panel">
      <div className="border-b border-pp-line px-4 pb-3 pt-4">
        <p className="pp-section-label mb-1.5">Coach</p>
        <h2 className="text-[13px] font-semibold tracking-[-0.02em] text-pp-ink">
          AI Coach
        </h2>
        <p className="mt-0.5 text-[12px] leading-snug text-pp-muted">
          Grounded on compiler, translation, and debugger context
          {providerId ? ` · ${providerId}` : ''}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.capability}
            type="button"
            disabled={busy}
            className={cn(
              'rounded-[7px] border border-pp-line bg-white px-2 py-1 text-[10px] font-medium text-pp-muted',
              'transition-[border-color,color,background-color] duration-150',
              'hover:border-pp-accent/40 hover:text-pp-ink disabled:opacity-50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent/40',
            )}
            onClick={() => onAsk(a.question, a.capability)}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-2.5 overflow-auto px-3 pb-3"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.length === 0 && !busy && (
          <div className="rounded-[12px] border border-dashed border-pp-line bg-pp-shell/50 px-3 py-3">
            <p className="text-[12px] font-medium text-pp-ink">Try asking</p>
            <ul className="mt-2 space-y-1.5">
              {PROMPT_SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    className="text-left text-[12px] text-pp-muted underline-offset-2 hover:text-pp-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent/40"
                    onClick={() => onAsk(s)}
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {messages.map((msg, index) => (
          <article
            key={msg.id}
            className={cn(
              'max-w-[94%] rounded-[12px] px-3 py-2.5 tracking-[-0.01em] animate-panel-in',
              msg.role === 'assistant'
                ? 'border border-pp-line bg-white text-pp-ink shadow-[0_1px_2px_rgba(15,23,42,0.03)]'
                : 'ml-auto bg-pp-ink text-white/95',
            )}
            style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
          >
            {msg.role === 'assistant' ? (
              <CoachMarkdown content={msg.content} />
            ) : (
              <p className="whitespace-pre-wrap text-[13px] leading-[1.5]">
                {msg.content}
              </p>
            )}
          </article>
        ))}
        {busy && (
          <div
            className="inline-flex items-center gap-2 rounded-[12px] border border-pp-line bg-white px-3 py-2.5 text-[12px] text-pp-muted"
            role="status"
          >
            <span className="flex gap-1" aria-hidden>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pp-accent/70 [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pp-accent/70 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pp-accent/70 [animation-delay:300ms]" />
            </span>
            Thinking…
          </div>
        )}
      </div>

      <div className="border-t border-pp-line p-3">
        <label className="sr-only" htmlFor="ai-draft">
          Ask the coach
        </label>
        <div
          className={cn(
            'flex items-end gap-2 rounded-[12px] border border-pp-line bg-pp-shell/80 px-3 py-2',
            'transition-colors focus-within:border-pp-accent/40 focus-within:ring-1 focus-within:ring-pp-accent/20',
          )}
        >
          <textarea
            id="ai-draft"
            rows={2}
            placeholder="Why is this variable undeclared?"
            className="max-h-24 flex-1 resize-none bg-transparent text-[13px] leading-snug tracking-[-0.01em] outline-none placeholder:text-pp-faint disabled:opacity-60"
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
        <p className="mt-1.5 px-0.5 text-[10px] text-pp-faint">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}
