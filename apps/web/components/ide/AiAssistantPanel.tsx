'use client';

import type { AiMessage } from '@/lib/dummy';
import { cn } from '@/lib/cn';

type AiAssistantPanelProps = {
  messages: AiMessage[];
};

export function AiAssistantPanel({ messages }: AiAssistantPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-pp-panel">
      <div className="px-4 pb-3 pt-4">
        <p className="pp-section-label mb-1.5">Coach</p>
        <h2 className="text-[13px] font-semibold tracking-[-0.02em] text-pp-ink">AI Assistant</h2>
        <p className="mt-0.5 text-[12px] leading-snug text-pp-muted">
          Grounded hints for the open file
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-auto px-3 pb-3">
        {messages.map((msg, index) => (
          <article
            key={msg.id}
            className={cn(
              'max-w-[92%] rounded-[12px] px-3 py-2.5 text-[13px] leading-[1.5] tracking-[-0.01em] animate-panel-in',
              msg.role === 'assistant'
                ? 'border border-pp-line bg-white text-pp-ink'
                : 'ml-auto bg-pp-ink text-white/95',
            )}
            style={{ animationDelay: `${index * 40}ms` }}
          >
            {msg.content}
          </article>
        ))}
      </div>

      <div className="border-t border-pp-line p-3">
        <label className="sr-only" htmlFor="ai-draft">
          Ask the coach
        </label>
        <div className="flex items-end gap-2 rounded-[12px] border border-pp-line bg-pp-shell/80 px-3 py-2 focus-within:border-pp-accent/40">
          <textarea
            id="ai-draft"
            rows={2}
            placeholder="Ask about this loop…"
            className="max-h-24 flex-1 resize-none bg-transparent text-[13px] leading-snug tracking-[-0.01em] outline-none placeholder:text-pp-faint"
            defaultValue=""
            readOnly
            title="Preview — not wired yet"
          />
          <button type="button" className="pp-btn-primary shrink-0" title="Preview">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
