/**
 * Growing Cambridge 9618–style corpus.
 * Each entry is a program expected to parse, check, and (usually) run.
 */

export type CorpusEntry = {
  readonly id: string;
  readonly title: string;
  readonly source: string;
  /** Expected console outputs when run with `inputs` (if runnable). */
  readonly expectOutput?: readonly string[];
  readonly inputs?: readonly string[];
  /** Skip interpreter (e.g. interactive-only edge). */
  readonly skipRun?: boolean;
  /** Skip Python round-trip (known translator gap). */
  readonly skipRoundTrip?: boolean;
  readonly tags: readonly string[];
};

export const CORPUS: readonly CorpusEntry[] = [
  {
    id: 'assign-basic',
    title: 'Assignment and OUTPUT',
    source: `
DECLARE N : INTEGER
N ← 42
OUTPUT N
`,
    expectOutput: ['42'],
    tags: ['assign', 'declare', 'output'],
  },
  {
    id: 'expr-arith',
    title: 'Arithmetic expressions',
    source: `
DECLARE A, B, C : INTEGER
A ← 10
B ← 3
C ← A + B * 2 - A DIV B
OUTPUT C
`,
    expectOutput: ['13'],
    tags: ['expr', 'declare'],
  },
  {
    id: 'constant',
    title: 'CONSTANT literal',
    source: `
CONSTANT Max = 10
DECLARE X : INTEGER
X ← Max
OUTPUT X
`,
    expectOutput: ['10'],
    tags: ['constant', 'declare'],
  },
  {
    id: 'string-concat',
    title: 'String & concat + LENGTH',
    source: `
DECLARE S : STRING
S ← "Hello" & " " & "World"
OUTPUT S
OUTPUT LENGTH(S)
`,
    expectOutput: ['Hello World', '11'],
    tags: ['string', 'builtin'],
  },
  {
    id: 'array-1d',
    title: '1D ARRAY',
    source: `
DECLARE Scores : ARRAY[1:3] OF INTEGER
Scores[1] ← 10
Scores[2] ← 20
Scores[3] ← Scores[1] + Scores[2]
OUTPUT Scores[3]
`,
    expectOutput: ['30'],
    tags: ['array'],
  },
  {
    id: 'if-nested',
    title: 'Nested IF',
    source: `
DECLARE N : INTEGER
N ← 5
IF N > 0 THEN
  IF N > 3 THEN
    OUTPUT "big"
  ELSE
    OUTPUT "small"
  ENDIF
ELSE
  OUTPUT "neg"
ENDIF
`,
    expectOutput: ['big'],
    tags: ['if'],
  },
  {
    id: 'case-of',
    title: 'CASE OF',
    source: `
DECLARE Grade : CHAR
Grade ← 'B'
CASE OF Grade
  'A' : OUTPUT "Excellent"
  'B' : OUTPUT "Good"
  OTHERWISE : OUTPUT "Other"
ENDCASE
`,
    expectOutput: ['Good'],
    tags: ['case'],
  },
  {
    id: 'for-loop',
    title: 'FOR loop',
    source: `
DECLARE I, Sum : INTEGER
Sum ← 0
FOR I ← 1 TO 5
  Sum ← Sum + I
NEXT I
OUTPUT Sum
`,
    expectOutput: ['15'],
    tags: ['for'],
  },
  {
    id: 'while-loop',
    title: 'WHILE loop',
    source: `
DECLARE N : INTEGER
N ← 3
WHILE N > 0
  OUTPUT N
  N ← N - 1
ENDWHILE
`,
    expectOutput: ['3', '2', '1'],
    tags: ['while'],
  },
  {
    id: 'repeat-until',
    title: 'REPEAT UNTIL',
    source: `
DECLARE N : INTEGER
N ← 1
REPEAT
  OUTPUT N
  N ← N + 1
UNTIL N > 3
`,
    expectOutput: ['1', '2', '3'],
    tags: ['repeat'],
  },
  {
    id: 'procedure',
    title: 'PROCEDURE + CALL',
    source: `
PROCEDURE Greet
  OUTPUT "hi"
ENDPROCEDURE
CALL Greet
`,
    expectOutput: ['hi'],
    tags: ['procedure'],
  },
  {
    id: 'function',
    title: 'FUNCTION + RETURN',
    source: `
FUNCTION Double(X : INTEGER) RETURNS INTEGER
  RETURN X * 2
ENDFUNCTION
OUTPUT Double(21)
`,
    expectOutput: ['42'],
    tags: ['function'],
  },
  {
    id: 'recursion-fact',
    title: 'Recursive factorial',
    source: `
FUNCTION Fact(N : INTEGER) RETURNS INTEGER
  IF N <= 1 THEN
    RETURN 1
  ELSE
    RETURN N * Fact(N - 1)
  ENDIF
ENDFUNCTION
OUTPUT Fact(5)
`,
    expectOutput: ['120'],
    tags: ['function', 'recursion'],
  },
  {
    id: 'builtins-string',
    title: 'Core string builtins',
    source: `
OUTPUT LEFT("ABCDEF", 3)
OUTPUT RIGHT("ABCDEF", 2)
OUTPUT MID("ABCDEF", 2, 3)
OUTPUT LCASE("AbC")
OUTPUT UCASE("AbC")
OUTPUT INT(3.9)
`,
    expectOutput: ['ABC', 'EF', 'BCD', 'abc', 'ABC', '3'],
    tags: ['builtin', 'string'],
  },
  {
    id: 'input-output',
    title: 'INPUT / OUTPUT',
    source: `
DECLARE Name : STRING
INPUT Name
OUTPUT "Hello " & Name
`,
    inputs: ['Ada'],
    expectOutput: ['Hello Ada'],
    tags: ['input', 'output', 'string'],
  },
  {
    id: 'file-io',
    title: 'Text file I/O',
    source: `
DECLARE Line : STRING
OPENFILE "note.txt" FOR WRITE
WRITEFILE "note.txt", "line1"
CLOSEFILE "note.txt"
OPENFILE "note.txt" FOR READ
READFILE "note.txt", Line
CLOSEFILE "note.txt"
OUTPUT Line
`,
    expectOutput: ['line1'],
    tags: ['file'],
  },
  {
    id: 'mixed-control',
    title: 'Mixed control + procedure',
    source: `
PROCEDURE Show(N : INTEGER)
  DECLARE I : INTEGER
  FOR I ← 1 TO N
    IF I MOD 2 = 0 THEN
      OUTPUT I
    ENDIF
  NEXT I
ENDPROCEDURE
CALL Show(4)
`,
    expectOutput: ['2', '4'],
    tags: ['procedure', 'for', 'if'],
  },
  {
    id: 'type-record',
    title: 'TYPE record field access',
    source: `
TYPE Point
  DECLARE X : INTEGER
  DECLARE Y : INTEGER
ENDTYPE
DECLARE P : Point
P.X ← 3
P.Y ← 4
OUTPUT P.X + P.Y
`,
    expectOutput: ['7'],
    tags: ['type', 'record'],
  },
  {
    id: 'class-inherit',
    title: 'CLASS with inheritance and method call',
    source: `
CLASS Pet
  PRIVATE Name : STRING
  PUBLIC PROCEDURE NEW(GivenName : STRING)
    Name ← GivenName
  ENDPROCEDURE
  PUBLIC FUNCTION GetName() RETURNS STRING
    RETURN Name
  ENDFUNCTION
ENDCLASS
CLASS Cat INHERITS Pet
  PRIVATE Breed : STRING
  PUBLIC PROCEDURE NEW(GivenName : STRING, GivenBreed : STRING)
    SUPER.NEW(GivenName)
    Breed ← GivenBreed
  ENDPROCEDURE
ENDCLASS
DECLARE MyCat : Cat
MyCat ← NEW Cat("Kitty", "Shorthaired")
OUTPUT MyCat.GetName()
`,
    expectOutput: ['Kitty'],
    tags: ['class', 'oop', 'inheritance'],
  },
  {
    id: 'date-basics',
    title: 'DATE declare, compare, builtins',
    source: `
DECLARE D : DATE
D ← SETDATE(4, 10, 2003)
OUTPUT YEAR(D)
OUTPUT MONTH(D)
OUTPUT DAY(D)
IF D = 04/10/2003 THEN
  OUTPUT "date-match"
ENDIF
IF D < SETDATE(5, 10, 2003) THEN
  OUTPUT "date-before"
ENDIF
`,
    expectOutput: ['2003', '10', '4', 'date-match', 'date-before'],
    tags: ['date'],
  },
];

export function corpusByTag(tag: string): readonly CorpusEntry[] {
  return CORPUS.filter((e) => e.tags.includes(tag));
}

export function corpusIds(): readonly string[] {
  return CORPUS.map((e) => e.id);
}
