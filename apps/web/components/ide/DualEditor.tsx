'use client';

import type { EditorTab } from '@/lib/dummy';
import { cn } from '@/lib/cn';
import { CodeSurface } from './CodeSurface';

type DualEditorProps = {
  tabs: EditorTab[];
  activeFileId: string;
  onSelectTab: (id: string) => void;
  pseudocode: string;
  python: string;
  stacked?: boolean;
};

export function DualEditor({
  tabs,
  activeFileId,
  onSelectTab,
  pseudocode,
  python,
  stacked = false,
}: DualEditorProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-pp-editor">
      <div className="flex items-end overflow-x-auto border-b border-pp-line bg-pp-shell/60 px-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="pp-tab whitespace-nowrap"
            data-active={activeFileId === tab.id}
            onClick={() => onSelectTab(tab.id)}
          >
            <span className="font-mono text-[12.5px]">{tab.name}</span>
          </button>
        ))}
      </div>

      <div
        className={cn(
          'grid min-h-0 flex-1',
          stacked ? 'grid-rows-2' : 'grid-rows-2 lg:grid-cols-2 lg:grid-rows-1',
        )}
      >
        <EditorColumn
          title="Pseudocode"
          path="src/main.pseudo"
          code={pseudocode}
          language="pseudocode"
          emphasis={activeFileId.includes('pseudo') || activeFileId.startsWith('ex')}
        />
        <EditorColumn
          title="Python"
          path="src/main.py"
          code={python}
          language="python"
          emphasis={activeFileId.includes('py')}
          bordered
        />
      </div>
    </div>
  );
}

function EditorColumn({
  title,
  path,
  code,
  language,
  emphasis,
  bordered,
}: {
  title: string;
  path: string;
  code: string;
  language: 'pseudocode' | 'python';
  emphasis?: boolean;
  bordered?: boolean;
}) {
  return (
    <section
      className={cn(
        'flex min-h-0 flex-col transition-colors duration-200 ease-apple',
        bordered && 'border-t border-pp-line lg:border-l lg:border-t-0',
        emphasis ? 'bg-pp-editor' : 'bg-[#fbfbfc]',
      )}
    >
      <div className="flex h-8 items-center justify-between px-3.5">
        <h3 className="text-[12px] font-medium tracking-[-0.01em] text-pp-muted">{title}</h3>
        <span className="font-mono text-[11px] text-pp-faint">{path}</span>
      </div>
      <CodeSurface code={code} language={language} />
    </section>
  );
}
