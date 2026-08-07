/**
 * Cambridge-flavoured starter examples for the welcome screen.
 * Presentation-only — not part of the language conformance corpus.
 */

export type WelcomeExample = {
  readonly id: string;
  readonly title: string;
  readonly blurb: string;
  readonly group: 'starter' | 'cambridge';
  readonly source: string;
};

export const WELCOME_EXAMPLES: readonly WelcomeExample[] = [
  {
    id: 'hello-io',
    title: 'INPUT / OUTPUT',
    blurb: 'Read a number and print its square.',
    group: 'starter',
    source: `DECLARE N : INTEGER
OUTPUT "Enter a number:"
INPUT N
OUTPUT "Squared =", N * N
`,
  },
  {
    id: 'for-sum',
    title: 'FOR loop',
    blurb: 'Accumulate 1…5 into Total.',
    group: 'starter',
    source: `DECLARE Total : INTEGER
DECLARE Count : INTEGER
Total ← 0
FOR Count ← 1 TO 5
    Total ← Total + Count
NEXT Count
OUTPUT "Total =", Total
`,
  },
  {
    id: 'while-guard',
    title: 'WHILE loop',
    blurb: 'Count down until zero.',
    group: 'starter',
    source: `DECLARE N : INTEGER
N ← 5
WHILE N > 0
    OUTPUT N
    N ← N - 1
ENDWHILE
`,
  },
  {
    id: 'array-linear',
    title: '1D array scan',
    blurb: 'Find the largest value in an array.',
    group: 'cambridge',
    source: `DECLARE Scores : ARRAY[1:5] OF INTEGER
DECLARE i : INTEGER
DECLARE Max : INTEGER
Scores[1] ← 12
Scores[2] ← 27
Scores[3] ← 9
Scores[4] ← 31
Scores[5] ← 18
Max ← Scores[1]
FOR i ← 2 TO 5
    IF Scores[i] > Max THEN
        Max ← Scores[i]
    ENDIF
NEXT i
OUTPUT "Max =", Max
`,
  },
  {
    id: 'procedure-params',
    title: 'PROCEDURE',
    blurb: 'Pass parameters and print a greeting.',
    group: 'cambridge',
    source: `PROCEDURE Greet(Name : STRING)
    OUTPUT "Hello,", Name
ENDPROCEDURE

CALL Greet("Cambridge")
`,
  },
  {
    id: 'function-return',
    title: 'FUNCTION',
    blurb: 'Return a computed INTEGER.',
    group: 'cambridge',
    source: `FUNCTION Double(N : INTEGER) RETURNS INTEGER
    RETURN N * 2
ENDFUNCTION

OUTPUT Double(21)
`,
  },
];

export function welcomeExampleById(id: string): WelcomeExample | undefined {
  return WELCOME_EXAMPLES.find((e) => e.id === id);
}

export const NEW_FILE_TEMPLATE = `// New Pseudocode file
DECLARE Message : STRING
Message ← "Hello, PseudoPilot"
OUTPUT Message
`;
