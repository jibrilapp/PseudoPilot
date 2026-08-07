'use client';

import { CAMBRIDGE_DISCLAIMER } from '@/lib/ide/cambridgeDisclaimer';
import {
  NEW_FILE_TEMPLATE,
  WELCOME_EXAMPLES,
  type WelcomeExample,
} from '@/lib/ide/welcomeExamples';
import { ENABLE_AI_COACH } from '@/lib/featureFlags';
import { cn } from '@/lib/cn';

type WelcomeScreenProps = {
  onNewFile: (source: string) => void;
  onOpenExample: (example: WelcomeExample) => void;
  onOpenDocs: () => void;
  onDismiss: () => void;
};

export function WelcomeScreen({
  onNewFile,
  onOpenExample,
  onOpenDocs,
  onDismiss,
}: WelcomeScreenProps) {
  const starters = WELCOME_EXAMPLES.filter((e) => e.group === 'starter');
  const cambridge = WELCOME_EXAMPLES.filter((e) => e.group === 'cambridge');

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-auto bg-pp-editor"
      data-testid="welcome-screen"
      role="region"
      aria-label="Welcome"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10 md:px-10 md:py-14">
        <header className="space-y-3">
          <p className="pp-section-label">PseudoPilot</p>
          <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-pp-ink md:text-[32px]">
            Cambridge pseudocode, ready to run
          </h1>
          <p className="max-w-xl text-[14px] leading-relaxed text-pp-muted">
            Edit Pseudocode or Python — the other pane updates automatically.
            Run in the interpreter and step with the debugger
            {ENABLE_AI_COACH
              ? ', and ask the AI Coach for grounded hints.'
              : '. Browse in-app Documentation when you need a reference.'}
          </p>
          <p
            className="max-w-xl text-[12px] leading-relaxed text-pp-faint"
            data-testid="cambridge-disclaimer"
          >
            {CAMBRIDGE_DISCLAIMER}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">

            <button
              type="button"
              className="pp-btn-primary px-3.5"
              onClick={() => onNewFile(NEW_FILE_TEMPLATE)}
            >
              New File
            </button>
            <button
              type="button"
              className="pp-btn-ghost border border-pp-line bg-white px-3.5"
              onClick={() => {
                const first = starters[0] ?? cambridge[0];
                if (first) onOpenExample(first);
              }}
            >
              Open Example
            </button>
            <button
              type="button"
              className="pp-btn-ghost px-3.5"
              onClick={onDismiss}
            >
              Continue editing
            </button>
          </div>
        </header>

        <section aria-labelledby="welcome-starters">
          <h2
            id="welcome-starters"
            className="mb-3 text-[13px] font-semibold tracking-[-0.02em] text-pp-ink"
          >
            Starter examples
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {starters.map((ex) => (
              <ExampleCard key={ex.id} example={ex} onOpen={onOpenExample} />
            ))}
          </div>
        </section>

        <section aria-labelledby="welcome-cambridge">
          <h2
            id="welcome-cambridge"
            className="mb-3 text-[13px] font-semibold tracking-[-0.02em] text-pp-ink"
          >
            Cambridge examples
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {cambridge.map((ex) => (
              <ExampleCard key={ex.id} example={ex} onOpen={onOpenExample} />
            ))}
          </div>
        </section>

        <section
          aria-labelledby="welcome-more"
          className="grid gap-2 border-t border-pp-line pt-6 sm:grid-cols-2"
        >
          <button
            type="button"
            onClick={onOpenDocs}
            className={cn(
              'rounded-[12px] border border-pp-line bg-pp-panel px-4 py-3.5 text-left',
              'transition-[border-color,background-color,box-shadow] duration-150 ease-apple',
              'hover:border-pp-accent/35 hover:bg-white hover:shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent/45',
            )}
          >
            <p className="text-[13px] font-semibold tracking-[-0.02em] text-pp-ink">
              Documentation
            </p>
            <p className="mt-0.5 text-[12px] text-pp-muted">
              In-app language reference, IDE guides, and architecture notes.
            </p>
          </button>
          <div
            className="rounded-[12px] border border-dashed border-pp-line bg-pp-shell/60 px-4 py-3.5"
            aria-disabled="true"
          >
            <p className="flex items-center gap-2 text-[13px] font-semibold tracking-[-0.02em] text-pp-ink">
              Past Paper Mode
              <span className="rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em] text-pp-faint">
                Coming soon
              </span>
            </p>
            <p className="mt-0.5 text-[12px] text-pp-muted">
              Timed practice with mark-scheme-aligned prompts.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function ExampleCard({
  example,
  onOpen,
}: {
  example: WelcomeExample;
  onOpen: (example: WelcomeExample) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(example)}
      className={cn(
        'rounded-[12px] border border-pp-line bg-pp-panel px-4 py-3 text-left',
        'transition-[border-color,background-color,box-shadow] duration-150 ease-apple',
        'hover:border-pp-accent/35 hover:bg-white hover:shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent/45',
      )}
    >
      <p className="font-mono text-[12.5px] font-medium tracking-tight text-pp-ink">
        {example.title}
      </p>
      <p className="mt-0.5 text-[12px] text-pp-muted">{example.blurb}</p>
    </button>
  );
}
