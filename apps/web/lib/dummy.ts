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

export const DUMMY_PSEUDOCODE = `// PseudoPilot — Run executes the Cambridge interpreter (not Python)
DECLARE Name : STRING
DECLARE N : INTEGER
OUTPUT "Enter a number:"
INPUT N
OUTPUT "Squared =", N * N
`;

export const DUMMY_PYTHON = `Name = ""  # STRING
N = 0  # INTEGER
print("Enter a number:")
N = int(input())
print("Squared =", N * N)
`;

export const DUMMY_CONSOLE: ConsoleLine[] = [
  {
    id: 'c1',
    kind: 'info',
    text: 'Press Run to execute Cambridge pseudocode',
  },
];

export const DUMMY_VARIABLES: VariableRow[] = [];

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
