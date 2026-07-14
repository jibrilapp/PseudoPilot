export type FileNode = {
  id: string;
  name: string;
  type: 'file' | 'folder';
  language?: 'pseudocode' | 'python' | 'markdown';
  children?: FileNode[];
};

export type EditorTab = {
  id: string;
  name: string;
  language: 'pseudocode' | 'python';
  path: string;
};

export type VariableRow = {
  name: string;
  type: string;
  value: string;
  scope: 'local' | 'global';
};

export type AiMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
};

export type ConsoleLine = {
  id: string;
  kind: 'out' | 'in' | 'info' | 'error';
  text: string;
};

export const DUMMY_FILES: FileNode[] = [
  {
    id: 'src',
    name: 'src',
    type: 'folder',
    children: [
      { id: 'main-pseudo', name: 'main.pseudo', type: 'file', language: 'pseudocode' },
      { id: 'main-py', name: 'main.py', type: 'file', language: 'python' },
      { id: 'helpers-pseudo', name: 'helpers.pseudo', type: 'file', language: 'pseudocode' },
    ],
  },
  {
    id: 'exercises',
    name: 'exercises',
    type: 'folder',
    children: [
      { id: 'ex01', name: '01-loops.pseudo', type: 'file', language: 'pseudocode' },
      { id: 'ex02', name: '02-arrays.pseudo', type: 'file', language: 'pseudocode' },
    ],
  },
  { id: 'readme', name: 'README.md', type: 'file', language: 'markdown' },
];

export const DUMMY_TABS: EditorTab[] = [
  {
    id: 'main-pseudo',
    name: 'main.pseudo',
    language: 'pseudocode',
    path: 'src/main.pseudo',
  },
  {
    id: 'main-py',
    name: 'main.py',
    language: 'python',
    path: 'src/main.py',
  },
];

export const DUMMY_PSEUDOCODE = `DECLARE Count : INTEGER
DECLARE Total : INTEGER
DECLARE Name : STRING

PROCEDURE Greeting(Name : STRING)
    OUTPUT "Hello, ", Name
ENDPROCEDURE

Total ← 0
FOR Count ← 1 TO 5
    Total ← Total + Count
    OUTPUT Count, " → running total = ", Total
NEXT Count

CALL Greeting("PseudoPilot")
OUTPUT "Done."`;

export const DUMMY_PYTHON = `count: int
total: int
name: str

def greeting(name: str) -> None:
    print(f"Hello, {name}")

total = 0
for count in range(1, 6):
    total = total + count
    print(f"{count} → running total = {total}")

greeting("PseudoPilot")
print("Done.")`;

export const DUMMY_CONSOLE: ConsoleLine[] = [
  { id: 'c1', kind: 'info', text: 'PseudoPilot runtime (preview) — dummy output' },
  { id: 'c2', kind: 'out', text: '1 → running total = 1' },
  { id: 'c3', kind: 'out', text: '2 → running total = 3' },
  { id: 'c4', kind: 'out', text: '3 → running total = 6' },
  { id: 'c5', kind: 'out', text: '4 → running total = 10' },
  { id: 'c6', kind: 'out', text: '5 → running total = 15' },
  { id: 'c7', kind: 'out', text: 'Hello, PseudoPilot' },
  { id: 'c8', kind: 'out', text: 'Done.' },
];

export const DUMMY_VARIABLES: VariableRow[] = [
  { name: 'Count', type: 'INTEGER', value: '5', scope: 'global' },
  { name: 'Total', type: 'INTEGER', value: '15', scope: 'global' },
  { name: 'Name', type: 'STRING', value: '"PseudoPilot"', scope: 'global' },
  { name: 'i', type: 'INTEGER', value: '—', scope: 'local' },
];

export const DUMMY_AI: AiMessage[] = [
  {
    id: 'a1',
    role: 'assistant',
    content:
      'This FOR loop accumulates 1…5 into Total. Want a hint on how NEXT Count maps to Python’s range?',
  },
  {
    id: 'a2',
    role: 'user',
    content: 'Yes — show the mapping without rewriting my whole program.',
  },
  {
    id: 'a3',
    role: 'assistant',
    content:
      'FOR Count ← 1 TO 5 … NEXT Count ≈ for count in range(1, 6):. Assignment ← becomes =. OUTPUT maps to print.',
  },
];
