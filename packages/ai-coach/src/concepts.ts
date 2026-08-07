import { formatTutorResponse, type TutorCard } from './tutorFormat.js';

export type ConceptEntry = {
  readonly re: RegExp;
  readonly title: string;
  readonly card: TutorCard;
};

/** Ordered: more specific patterns first so tutoring routes correctly. */
export const CONCEPTS: readonly ConceptEntry[] = [
  {
    re: /\bbyref\b|\bbyval\b|pass\s+by\s+(ref|value)|change\s+(a\s+)?variable\s+inside|modify\s+(a\s+)?(caller'?s?\s+)?(variable|parameter)|update\s+(the\s+)?caller|in[- ]?place\s+(update|change|modif)/,
    title: 'BYREF vs BYVAL',
    card: {
      directAnswer:
        'To change the caller’s variable from inside a PROCEDURE, pass it **BYREF**. Assignments to that parameter update the original. **BYVAL** (the default) only changes a local copy.',
      explanation:
        'Cambridge §8.3: BYVAL copies the argument into the parameter; BYREF makes the parameter an alias for the caller’s variable. Use BYREF for in-place updates (swap, accumulate, fill an array). Prefer BYVAL when the routine should only read the value. **FUNCTION**s return a value — they must not use BYREF.',
      example: `PROCEDURE Increment(BYREF N : INTEGER)
  N ← N + 1
ENDPROCEDURE

DECLARE X : INTEGER
X ← 5
CALL Increment(X)
OUTPUT X
// Output: 6`,
      commonMistake:
        'Declaring the parameter BYVAL (or omitting the mode) and expecting the caller’s variable to change — after `CALL Increment(X)`, X would still be 5.',
      examTip:
        'Write the mode explicitly, e.g. `PROCEDURE Swap(BYREF A : INTEGER, BYREF B : INTEGER)`. If a FUNCTION needs two results, rethink the design rather than sneaking in BYREF.',
    },
  },
  {
    re: /\b(when|why|should).{0,40}\bfunction\b.{0,40}\bprocedure\b|\b(when|why|should).{0,40}\bprocedure\b.{0,40}\bfunction\b|\bfunction\b.{0,30}\binstead\b.{0,20}\bprocedure\b|\bprocedure\b.{0,30}\binstead\b.{0,20}\bfunction\b|\b(difference|differ|vs\.?|versus)\b.{0,40}\b(procedure|function)\b/,
    title: 'FUNCTION vs PROCEDURE',
    card: {
      directAnswer:
        'Use a **FUNCTION** when you need a single return value in an expression. Use a **PROCEDURE** when the routine performs an action (and optionally updates BYREF parameters) without returning a value.',
      explanation:
        'A FUNCTION declares `RETURNS` a type and uses `RETURN`; you write it inside expressions (`Total ← Add(A, B)`). A PROCEDURE is started with `CALL` and has no return value. Parameters default to BYVAL; only PROCEDURES may use BYREF to update the caller.',
      example: `FUNCTION Double(N : INTEGER) RETURNS INTEGER
  RETURN N * 2
ENDFUNCTION

PROCEDURE ShowDouble(N : INTEGER)
  OUTPUT Double(N)
ENDPROCEDURE

CALL ShowDouble(7)
// Output: 14`,
      commonMistake:
        'Writing a PROCEDURE that only computes one result and forcing the caller to use BYREF, when a FUNCTION would be clearer — or using BYREF inside a FUNCTION.',
      examTip:
        'Paper 2 often asks you to choose: if the mark scheme expects a value in an expression, write a FUNCTION; if it says “updates the array in place”, write a PROCEDURE with BYREF.',
    },
  },
  {
    re: /\bprocedure\b|\bfunction\b|\bcall\b/,
    title: 'PROCEDURE / FUNCTION',
    card: {
      directAnswer:
        'A **PROCEDURE** is a subroutine you **CALL**; it does not return a value. A **FUNCTION** returns a typed value for use in expressions. Parameters are BYVAL by default; only PROCEDURES may use BYREF.',
      explanation:
        'Declare routines before or after the main program as your teacher requires. PROCEDURES encapsulate actions (OUTPUT, file I/O, BYREF updates). FUNCTIONS encapsulate calculations. Nested CALL / function calls follow normal stack rules.',
      example: `PROCEDURE Greet(Name : STRING)
  OUTPUT "Hello ", Name
ENDPROCEDURE

FUNCTION Square(N : INTEGER) RETURNS INTEGER
  RETURN N * N
ENDFUNCTION

CALL Greet("Sam")
OUTPUT Square(4)
// Output: Hello Sam
// Output: 16`,
      commonMistake:
        'Forgetting `CALL` for a PROCEDURE, or treating a FUNCTION like a PROCEDURE (calling it with CALL instead of using it in an expression).',
      examTip:
        'Name PROCEDURES with verbs (`SortList`) and FUNCTIONS with nouns/adjectives that describe the result (`Average`, `IsValid`).',
    },
  },
  {
    re: /\brecursion\b|\brecursive\b/,
    title: 'Recursion',
    card: {
      directAnswer:
        'Recursion means a PROCEDURE or FUNCTION **calls itself** to solve a smaller instance of the same problem, until a **base case** stops the chain.',
      explanation:
        'Every recursive routine needs a base case (no further call) and a recursive case (progress toward the base). The call stack grows with each call and unwinds as returns complete. Recursion suits factorials, trees, and divide-and-conquer; iteration (FOR/WHILE) can solve many of the same problems with less stack use.',
      example: `FUNCTION Factorial(N : INTEGER) RETURNS INTEGER
  IF N = 0 OR N = 1 THEN
    RETURN 1
  ELSE
    RETURN N * Factorial(N - 1)
  ENDIF
ENDFUNCTION

OUTPUT Factorial(4)
// Output: 24`,
      commonMistake:
        'Missing or unreachable base case — the routine never stops and the stack overflows — or failing to make the argument smaller each call.',
      examTip:
        'In tracing questions, draw the call stack for a tiny input (e.g. Factorial(3)) and show each RETURN value on the way back.',
    },
  },
  {
    re: /\bdiv\b|\bmod\b|integer\s+divis/,
    title: 'DIV vs MOD',
    card: {
      directAnswer:
        '**DIV** is integer division (the whole-number quotient). **MOD** is the remainder after that division. Both work on INTEGER operands.',
      explanation:
        '`17 DIV 5` is 3; `17 MOD 5` is 2. For B ≠ 0: `A = (A DIV B) * B + (A MOD B)`. Use them for digit stripping, even/odd tests, and wrapping indices. Real division `/` is different — it yields a REAL.',
      example: `DECLARE N, Quotient, Remainder : INTEGER
N ← 17
Quotient ← N DIV 5
Remainder ← N MOD 5
OUTPUT Quotient, " ", Remainder
// Output: 3 2`,
      commonMistake:
        'Using `/` when the question asks for DIV, or expecting MOD to work on REAL values the same way as in some other languages.',
      examTip:
        'Digit extraction: units = `N MOD 10`, then `N ← N DIV 10`. State that operands are INTEGER in written answers.',
    },
  },
  {
    re: /\btype\b.*\bclass\b|\bclass\b.*\btype\b|\b(difference|differ|vs\.?|versus)\b.*\b(type|class)\b/,
    title: 'TYPE vs CLASS',
    card: {
      directAnswer:
        '**TYPE** defines a data shape (record, enum, pointer, set). **CLASS** defines an OOP blueprint with attributes and methods. Use TYPE for structured data; use CLASS when behaviour belongs with the data.',
      explanation:
        '`TYPE … ENDTYPE` introduces records (fields), enums, pointers (`^T`), or sets (`SET OF T`). You DECLARE values of that type. `CLASS … ENDCLASS` groups attributes, methods, constructors, and inheritance. Random-file GETRECORD/PUTRECORD work with record TYPEs, not CLASS objects.',
      example: `TYPE Student
  DECLARE Name : STRING
  DECLARE Mark : INTEGER
ENDTYPE

CLASS Counter
  PUBLIC Mark : INTEGER
  PUBLIC PROCEDURE Increment()
    Mark ← Mark + 1
  ENDPROCEDURE
ENDCLASS`,
      commonMistake:
        'Putting methods on a TYPE, or using a CLASS where the syllabus only needs a record for file I/O.',
      examTip:
        'If the question mentions inheritance or methods, answer with CLASS. If it lists fields only (or file records), answer with TYPE.',
    },
  },
  {
    re: /\bbinary\s*search\b|\bbinsearch\b|\bsearching\b|\blinear\s*search\b/,
    title: 'Searching',
    card: {
      directAnswer:
        '**Linear search** checks items in order until it finds the target (or finishes). **Binary search** repeatedly halves a **sorted** array — far fewer comparisons, but only if the data is ordered.',
      explanation:
        'Linear search works on unsorted data; worst case is O(N). Binary search needs ascending (or descending) order: compare the middle element, then discard half the range using Low/High and Mid = (Low + High) DIV 2.',
      example: `// Binary search outline (sorted A[1:N], ascending)
Low ← 1
High ← N
Found ← FALSE
WHILE Low <= High AND Found = FALSE DO
  Mid ← (Low + High) DIV 2
  IF A[Mid] = Target THEN
    Found ← TRUE
  ELSE
    IF A[Mid] < Target THEN
      Low ← Mid + 1
    ELSE
      High ← Mid - 1
    ENDIF
  ENDIF
ENDWHILE`,
      commonMistake:
        'Applying binary search to an unsorted array, or forgetting to update Low/High so the loop never shrinks.',
      examTip:
        'Always state the precondition “array must be sorted” for binary search in exam answers.',
    },
  },
  {
    re: /\bsort(ing)?\b|\bbubble\s*sort\b|\binsertion\s*sort\b/,
    title: 'Sorting',
    card: {
      directAnswer:
        'Sorting rearranges an array into order (usually ascending). Cambridge papers commonly expect **bubble sort** or **insertion sort** traces and comparisons.',
      explanation:
        'Bubble sort repeatedly swaps adjacent out-of-order pairs. Insertion sort builds a sorted prefix by inserting each next element into place. Both are O(N²) in the typical teaching analysis — suitable for small N and hand traces.',
      example: `// One bubble-sort pass idea (A[1:N])
FOR I ← 1 TO N - 1
  IF A[I] > A[I + 1] THEN
    Temp ← A[I]
    A[I] ← A[I + 1]
    A[I + 1] ← Temp
  ENDIF
NEXT I`,
      commonMistake:
        'Claiming binary search works before sorting, or mixing up which algorithm you are tracing mid-question.',
      examTip:
        'Show the array after each pass when the question asks for a trace — markers reward clear intermediate states.',
    },
  },
  {
    re: /\brand\b|\brandom\b(?!\s+file)/,
    title: 'RAND',
    card: {
      directAnswer:
        '`RAND(n)` returns a **REAL** random number x with `0 ≤ x < n` (for positive n). It is for simulations — not the same idea as random-access files.',
      explanation:
        'Each call yields a new value. A common integer pattern from 1 to K is `INT(RAND(K)) + 1` (confirm the exact INT/RAND pairing your insert sheet uses). Random-access files use `OPENFILE … FOR RANDOM` with SEEK/GETRECORD/PUTRECORD instead.',
      example: `DECLARE R : REAL
DECLARE Dice : INTEGER
R ← RAND(1)
Dice ← INT(RAND(6)) + 1
OUTPUT Dice
// Output: an INTEGER from 1 to 6`,
      commonMistake:
        'Treating `RAND` as a fixed constant, or confusing it with random-file addressing.',
      examTip:
        'If the question says “random access file”, answer with SEEK/GETRECORD — not `RAND`.',
    },
  },
  {
    re: /\b(length|mid|left|right|tonum|to_num|substring|string\s+routin)/i,
    title: 'STRING routines',
    card: {
      directAnswer:
        'Cambridge string helpers measure and slice STRING/CHAR data — e.g. `LENGTH`, `MID`, and related insert-sheet routines — without writing character loops by hand.',
      explanation:
        '`LENGTH(s)` returns how many characters are in s. `MID(s, start, count)` extracts a substring. Combine them with ASC/CHR when you need codes. Always check whether indexing is 1-based in the examples you were taught.',
      example: `DECLARE S, Part : STRING
S ← "Cambridge"
OUTPUT LENGTH(S)
Part ← MID(S, 1, 4)
OUTPUT Part
// Output: 9
// Output: Camb`,
      commonMistake:
        'Off-by-one start positions, or assuming 0-based indexing from another language.',
      examTip:
        'Quote the insert-sheet spelling exactly (`MID`, not `Substring`) in written papers.',
    },
  },
  {
    re: /\basc\b|\bchr\b|\bis_num\b/,
    title: 'ASC / CHR / IS_NUM',
    card: {
      directAnswer:
        '`ASC(c)` gives the ASCII code of a CHAR; `CHR(n)` gives the CHAR for code n; `IS_NUM(s)` is TRUE when s looks like a signed decimal number.',
      explanation:
        'These are Paper 2 exam-insert helpers. Use ASC/CHR for cipher and character arithmetic; use IS_NUM before converting user input that might not be numeric.',
      example: `OUTPUT ASC('A')
OUTPUT CHR(66)
OUTPUT IS_NUM("-12.5")
// Output: 65
// Output: B
// Output: TRUE`,
      commonMistake:
        'Passing a multi-character STRING to ASC, or forgetting quotes around a CHAR literal.',
      examTip:
        'State the types: ASC takes CHAR → INTEGER; CHR takes INTEGER → CHAR.',
    },
  },
  {
    re: /\bstack\b/,
    title: 'STACK',
    card: {
      directAnswer:
        'A **stack** is LIFO: last item pushed is the first popped. Typical operations are PUSH, POP, and often a check for empty/full.',
      explanation:
        'Implement with an array plus a pointer (Top). PUSH increments Top and stores; POP reads then decrements. Recursion and undo features are classic stack uses; Cambridge questions often ask for pseudocode of Push/Pop with overflow/underflow checks.',
      example: `PROCEDURE Push(BYREF Top : INTEGER, Item : INTEGER)
  IF Top = MaxSize THEN
    OUTPUT "Stack full"
  ELSE
    Top ← Top + 1
    Stack[Top] ← Item
  ENDIF
ENDPROCEDURE`,
      commonMistake:
        'Popping an empty stack without checking Top, or confusing stack (LIFO) with queue (FIFO).',
      examTip:
        'Label Top clearly in diagrams — markers look for correct pointer movement.',
    },
  },
  {
    re: /\bqueue\b/,
    title: 'QUEUE',
    card: {
      directAnswer:
        'A **queue** is FIFO: first item enqueued is the first dequeued. Operations are usually ENQUEUE and DEQUEUE (with empty/full checks).',
      explanation:
        'Use Front and Rear pointers (or a circular buffer). ENQUEUE adds at Rear; DEQUEUE removes from Front. Queues model print jobs, buffers, and breadth-first traversal.',
      example: `PROCEDURE Enqueue(BYREF Rear : INTEGER, Item : INTEGER)
  IF Rear = MaxSize THEN
    OUTPUT "Queue full"
  ELSE
    Rear ← Rear + 1
    Queue[Rear] ← Item
  ENDIF
ENDPROCEDURE`,
      commonMistake:
        'Updating Front/Rear in the wrong order, or treating a queue as LIFO like a stack.',
      examTip:
        'Say “FIFO” explicitly in definitions — it earns an easy mark.',
    },
  },
  {
    re: /\bbinary\s*tree\b|\btree\b/,
    title: 'BINARY TREE',
    card: {
      directAnswer:
        'A **binary tree** node has at most two children (left and right). Traversals visit nodes in a defined order (preorder, inorder, postorder).',
      explanation:
        'Each node stores data plus left/right links (often pointers or array indices). Inorder of a binary search tree yields sorted keys. Recursive definitions map cleanly onto Cambridge PROCEDURE/FUNCTION recursion.',
      example: `TYPE Node
  DECLARE Data : INTEGER
  DECLARE Left : INTEGER
  DECLARE Right : INTEGER
ENDTYPE

PROCEDURE Inorder(Index : INTEGER)
  IF Index <> NullPtr THEN
    CALL Inorder(Tree[Index].Left)
    OUTPUT Tree[Index].Data
    CALL Inorder(Tree[Index].Right)
  ENDIF
ENDPROCEDURE`,
      commonMistake:
        'Mixing up traversal orders, or forgetting the null/empty-child base case in a recursive walk.',
      examTip:
        'For BST questions, state that left keys are smaller and right keys are larger than the node.',
    },
  },
  {
    re: /\bdate\b/,
    title: 'DATE',
    card: {
      directAnswer:
        '**DATE** is a Cambridge Pseudocode data type for calendar dates. Declare DATE variables and use the insert-sheet helpers your paper provides for day/month/year access.',
      explanation:
        'Treat DATE as its own type — do not store dates as unstructured STRING unless the question allows it. Combine DATE fields with records when modelling events or file records.',
      example: `DECLARE Today : DATE
Today ← setDate(6, 8, 2026)
OUTPUT getDay(Today)
// Output depends on helpers in your insert sheet`,
      commonMistake:
        'Comparing dates as STRINGs (`"06/08/2026"`) and getting lexicographic order wrong.',
      examTip:
        'Use the exact helper names from the 9618 insert (they vary by paper session).',
    },
  },
  {
    re: /seek|getrecord|putrecord|random file|randomfiles?/,
    title: 'Random files',
    card: {
      directAnswer:
        'Random-access files use `OPENFILE … FOR RANDOM`, then `SEEK`, `GETRECORD`, and `PUTRECORD` to read/write a record by address — not line-by-line text I/O.',
      explanation:
        'Cambridge §9.2: SEEK moves the file pointer to an INTEGER record number (0-based from the start). GETRECORD reads into a TYPE variable; PUTRECORD writes/replaces. Use with record TYPEs (including nested fields and DATE), not CLASS objects.',
      example: `TYPE Rec
  DECLARE Id : INTEGER
  DECLARE Name : STRING
ENDTYPE

DECLARE R : Rec
OPENFILE "data.dat" FOR RANDOM
SEEK "data.dat", 0
GETRECORD "data.dat", R
OUTPUT R.Name
CLOSEFILE "data.dat"`,
      commonMistake:
        'Using READFILE/WRITEFILE on a RANDOM file, or SEEK with a 1-based address when the teaching model is 0-based.',
      examTip:
        'State that the address is the record number, not a byte offset, unless the question says otherwise.',
    },
  },
  {
    re: /openfile|readfile|writefile|closefile|text file|\bfiles?\b/,
    title: 'Text files',
    card: {
      directAnswer:
        'Text files use `OPENFILE` with READ, WRITE, or APPEND, then `READFILE` / `WRITEFILE`, and `CLOSEFILE`. `EOF(name)` tests end-of-file.',
      explanation:
        'Cambridge §9.1: WRITE truncates; APPEND extends; READ scans lines. Random access is a different mode (FOR RANDOM + SEEK/GETRECORD/PUTRECORD). Always close files you open.',
      example: `OPENFILE "out.txt" FOR WRITE
WRITEFILE "out.txt", "Hello"
CLOSEFILE "out.txt"

OPENFILE "out.txt" FOR READ
DECLARE Line : STRING
READFILE "out.txt", Line
OUTPUT Line
CLOSEFILE "out.txt"
// Output: Hello`,
      commonMistake:
        'Forgetting CLOSEFILE, or opening FOR WRITE when you meant APPEND (losing existing data).',
      examTip:
        'Mention the mode (READ/WRITE/APPEND) in every OPENFILE line in exam answers.',
    },
  },
  {
    re: /\brecord\b|\bendtype\b/,
    title: 'RECORDS',
    card: {
      directAnswer:
        'A **record** is a user-defined TYPE that groups named fields of possibly different types into one value.',
      explanation:
        'Declare the TYPE with fields, then DECLARE variables of that type. Access fields with dot notation (`Pupil.Name`). Records are ideal for file layouts and structured data without OOP methods.',
      example: `TYPE Pupil
  DECLARE Name : STRING
  DECLARE Age : INTEGER
ENDTYPE

DECLARE P : Pupil
P.Name ← "Alex"
P.Age ← 16
OUTPUT P.Name, " ", P.Age
// Output: Alex 16`,
      commonMistake:
        'Forgetting to DECLARE a variable of the TYPE, or assigning the whole record with `=` instead of `←` field-by-field (or a valid whole-record assignment where allowed).',
      examTip:
        'List every field and type in the TYPE block — incomplete records lose marks.',
    },
  },
  {
    re: /\benum\b|\bpointer\b|\^|deref|set of|\bdefine\b|\bset\s+type\b/,
    title: 'User-defined TYPE forms',
    card: {
      directAnswer:
        'Beyond records, Cambridge TYPEs include **enums**, **pointers** (`^T` with `Ptr^`), and **sets** (`SET OF T` with `DEFINE`).',
      explanation:
        'Enums list named values. Pointers store addresses for linked structures. Sets hold unordered unique elements of a base type. Choose the form that matches the question (links → pointer; membership → set; named seasons → enum).',
      example: `TYPE Season = (Spring, Summer, Autumn, Winter)
TYPE NodePtr = ^Node
TYPE Odds = SET OF INTEGER

DECLARE S : Season
S ← Summer
DEFINE Evens (2, 4, 6) : Odds`,
      commonMistake:
        'Dereferencing a nil pointer, or writing set literals without DEFINE where the syllabus requires it.',
      examTip:
        'Draw pointer diagrams beside pseudocode in linked-list questions — clarity scores marks.',
    },
  },
  {
    re: /\barray\b/,
    title: 'ARRAY',
    card: {
      directAnswer:
        'An **ARRAY** is a fixed-length sequence of the same type. Declare bounds and element type, then index elements for read/write.',
      explanation:
        '`DECLARE A : ARRAY[1:10] OF INTEGER` creates ten INTEGER slots. Cambridge teaching examples are often 1-based and inclusive on both bounds. Use FOR loops to initialise and process arrays; pass BYREF when a PROCEDURE must change elements in place.',
      example: `DECLARE A : ARRAY[1:3] OF INTEGER
DECLARE I : INTEGER
FOR I ← 1 TO 3
  A[I] ← I * 10
NEXT I
OUTPUT A[2]
// Output: 20`,
      commonMistake:
        'Using 0 as the first index when the DECLARE said `[1:N]`, or writing past the upper bound.',
      examTip:
        'Always copy the DECLARE bounds into your answer so the examiner sees legal indices.',
    },
  },
  {
    re: /\bdeclare\b/,
    title: 'DECLARE',
    card: {
      directAnswer:
        '`DECLARE name : TYPE` introduces a variable before you use it. Assignment uses `←` (or `<-`), never `=` for assignment.',
      explanation:
        'Types include INTEGER, REAL, STRING, BOOLEAN, CHAR, DATE, ARRAY[…] OF T, and user-defined TYPEs. Parameters and FOR control variables are introduced by their headers. Undeclared names cause checker errors such as C_UNDECL_IDENT.',
      example: `DECLARE Count : INTEGER
Count ← 0
Count ← Count + 1
OUTPUT Count
// Output: 1`,
      commonMistake:
        'Using a name before DECLARE, or writing `Count = 0` as if it were assignment.',
      examTip:
        'Group DECLAREs at the top of the program or routine — it matches mark-scheme style.',
    },
  },
  {
    re: /\bclass\b|\binherit|oop\b|object.?orient/,
    title: 'CLASS (OOP)',
    card: {
      directAnswer:
        'A **CLASS** groups attributes and methods. Create objects, call methods on them, and use inheritance when a subclass extends a parent.',
      explanation:
        'OOP questions want encapsulation of state + behaviour. Constructors initialise attributes. Prefer CLASS when methods/inheritance appear; use TYPE for plain records without behaviour.',
      example: `CLASS Counter
  PUBLIC Value : INTEGER
  PUBLIC PROCEDURE Init()
    Value ← 0
  ENDPROCEDURE
  PUBLIC PROCEDURE Bump()
    Value ← Value + 1
  ENDPROCEDURE
ENDCLASS`,
      commonMistake:
        'Accessing attributes without an instance, or answering an OOP question with a bare TYPE record.',
      examTip:
        'Name visibility (PUBLIC/PRIVATE) if your syllabus insert includes it — do not invent modifiers the paper does not use.',
    },
  },
  {
    re: /\bfor\s+loop\b|\bfor\b.*\bnext\b|\bcounted loop\b/,
    title: 'FOR',
    card: {
      directAnswer:
        '`FOR … TO … NEXT` is a counted loop: the control variable steps from a start value to an end value (inclusive), optionally with STEP.',
      explanation:
        'The loop body runs once per value of the control variable. Prefer FOR when you know how many iterations you need; use WHILE/REPEAT when the stop condition is not a simple count.',
      example: `DECLARE I : INTEGER
FOR I ← 1 TO 3
  OUTPUT I
NEXT I
// Output: 1
// Output: 2
// Output: 3`,
      commonMistake:
        'Forgetting `NEXT`, or changing the loop variable inside the body in a way that breaks the count.',
      examTip:
        'State that TO is inclusive when explaining how many times the body runs.',
    },
  },
  {
    re: /\bwhile\b|\brepeat\b/,
    title: 'WHILE / REPEAT',
    card: {
      directAnswer:
        '`WHILE` tests the condition **before** the body (may run zero times). `REPEAT … UNTIL` tests **after** (runs at least once).',
      explanation:
        'Use WHILE when the body should not run if the condition is already false. Use REPEAT when you must prompt or read at least once, then stop when a condition becomes true.',
      example: `DECLARE N : INTEGER
N ← 3
WHILE N > 0 DO
  OUTPUT N
  N ← N - 1
ENDWHILE
// Output: 3
// Output: 2
// Output: 1`,
      commonMistake:
        'Writing UNTIL with the opposite boolean sense (looping forever or stopping immediately).',
      examTip:
        'Say “pre-conditioned” (WHILE) vs “post-conditioned” (REPEAT) in definitions.',
    },
  },
  {
    re: /\bcase\b/,
    title: 'CASE OF',
    card: {
      directAnswer:
        '`CASE OF` selects among discrete labels (with optional OTHERWISE). Prefer it over deep nested IF when branching on one expression.',
      explanation:
        'Evaluate the expression once, match a label, run that branch, then leave the CASE. OTHERWISE covers remaining values. Keep labels mutually clear for the examiner.',
      example: `DECLARE Grade : CHAR
Grade ← 'B'
CASE OF Grade
  'A': OUTPUT "Excellent"
  'B': OUTPUT "Good"
  OTHERWISE: OUTPUT "Keep practising"
ENDCASE
// Output: Good`,
      commonMistake:
        'Falling through labels as in some other languages — Cambridge CASE runs one matching branch.',
      examTip:
        'Always include OTHERWISE when the question’s domain is not fully listed.',
    },
  },
];

export function matchConcept(question: string): ConceptEntry | null {
  for (const c of CONCEPTS) {
    if (c.re.test(question)) return c;
  }
  return null;
}

export function formatConceptAnswer(entry: ConceptEntry): string {
  return formatTutorResponse(entry.card);
}
