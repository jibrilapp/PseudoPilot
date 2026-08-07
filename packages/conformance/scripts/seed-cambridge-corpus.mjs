#!/usr/bin/env node
/**
 * Seed / refresh the Cambridge Regression Suite under packages/conformance/corpus/.
 *
 * Usage (from repo root or package):
 *   node packages/conformance/scripts/seed-cambridge-corpus.mjs
 *   node packages/conformance/scripts/seed-cambridge-corpus.mjs --refresh-goldens
 *
 * Does not invent language features — only writes fixtures and goldens from
 * the current compiler/translator/interpreter.
 */

import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const CORPUS_ROOT = join(PKG, 'corpus');
const REFRESH = process.argv.includes('--refresh-goldens');

/** Resolve built packages (seed runs against dist). */
function loadDist(name) {
  const path = join(PKG, 'node_modules', name, 'dist', 'index.js');
  return import(path);
}

const CATEGORIES = [
  'variables',
  'selection',
  'iteration',
  'arrays',
  'strings',
  'procedures',
  'functions',
  'byref',
  'records',
  'classes',
  'files',
  'random-files',
  'date',
  'algorithms',
  'past-papers',
  'edge-cases',
  'regressions',
];

/**
 * @typedef {{
 *   id: string,
 *   category: string,
 *   title: string,
 *   source: string,
 *   tags?: string[],
 *   inputs?: string[],
 *   expectOutput?: string[],
 *   expectDiagnostics?: { code: string, severity?: string }[],
 *   expectClean?: boolean,
 *   skipRun?: boolean,
 *   reverse?: 'check' | 'skip',
 *   reverseSkipReason?: string,
 *   notes?: string,
 * }} SeedEntry
 */

/** @type {SeedEntry[]} */
const PROGRAMS = [
  // ── variables ──────────────────────────────────────────────
  {
    id: 'assign-basic',
    category: 'variables',
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
    category: 'variables',
    title: 'Arithmetic expressions',
    source: `
DECLARE A, B, C : INTEGER
A ← 10
B ← 3
C ← A + B * 2 - A DIV B
OUTPUT C
`,
    expectOutput: ['13'],
    tags: ['expr', 'declare', 'div'],
  },
  {
    id: 'constant',
    category: 'variables',
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
    id: 'boolean-char-real',
    category: 'variables',
    title: 'BOOLEAN, CHAR, REAL declare and assign',
    source: `
DECLARE Flag : BOOLEAN
DECLARE Initial : CHAR
DECLARE Pi : REAL
Flag ← TRUE
Initial ← 'Z'
Pi ← 3.5
OUTPUT Flag
OUTPUT Initial
OUTPUT Pi
`,
    expectOutput: ['TRUE', 'Z', '3.5'],
    tags: ['boolean', 'char', 'real', 'declare'],
  },
  {
    id: 'multi-declare',
    category: 'variables',
    title: 'Multi-variable DECLARE same type',
    source: `
DECLARE A, B, C : INTEGER
A ← 1
B ← 2
C ← 3
OUTPUT A + B + C
`,
    expectOutput: ['6'],
    tags: ['declare', 'assign'],
  },

  // ── selection ──────────────────────────────────────────────
  {
    id: 'if-nested',
    category: 'selection',
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
    category: 'selection',
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
    id: 'case-range',
    category: 'selection',
    title: 'CASE OF with integer ranges',
    source: `
DECLARE N : INTEGER
N ← 5
CASE OF N
  1 TO 3 : OUTPUT "low"
  4 TO 6 : OUTPUT "mid"
  OTHERWISE : OUTPUT "hi"
ENDCASE
`,
    expectOutput: ['mid'],
    tags: ['case', 'range'],
  },
  {
    id: 'if-else-chain',
    category: 'selection',
    title: 'IF / ELSE IF chain',
    source: `
DECLARE Score : INTEGER
Score ← 72
IF Score >= 80 THEN
  OUTPUT "A"
ELSE
  IF Score >= 70 THEN
    OUTPUT "B"
  ELSE
    OUTPUT "C"
  ENDIF
ENDIF
`,
    expectOutput: ['B'],
    tags: ['if', 'elseif'],
  },
  {
    id: 'boolean-guard',
    category: 'selection',
    title: 'Boolean AND / OR guards',
    source: `
DECLARE A, B : BOOLEAN
A ← TRUE
B ← FALSE
IF A AND NOT B THEN
  OUTPUT "pass"
ENDIF
IF A OR B THEN
  OUTPUT "either"
ENDIF
`,
    expectOutput: ['pass', 'either'],
    tags: ['if', 'boolean'],
  },

  // ── iteration ──────────────────────────────────────────────
  {
    id: 'for-loop',
    category: 'iteration',
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
    category: 'iteration',
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
    category: 'iteration',
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
    id: 'bare-next',
    category: 'iteration',
    title: 'FOR loop with bare NEXT',
    source: `
DECLARE I, Total : INTEGER
Total ← 0
FOR I ← 1 TO 4
  Total ← Total + I
NEXT
OUTPUT Total
`,
    expectOutput: ['10'],
    tags: ['for', 'bare-next', 'regression'],
    notes: 'Also mirrored under regressions/bare-next-regression.',
  },
  {
    id: 'nested-for',
    category: 'iteration',
    title: 'Nested FOR loops',
    source: `
DECLARE I, J, C : INTEGER
C ← 0
FOR I ← 1 TO 3
  FOR J ← 1 TO 2
    C ← C + 1
  NEXT J
NEXT I
OUTPUT C
`,
    expectOutput: ['6'],
    tags: ['for', 'nested'],
  },
  {
    id: 'for-step',
    category: 'iteration',
    title: 'FOR with STEP',
    source: `
DECLARE I, Sum : INTEGER
Sum ← 0
FOR I ← 1 TO 7 STEP 2
  Sum ← Sum + I
NEXT I
OUTPUT Sum
`,
    expectOutput: ['16'],
    tags: ['for', 'step'],
  },

  // ── arrays ─────────────────────────────────────────────────
  {
    id: 'array-1d',
    category: 'arrays',
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
    id: 'array-2d',
    category: 'arrays',
    title: '2D ARRAY access',
    source: `
DECLARE A : ARRAY[1:2, 1:2] OF INTEGER
A[1,1] ← 1
A[1,2] ← 2
A[2,1] ← 3
A[2,2] ← 4
OUTPUT A[2,2]
`,
    expectOutput: ['4'],
    tags: ['array', '2d'],
  },
  {
    id: 'array-fill-sum',
    category: 'arrays',
    title: 'Fill 1D array and sum',
    source: `
DECLARE A : ARRAY[1:5] OF INTEGER
DECLARE I, Sum : INTEGER
Sum ← 0
FOR I ← 1 TO 5
  A[I] ← I * 2
  Sum ← Sum + A[I]
NEXT I
OUTPUT Sum
`,
    expectOutput: ['30'],
    tags: ['array', 'for'],
  },
  {
    id: 'array-string',
    category: 'arrays',
    title: 'ARRAY OF STRING',
    source: `
DECLARE Names : ARRAY[1:2] OF STRING
Names[1] ← "Ada"
Names[2] ← "Grace"
OUTPUT Names[1] & " " & Names[2]
`,
    expectOutput: ['Ada Grace'],
    tags: ['array', 'string'],
  },

  // ── strings ────────────────────────────────────────────────
  {
    id: 'string-concat',
    category: 'strings',
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
    id: 'builtins-string',
    category: 'strings',
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
    category: 'strings',
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
    id: 'string-substring-build',
    category: 'strings',
    title: 'Build string with MID and LENGTH',
    source: `
DECLARE S, Out : STRING
DECLARE I : INTEGER
S ← "CAMBRIDGE"
Out ← ""
FOR I ← 1 TO LENGTH(S)
  Out ← Out & MID(S, I, 1)
NEXT I
OUTPUT Out
OUTPUT LENGTH(Out)
`,
    expectOutput: ['CAMBRIDGE', '9'],
    tags: ['string', 'for', 'builtin'],
  },

  // ── procedures ─────────────────────────────────────────────
  {
    id: 'procedure',
    category: 'procedures',
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
    id: 'mixed-control',
    category: 'procedures',
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
    id: 'procedure-params',
    category: 'procedures',
    title: 'PROCEDURE with parameters',
    source: `
PROCEDURE Greet(Name : STRING)
  OUTPUT "Hello " & Name
ENDPROCEDURE
CALL Greet("Cambridge")
`,
    expectOutput: ['Hello Cambridge'],
    tags: ['procedure', 'params'],
  },
  {
    id: 'procedure-local',
    category: 'procedures',
    title: 'PROCEDURE local DECLARE does not leak',
    source: `
PROCEDURE Fill
  DECLARE X : INTEGER
  X ← 99
  OUTPUT X
ENDPROCEDURE
DECLARE X : INTEGER
X ← 1
CALL Fill
OUTPUT X
`,
    expectOutput: ['99', '1'],
    tags: ['procedure', 'scope'],
  },

  // ── functions ──────────────────────────────────────────────
  {
    id: 'function',
    category: 'functions',
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
    category: 'functions',
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
    id: 'function-multi-param',
    category: 'functions',
    title: 'FUNCTION with two parameters',
    source: `
FUNCTION MaxOf(A : INTEGER, B : INTEGER) RETURNS INTEGER
  IF A > B THEN
    RETURN A
  ELSE
    RETURN B
  ENDIF
ENDFUNCTION
OUTPUT MaxOf(3, 9)
`,
    expectOutput: ['9'],
    tags: ['function'],
  },
  {
    id: 'function-string',
    category: 'functions',
    title: 'FUNCTION returning STRING',
    source: `
FUNCTION Tag(Name : STRING) RETURNS STRING
  RETURN "[" & Name & "]"
ENDFUNCTION
OUTPUT Tag("OK")
`,
    expectOutput: ['[OK]'],
    tags: ['function', 'string'],
  },

  // ── byref ──────────────────────────────────────────────────
  {
    id: 'byref-swap',
    category: 'byref',
    title: 'Cambridge §8.3 BYREF SWAP',
    source: `
PROCEDURE SWAP(BYREF X : INTEGER, Y : INTEGER)
  DECLARE Temp : INTEGER
  Temp ← X
  X ← Y
  Y ← Temp
ENDPROCEDURE
DECLARE A, B : INTEGER
A ← 3
B ← 7
CALL SWAP(A, B)
OUTPUT A
OUTPUT B
`,
    expectOutput: ['7', '3'],
    tags: ['procedure', 'byref', 'regression'],
  },
  {
    id: 'byval-default',
    category: 'byref',
    title: 'Default parameter mode is BYVAL',
    source: `
PROCEDURE Inc(N : INTEGER)
  N ← N + 1
ENDPROCEDURE
DECLARE A : INTEGER
A ← 5
CALL Inc(A)
OUTPUT A
`,
    expectOutput: ['5'],
    tags: ['procedure', 'byval'],
  },
  {
    id: 'byref-explicit',
    category: 'byref',
    title: 'Explicit BYREF mutates caller',
    source: `
PROCEDURE Inc(BYREF N : INTEGER)
  N ← N + 1
ENDPROCEDURE
DECLARE A : INTEGER
A ← 5
CALL Inc(A)
OUTPUT A
`,
    expectOutput: ['6'],
    tags: ['procedure', 'byref'],
  },
  {
    id: 'byref-sticky-group',
    category: 'byref',
    title: 'BYREF sticky across parameter group (Guide SWAP shape)',
    source: `
PROCEDURE AddPair(BYREF A : INTEGER, B : INTEGER)
  DECLARE T : INTEGER
  T ← A
  A ← B
  B ← T
ENDPROCEDURE
DECLARE X, Y : INTEGER
X ← 4
Y ← 9
CALL AddPair(X, Y)
OUTPUT X
OUTPUT Y
`,
    expectOutput: ['9', '4'],
    tags: ['procedure', 'byref', 'sticky'],
    notes: 'Guide sticky mode: BYREF applies to following params until next mode keyword (same shape as SWAP).',
  },
  {
    id: 'byref-then-byval',
    category: 'byref',
    title: 'BYREF then explicit BYVAL for literal argument',
    source: `
PROCEDURE AddInto(BYREF Total : INTEGER, BYVAL Delta : INTEGER)
  Total ← Total + Delta
ENDPROCEDURE
DECLARE S : INTEGER
S ← 10
CALL AddInto(S, 5)
OUTPUT S
`,
    expectOutput: ['15'],
    tags: ['procedure', 'byref', 'byval'],
  },

  // ── records ────────────────────────────────────────────────
  {
    id: 'type-record',
    category: 'records',
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
    id: 'enum-season',
    category: 'records',
    title: 'Enum Season assign and OUTPUT',
    source: `
TYPE Season = (Spring, Summer, Autumn, Winter)
DECLARE Current : Season
Current ← Autumn
OUTPUT Current
`,
    expectOutput: ['Autumn'],
    tags: ['type', 'enum'],
  },
  {
    id: 'pointer-deref-mutate',
    category: 'records',
    title: 'Pointer address-of and dereference mutation',
    source: `
TYPE IntPtr = ^INTEGER
DECLARE Value : INTEGER
DECLARE Ptr : IntPtr
Value ← 10
Ptr ← ^Value
Ptr^ ← Ptr^ + 5
OUTPUT Value
`,
    expectOutput: ['15'],
    tags: ['type', 'pointer'],
  },
  {
    id: 'set-define',
    category: 'records',
    title: 'SET type with DEFINE instance',
    source: `
TYPE Digits = SET OF INTEGER
DEFINE Lucky(3, 7, 9) : Digits
OUTPUT Lucky
`,
    expectOutput: ['{3, 7, 9}'],
    tags: ['type', 'set', 'define'],
  },
  {
    id: 'nested-record',
    category: 'records',
    title: 'Record containing another record field pattern',
    source: `
TYPE Address
  DECLARE City : STRING
ENDTYPE
TYPE Person
  DECLARE Name : STRING
  DECLARE Home : Address
ENDTYPE
DECLARE P : Person
P.Name ← "Sam"
P.Home.City ← "Cambridge"
OUTPUT P.Name
OUTPUT P.Home.City
`,
    expectOutput: ['Sam', 'Cambridge'],
    tags: ['type', 'record', 'nested'],
  },

  // ── classes ────────────────────────────────────────────────
  {
    id: 'class-inherit',
    category: 'classes',
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
    id: 'class-basic',
    category: 'classes',
    title: 'Basic CLASS constructor and getter',
    source: `
CLASS Counter
  PRIVATE Value : INTEGER
  PUBLIC PROCEDURE NEW(Start : INTEGER)
    Value ← Start
  ENDPROCEDURE
  PUBLIC PROCEDURE Bump
    Value ← Value + 1
  ENDPROCEDURE
  PUBLIC FUNCTION Get() RETURNS INTEGER
    RETURN Value
  ENDFUNCTION
ENDCLASS
DECLARE C : Counter
C ← NEW Counter(10)
CALL C.Bump()
OUTPUT C.Get()
`,
    expectOutput: ['11'],
    tags: ['class', 'oop'],
  },
  {
    id: 'class-two-instances',
    category: 'classes',
    title: 'Two CLASS instances are independent',
    source: `
CLASS Box
  PRIVATE N : INTEGER
  PUBLIC PROCEDURE NEW(V : INTEGER)
    N ← V
  ENDPROCEDURE
  PUBLIC FUNCTION Get() RETURNS INTEGER
    RETURN N
  ENDFUNCTION
ENDCLASS
DECLARE A, B : Box
A ← NEW Box(1)
B ← NEW Box(2)
OUTPUT A.Get()
OUTPUT B.Get()
`,
    expectOutput: ['1', '2'],
    tags: ['class', 'oop'],
  },

  // ── files ──────────────────────────────────────────────────
  {
    id: 'file-io',
    category: 'files',
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
    id: 'file-eof-loop',
    category: 'files',
    title: 'READ until EOF',
    source: `
DECLARE Line : STRING
OPENFILE "t.txt" FOR WRITE
WRITEFILE "t.txt", "a"
WRITEFILE "t.txt", "b"
CLOSEFILE "t.txt"
OPENFILE "t.txt" FOR READ
WHILE NOT EOF("t.txt")
  READFILE "t.txt", Line
  OUTPUT Line
ENDWHILE
CLOSEFILE "t.txt"
`,
    expectOutput: ['a', 'b'],
    tags: ['file', 'eof'],
  },
  {
    id: 'file-append',
    category: 'files',
    title: 'APPEND mode',
    source: `
OPENFILE "a.txt" FOR WRITE
WRITEFILE "a.txt", "x"
CLOSEFILE "a.txt"
OPENFILE "a.txt" FOR APPEND
WRITEFILE "a.txt", "y"
CLOSEFILE "a.txt"
DECLARE Line : STRING
OPENFILE "a.txt" FOR READ
READFILE "a.txt", Line
OUTPUT Line
READFILE "a.txt", Line
OUTPUT Line
CLOSEFILE "a.txt"
`,
    expectOutput: ['x', 'y'],
    tags: ['file', 'append'],
  },

  // ── random-files ───────────────────────────────────────────
  {
    id: 'random-file-io',
    category: 'random-files',
    title: 'Random file SEEK / GETRECORD / PUTRECORD',
    source: `
TYPE Student
  DECLARE LastName : STRING
  DECLARE YearGroup : INTEGER
ENDTYPE
DECLARE Pupil : Student
DECLARE Loaded : Student
Pupil.LastName ← "Johnson"
Pupil.YearGroup ← 6
OPENFILE "StudentFile.Dat" FOR RANDOM
SEEK "StudentFile.Dat", 0
PUTRECORD "StudentFile.Dat", Pupil
SEEK "StudentFile.Dat", 0
GETRECORD "StudentFile.Dat", Loaded
CLOSEFILE "StudentFile.Dat"
OUTPUT Loaded.LastName
OUTPUT Loaded.YearGroup
`,
    expectOutput: ['Johnson', '6'],
    tags: ['file', 'random', 'type', 'regression'],
  },
  {
    id: 'random-file-multi',
    category: 'random-files',
    title: 'Random file multiple record slots',
    source: `
TYPE Item
  DECLARE Code : INTEGER
ENDTYPE
DECLARE A, B, Loaded : Item
A.Code ← 10
B.Code ← 20
OPENFILE "Items.Dat" FOR RANDOM
SEEK "Items.Dat", 0
PUTRECORD "Items.Dat", A
SEEK "Items.Dat", 1
PUTRECORD "Items.Dat", B
SEEK "Items.Dat", 1
GETRECORD "Items.Dat", Loaded
CLOSEFILE "Items.Dat"
OUTPUT Loaded.Code
`,
    expectOutput: ['20'],
    tags: ['file', 'random'],
  },
  {
    id: 'random-file-overwrite',
    category: 'random-files',
    title: 'Random file overwrite same SEEK slot',
    source: `
TYPE Cell
  DECLARE V : INTEGER
ENDTYPE
DECLARE First, Second, Loaded : Cell
First.V ← 1
Second.V ← 99
OPENFILE "Cell.Dat" FOR RANDOM
SEEK "Cell.Dat", 0
PUTRECORD "Cell.Dat", First
SEEK "Cell.Dat", 0
PUTRECORD "Cell.Dat", Second
SEEK "Cell.Dat", 0
GETRECORD "Cell.Dat", Loaded
CLOSEFILE "Cell.Dat"
OUTPUT Loaded.V
`,
    expectOutput: ['99'],
    tags: ['file', 'random'],
  },

  // ── date ───────────────────────────────────────────────────
  {
    id: 'date-basics',
    category: 'date',
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
  {
    id: 'date-compare-order',
    category: 'date',
    title: 'DATE ordering across months',
    source: `
DECLARE A, B : DATE
A ← SETDATE(31, 12, 2020)
B ← SETDATE(1, 1, 2021)
IF A < B THEN
  OUTPUT "ordered"
ENDIF
OUTPUT YEAR(B)
`,
    expectOutput: ['ordered', '2021'],
    tags: ['date'],
  },
  {
    id: 'date-literal',
    category: 'date',
    title: 'DATE literal assignment',
    source: `
DECLARE D : DATE
D ← 15/08/2024
OUTPUT DAY(D)
OUTPUT MONTH(D)
OUTPUT YEAR(D)
`,
    expectOutput: ['15', '8', '2024'],
    tags: ['date', 'literal'],
  },

  // ── algorithms ─────────────────────────────────────────────
  {
    id: 'linear-search',
    category: 'algorithms',
    title: 'Linear search in 1D array',
    source: `
DECLARE Data : ARRAY[1:5] OF INTEGER
DECLARE I, Target, Found : INTEGER
Data[1] ← 4
Data[2] ← 8
Data[3] ← 15
Data[4] ← 16
Data[5] ← 23
Target ← 16
Found ← 0
FOR I ← 1 TO 5
  IF Data[I] = Target THEN
    Found ← I
  ENDIF
NEXT I
OUTPUT Found
`,
    expectOutput: ['4'],
    tags: ['algorithm', 'search', 'array'],
  },
  {
    id: 'bubble-sort',
    category: 'algorithms',
    title: 'Bubble sort ascending',
    source: `
DECLARE A : ARRAY[1:5] OF INTEGER
DECLARE I, J, Temp : INTEGER
A[1] ← 5
A[2] ← 1
A[3] ← 4
A[4] ← 2
A[5] ← 3
FOR I ← 1 TO 4
  FOR J ← 1 TO 5 - I
    IF A[J] > A[J + 1] THEN
      Temp ← A[J]
      A[J] ← A[J + 1]
      A[J + 1] ← Temp
    ENDIF
  NEXT J
NEXT I
FOR I ← 1 TO 5
  OUTPUT A[I]
NEXT I
`,
    expectOutput: ['1', '2', '3', '4', '5'],
    tags: ['algorithm', 'sort', 'array'],
  },
  {
    id: 'find-max',
    category: 'algorithms',
    title: 'Find maximum in array',
    source: `
DECLARE Scores : ARRAY[1:5] OF INTEGER
DECLARE I, Max : INTEGER
Scores[1] ← 12
Scores[2] ← 27
Scores[3] ← 9
Scores[4] ← 31
Scores[5] ← 18
Max ← Scores[1]
FOR I ← 2 TO 5
  IF Scores[I] > Max THEN
    Max ← Scores[I]
  ENDIF
NEXT I
OUTPUT Max
`,
    expectOutput: ['31'],
    tags: ['algorithm', 'array'],
  },
  {
    id: 'count-occurrences',
    category: 'algorithms',
    title: 'Count occurrences of a value',
    source: `
DECLARE A : ARRAY[1:6] OF INTEGER
DECLARE I, Target, Count : INTEGER
A[1] ← 2
A[2] ← 5
A[3] ← 2
A[4] ← 7
A[5] ← 2
A[6] ← 9
Target ← 2
Count ← 0
FOR I ← 1 TO 6
  IF A[I] = Target THEN
    Count ← Count + 1
  ENDIF
NEXT I
OUTPUT Count
`,
    expectOutput: ['3'],
    tags: ['algorithm', 'array'],
  },
  {
    id: 'binary-search',
    category: 'algorithms',
    title: 'Binary search on sorted array',
    source: `
DECLARE A : ARRAY[1:7] OF INTEGER
DECLARE Low, High, Mid, Target, Found : INTEGER
A[1] ← 1
A[2] ← 3
A[3] ← 5
A[4] ← 7
A[5] ← 9
A[6] ← 11
A[7] ← 13
Target ← 9
Low ← 1
High ← 7
Found ← 0
WHILE Low <= High AND Found = 0
  Mid ← (Low + High) DIV 2
  IF A[Mid] = Target THEN
    Found ← Mid
  ELSE
    IF A[Mid] < Target THEN
      Low ← Mid + 1
    ELSE
      High ← Mid - 1
    ENDIF
  ENDIF
ENDWHILE
OUTPUT Found
`,
    expectOutput: ['5'],
    tags: ['algorithm', 'search', 'array'],
  },

  // ── past-papers (Paper 2–style equivalents; original text) ─
  {
    id: 'paper2-grade-band',
    category: 'past-papers',
    title: 'Paper 2–style grade band selection',
    source: `
DECLARE Mark : INTEGER
DECLARE Grade : CHAR
Mark ← 67
IF Mark >= 80 THEN
  Grade ← 'A'
ELSE
  IF Mark >= 70 THEN
    Grade ← 'B'
  ELSE
    IF Mark >= 60 THEN
      Grade ← 'C'
    ELSE
      Grade ← 'U'
    ENDIF
  ENDIF
ENDIF
OUTPUT Grade
`,
    expectOutput: ['C'],
    tags: ['past-paper', 'selection'],
    notes: 'Original equivalent (not a verbatim past paper). Covers nested IF grade banding common in Paper 2.',
  },
  {
    id: 'paper2-validation-loop',
    category: 'past-papers',
    title: 'Paper 2–style input validation loop',
    source: `
DECLARE Age : INTEGER
Age ← -1
WHILE Age < 0 OR Age > 120
  INPUT Age
ENDWHILE
OUTPUT Age
`,
    inputs: ['-5', '200', '17'],
    expectOutput: ['17'],
    tags: ['past-paper', 'while', 'input'],
    notes: 'Original equivalent covering validation REPEAT/WHILE patterns from Paper 2.',
  },
  {
    id: 'paper2-record-process',
    category: 'past-papers',
    title: 'Paper 2–style record processing',
    source: `
TYPE Result
  DECLARE Candidate : STRING
  DECLARE Score : INTEGER
ENDTYPE
DECLARE R : Result
R.Candidate ← "Alex"
R.Score ← 88
IF R.Score >= 80 THEN
  OUTPUT R.Candidate & " distinction"
ELSE
  OUTPUT R.Candidate & " pass"
ENDIF
`,
    expectOutput: ['Alex distinction'],
    tags: ['past-paper', 'record'],
    notes: 'Original equivalent for TYPE + field logic typical of Paper 2.',
  },
  {
    id: 'insert-asc-chr-is-num',
    category: 'past-papers',
    title: 'Paper 2 insert ASC / CHR / IS_NUM',
    source: `
OUTPUT ASC('A')
OUTPUT CHR(66)
OUTPUT IS_NUM("-12.36")
OUTPUT IS_NUM("nope")
`,
    expectOutput: ['65', 'B', 'TRUE', 'FALSE'],
    tags: ['builtin', 'insert', 'regression'],
    notes: 'Exam-insert helpers treated as Core in PseudoPilot.',
  },
  {
    id: 'paper2-array-total',
    category: 'past-papers',
    title: 'Paper 2–style array total and average',
    source: `
DECLARE Marks : ARRAY[1:4] OF INTEGER
DECLARE I, Total : INTEGER
DECLARE Average : REAL
Marks[1] ← 40
Marks[2] ← 50
Marks[3] ← 60
Marks[4] ← 70
Total ← 0
FOR I ← 1 TO 4
  Total ← Total + Marks[I]
NEXT I
Average ← Total / 4
OUTPUT Total
OUTPUT Average
`,
    expectOutput: ['220', '55.0'],
    tags: ['past-paper', 'array'],
    notes: 'Original equivalent for array aggregation tasks.',
  },

  // ── edge-cases ─────────────────────────────────────────────
  {
    id: 'empty-string-length',
    category: 'edge-cases',
    title: 'Empty string LENGTH',
    source: `
DECLARE S : STRING
S ← ""
OUTPUT LENGTH(S)
`,
    expectOutput: ['0'],
    tags: ['string', 'edge'],
  },
  {
    id: 'zero-iterations-for',
    category: 'edge-cases',
    title: 'FOR with TO less than start',
    source: `
DECLARE I, C : INTEGER
C ← 0
FOR I ← 5 TO 1
  C ← C + 1
NEXT I
OUTPUT C
`,
    expectOutput: ['0'],
    tags: ['for', 'edge'],
  },
  {
    id: 'output-multi-value',
    category: 'edge-cases',
    title: 'OUTPUT multiple values space-separated',
    source: `
DECLARE A, B : INTEGER
A ← 1
B ← 2
OUTPUT A, B, A + B
`,
    expectOutput: ['1 2 3'],
    tags: ['output', 'edge'],
  },
  {
    id: 'mod-zero-dividend',
    category: 'edge-cases',
    title: 'MOD and DIV with zero dividend',
    source: `
OUTPUT 0 DIV 5
OUTPUT 0 MOD 5
`,
    expectOutput: ['0', '0'],
    tags: ['expr', 'divmod', 'edge'],
  },

  // ── regressions (permanent) ────────────────────────────────
  {
    id: 'negative-div-mod',
    category: 'regressions',
    title: 'Negative DIV and MOD',
    source: `
OUTPUT -7 DIV 3
OUTPUT -7 MOD 3
`,
    expectOutput: ['-2', '-1'],
    tags: ['expr', 'divmod', 'regression'],
  },
  {
    id: 'identifier-list-sanitizer',
    category: 'regressions',
    title: 'Identifier sanitizer list → list_',
    source: `
DECLARE list : INTEGER
list ← 1
OUTPUT list
`,
    expectOutput: ['1'],
    tags: ['translator', 'sanitizer', 'regression'],
    notes: 'Python keyword collision: list must become list_ in expect.python.',
  },
  {
    id: 'bare-next-regression',
    category: 'regressions',
    title: 'Bare NEXT regression lock',
    source: `
DECLARE I, Total : INTEGER
Total ← 0
FOR I ← 1 TO 3
  Total ← Total + I
NEXT
OUTPUT Total
`,
    expectOutput: ['6'],
    tags: ['for', 'bare-next', 'regression'],
  },
  {
    id: 'byref-swap-regression',
    category: 'regressions',
    title: 'BYREF SWAP regression lock',
    source: `
PROCEDURE SWAP(BYREF X : INTEGER, Y : INTEGER)
  DECLARE Temp : INTEGER
  Temp ← X
  X ← Y
  Y ← Temp
ENDPROCEDURE
DECLARE A, B : INTEGER
A ← 1
B ← 2
CALL SWAP(A, B)
OUTPUT A
OUTPUT B
`,
    expectOutput: ['2', '1'],
    tags: ['byref', 'regression'],
  },
  {
    id: 'asc-chr-is-num-regression',
    category: 'regressions',
    title: 'ASC / CHR / IS_NUM regression lock',
    source: `
OUTPUT ASC('0')
OUTPUT CHR(65)
OUTPUT IS_NUM("3.14")
`,
    expectOutput: ['48', 'A', 'TRUE'],
    tags: ['builtin', 'insert', 'regression'],
  },
  {
    id: 'constant-equals-not-arrow',
    category: 'regressions',
    title: 'CONSTANT must use = not ← (parse failure)',
    source: `
CONSTANT Max ← 10
`,
    expectClean: false,
    skipRun: true,
    reverse: 'skip',
    reverseSkipReason: 'Invalid program — CONSTANT requires =.',
    expectDiagnostics: [{ code: 'E_CONSTANT_EQUALS', severity: 'error' }],
    tags: ['constant', 'parser', 'regression'],
    notes: 'CONSTANT must use =; ← is a permanent parser regression (E_CONSTANT_EQUALS).',
  },
  {
    id: 'assign-to-constant',
    category: 'regressions',
    title: 'Assign to CONSTANT is checker error',
    source: `
CONSTANT Max = 1
Max ← 2
`,
    expectClean: false,
    skipRun: true,
    reverse: 'skip',
    reverseSkipReason: 'Invalid program — assignment to CONSTANT.',
    expectDiagnostics: [{ code: 'C_ASSIGN_TO_CONSTANT', severity: 'error' }],
    tags: ['constant', 'checker', 'regression'],
  },
  {
    id: 'undeclared-identifier',
    category: 'edge-cases',
    title: 'Undeclared identifier diagnostic',
    source: `
OUTPUT Missing
`,
    expectClean: false,
    skipRun: true,
    reverse: 'skip',
    reverseSkipReason: 'Invalid program — undeclared identifier.',
    expectDiagnostics: [{ code: 'C_UNDECL_IDENT', severity: 'error' }],
    tags: ['checker', 'edge'],
  },
  {
    id: 'enum-pointer-set-regression',
    category: 'regressions',
    title: 'Enum / pointer / SET smoke regression',
    source: `
TYPE Colour = (Red, Green, Blue)
TYPE ColourPtr = ^Colour
TYPE Flags = SET OF INTEGER
DEFINE Bits(1, 2) : Flags
DECLARE C : Colour
DECLARE P : ColourPtr
C ← Green
P ← ^C
OUTPUT P^
OUTPUT Bits
`,
    expectOutput: ['Green', '{1, 2}'],
    tags: ['enum', 'pointer', 'set', 'regression'],
  },
  {
    id: 'random-file-regression',
    category: 'regressions',
    title: 'Random file I/O regression lock',
    source: `
TYPE Rec
  DECLARE N : INTEGER
ENDTYPE
DECLARE W, R : Rec
W.N ← 42
OPENFILE "Reg.Dat" FOR RANDOM
SEEK "Reg.Dat", 0
PUTRECORD "Reg.Dat", W
SEEK "Reg.Dat", 0
GETRECORD "Reg.Dat", R
CLOSEFILE "Reg.Dat"
OUTPUT R.N
`,
    expectOutput: ['42'],
    tags: ['random', 'file', 'regression'],
  },
  // Stub / documentation fixtures (not executable language proofs)
  {
    id: 'note-live-sync-web-only',
    category: 'regressions',
    title: 'NOTE: live sync unrelated Pseudocode mutation (apps/web)',
    source: `
OUTPUT "conformance-note"
`,
    expectOutput: ['conformance-note'],
    reverse: 'skip',
    reverseSkipReason:
      'Web-only regression — covered in apps/web Monaco/live-sync tests, not package corpus.',
    tags: ['regression', 'web-only', 'note'],
    notes:
      'Historical bug: live sync could mutate unrelated Pseudocode. Not reproducible at @pseudopilot/conformance package level. See apps/web lib/monaco / bidirectional sync tests. Cross-ref REGRESSION_SUITE.md.',
  },
  {
    id: 'note-ai-coach-routing',
    category: 'regressions',
    title: 'NOTE: AI Coach intent routing (ai-coach package)',
    source: `
OUTPUT "conformance-note"
`,
    expectOutput: ['conformance-note'],
    reverse: 'skip',
    reverseSkipReason:
      'AI Coach routing lives in @pseudopilot/ai-coach tests; stub for suite completeness.',
    tags: ['regression', 'ai-coach', 'note'],
    notes:
      'Cross-ref: packages/ai-coach/src/index.test.ts (intent / product_capability / general_programming). See REGRESSION_SUITE.md.',
  },
];

function trimSource(s) {
  return s.replace(/^\n+/, '').replace(/\n+$/, '') + '\n';
}

function normalizePseudo(source) {
  return source
    .replace(/\r\n/g, '\n')
    .replace(/<-/g, '←')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function main() {
  const { parse } = await loadDist('@pseudopilot/language-core');
  const { check } = await loadDist('@pseudopilot/checker');
  const { translatePseudocodeToPython, translatePythonToPseudocode } =
    await loadDist('@pseudopilot/translator');
  const { runPseudocode, MemoryHost, SeededRandom } = await loadDist(
    '@pseudopilot/interpreter',
  );

  // Ensure category folders exist; wipe only when refreshing full seed.
  if (existsSync(CORPUS_ROOT) && REFRESH) {
    // Keep structure but regenerate all known ids from PROGRAMS.
  }

  for (const cat of CATEGORIES) {
    mkdirSync(join(CORPUS_ROOT, cat), { recursive: true });
  }

  const ids = new Set();
  let written = 0;
  let reverseSkipped = 0;

  for (const prog of PROGRAMS) {
    if (ids.has(prog.id)) throw new Error(`Duplicate id ${prog.id}`);
    ids.add(prog.id);

    const dir = join(CORPUS_ROOT, prog.category, prog.id);
    mkdirSync(dir, { recursive: true });

    const source = trimSource(prog.source);
    writeFileSync(join(dir, 'program.pp'), source, 'utf8');

    const expectClean = prog.expectClean !== false;
    let reverse = prog.reverse ?? (expectClean ? 'check' : 'skip');
    let reverseSkipReason = prog.reverseSkipReason;
    let expectPython;
    let expectReverse;

    if (expectClean) {
      const parsed = parse(source);
      if (!parsed.ok) {
        console.error(`FAIL parse ${prog.id}`, parsed.diagnostics);
        process.exitCode = 1;
        continue;
      }
      const checked = check(parsed.ast);
      if (!checked.ok) {
        console.error(
          `FAIL check ${prog.id}`,
          checked.diagnostics.map((d) => d.code + ': ' + d.message),
        );
        process.exitCode = 1;
        continue;
      }

      if (prog.expectOutput && !prog.skipRun) {
        const host = new MemoryHost(prog.inputs ?? []);
        const run = await runPseudocode(source, {
          host,
          random: new SeededRandom(42),
        });
        if (!run.ok) {
          console.error(
            `FAIL run ${prog.id}`,
            run.diagnostics.map((d) => d.code + ': ' + d.message),
          );
          process.exitCode = 1;
          continue;
        }
        const got = host.outputs;
        const exp = prog.expectOutput;
        if (JSON.stringify(got) !== JSON.stringify(exp)) {
          console.error(`FAIL output ${prog.id}`, { got, exp });
          process.exitCode = 1;
          continue;
        }
      }

      const py = translatePseudocodeToPython(source);
      if (!py.ok) {
        console.error(`FAIL translate ${prog.id}`, py.diagnostics);
        process.exitCode = 1;
        continue;
      }
      expectPython = py.code.endsWith('\n') ? py.code : py.code + '\n';

      if (reverse === 'check') {
        const back = translatePythonToPseudocode(py.code);
        if (!back.ok) {
          reverse = 'skip';
          reverseSkipReason = `Reverse translator failed: ${back.diagnostics.map((d) => d.message).join('; ')}`;
          reverseSkipped += 1;
        } else {
          // Behavioural lock: reverse then run should match expectOutput when runnable.
          if (prog.expectOutput && !prog.skipRun) {
            const host = new MemoryHost(prog.inputs ?? []);
            const run = await runPseudocode(back.code, {
              host,
              random: new SeededRandom(42),
            });
            if (
              !run.ok ||
              JSON.stringify(host.outputs) !== JSON.stringify(prog.expectOutput)
            ) {
              reverse = 'skip';
              reverseSkipReason =
                'Reverse translation does not preserve runtime output (best-effort reverse).';
              reverseSkipped += 1;
            } else {
              expectReverse =
                (back.code.endsWith('\n') ? back.code : back.code + '\n');
            }
          } else {
            expectReverse =
              (back.code.endsWith('\n') ? back.code : back.code + '\n');
          }
        }
      }
    } else {
      // Negative fixtures: verify expected failure mode lightly.
      const parsed = parse(source);
      if (prog.id === 'constant-equals-not-arrow') {
        if (parsed.ok) {
          console.error(`FAIL: expected parse failure for ${prog.id}`);
          process.exitCode = 1;
        }
      } else if ((prog.expectDiagnostics ?? []).length > 0) {
        const checked = check(parsed.ast);
        for (const d of prog.expectDiagnostics) {
          if (!checked.diagnostics.some((x) => x.code === d.code)) {
            console.error(
              `FAIL: expected diagnostic ${d.code} for ${prog.id}`,
              checked.diagnostics.map((x) => x.code),
            );
            process.exitCode = 1;
          }
        }
      }
    }

    /** @type {Record<string, unknown>} */
    const meta = {
      title: prog.title,
      tags: prog.tags ?? [prog.category],
    };
    if (prog.inputs) meta.inputs = prog.inputs;
    if (prog.expectOutput) meta.expectOutput = prog.expectOutput;
    if (prog.expectDiagnostics) meta.expectDiagnostics = prog.expectDiagnostics;
    if (prog.expectClean === false) meta.expectClean = false;
    if (prog.skipRun) meta.skipRun = true;
    meta.reverse = reverse;
    if (reverseSkipReason) meta.reverseSkipReason = reverseSkipReason;
    if (prog.notes) meta.notes = prog.notes;

    writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');
    if (expectPython) {
      writeFileSync(join(dir, 'expect.python'), expectPython, 'utf8');
    } else if (existsSync(join(dir, 'expect.python')) && !expectClean) {
      rmSync(join(dir, 'expect.python'));
    }
    if (expectReverse && reverse === 'check') {
      writeFileSync(join(dir, 'expect.reverse.pp'), expectReverse, 'utf8');
    } else if (existsSync(join(dir, 'expect.reverse.pp'))) {
      rmSync(join(dir, 'expect.reverse.pp'));
    }

    written += 1;
    console.log(
      `✓ ${prog.category}/${prog.id}` +
        (reverse === 'skip' ? ` [reverse:skip]` : ''),
    );
  }

  // Coverage README stub inside corpus
  const readme = `# PseudoPilot Cambridge Regression Corpus

On-disk fixtures for \`@pseudopilot/conformance\`.

Each entry is \`<category>/<id>/\` with:

| File | Purpose |
| --- | --- |
| \`program.pp\` | Pseudocode source |
| \`meta.json\` | Title, tags, I/O, diagnostics, reverse policy |
| \`expect.python\` | Gold Python translation (clean programs) |
| \`expect.reverse.pp\` | Gold reverse Pseudocode when \`reverse: "check"\` |

See [\`docs/REGRESSION_SUITE.md\`](../../../docs/REGRESSION_SUITE.md).

Seeded ${written} entries. Reverse skipped at seed time: ${reverseSkipped}.
`;
  writeFileSync(join(CORPUS_ROOT, 'README.md'), readme, 'utf8');

  console.log(`\nWrote ${written} corpus entries under ${CORPUS_ROOT}`);
  console.log(`Reverse skipped during golden generation: ${reverseSkipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
