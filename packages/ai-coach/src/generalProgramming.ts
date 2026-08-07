/**
 * Educational answers for ordinary CS questions that are not Cambridge
 * Pseudocode theory and not PseudoPilot product features.
 *
 * Coding how-tos in this IDE prefer Cambridge 9618 Pseudocode examples.
 */

export type GeneralProgrammingAnswer = {
  readonly message: string;
  readonly citations: readonly { readonly label: string }[];
};

type Topic = {
  readonly re: RegExp;
  readonly title: string;
  readonly answer: string;
};

/** How-to / basics — checked before “what is X” topic cards. */
const HOW_TOS: readonly Topic[] = [
  {
    re: /\b(add|sum|plus)\b.{0,50}\b(variable|number|value|them|together)|\b(variable|number|value).{0,40}\b(add|sum|together)|\badd\b.{0,20}\b2\b|\btogether\b/,
    title: 'Adding values',
    answer: [
      '**Add values with `+` (or accumulate into a variable).**',
      '',
      'Declare the variables, assign values, then use `+` in an expression. In Cambridge 9618 Pseudocode:',
      '```pseudocode',
      'DECLARE A : INTEGER',
      'DECLARE B : INTEGER',
      'DECLARE Total : INTEGER',
      'A ← 3',
      'B ← 5',
      'Total ← A + B',
      'OUTPUT Total',
      '// Output: 8',
      '```',
      '',
      'You can also update one variable: `A ← A + B`. Assignment uses `←` (or `<-`), not `=`.',
    ].join('\n'),
  },
  {
    re: /\bmultipl|\btimes\b|\bproduct\b/,
    title: 'Multiplying numbers',
    answer: [
      '**Multiply with `*`.**',
      '',
      'In Cambridge 9618 Pseudocode:',
      '```pseudocode',
      'DECLARE X : INTEGER',
      'DECLARE Y : INTEGER',
      'DECLARE Product : INTEGER',
      'X ← 4',
      'Y ← 6',
      'Product ← X * Y',
      'OUTPUT Product',
      '// Output: 24',
      '```',
      '',
      'For integer division use `DIV`; for remainder use `MOD`. Ordinary division of REAL values uses `/`.',
    ].join('\n'),
  },
  {
    re: /\bconcatenat|\bjoin\b.{0,30}\bstring|\bstring\b.{0,40}\b(join|concat|combin|add|glue)|\b(add|join|combin).{0,30}\bstrings?\b/,
    title: 'Concatenating strings',
    answer: [
      '**Join strings with `&` in Cambridge Pseudocode** (Python uses `+` or f-strings).',
      '',
      '```pseudocode',
      'DECLARE First : STRING',
      'DECLARE Last : STRING',
      'DECLARE Full : STRING',
      'First ← "Ada"',
      'Last ← "Lovelace"',
      'Full ← First & " " & Last',
      'OUTPUT Full',
      '// Output: Ada Lovelace',
      '```',
      '',
      'Keep types consistent: concatenate STRINGs (convert numbers with `INT_TO_STR` / similar helpers if your teaching set provides them).',
    ].join('\n'),
  },
  {
    re: /\bcompar|\bequal\b|\bgreater\b|\bless\b|\b(==|<>|!=)\b/,
    title: 'Comparing values',
    answer: [
      '**Compare with relational operators; the result is BOOLEAN.**',
      '',
      'Cambridge Pseudocode uses `=`, `<>`, `<`, `>`, `<=`, `>=` (not `==`). Combine with `AND` / `OR` / `NOT`.',
      '```pseudocode',
      'DECLARE A : INTEGER',
      'DECLARE B : INTEGER',
      'A ← 10',
      'B ← 7',
      'IF A > B THEN',
      '  OUTPUT "A is larger"',
      'ELSE',
      '  OUTPUT "A is not larger"',
      'ENDIF',
      '// Output: A is larger',
      '```',
      '',
      'Equality is a single `=` in Pseudocode; `<>` means “not equal”.',
    ].join('\n'),
  },
  {
    re: /\bcall\b.{0,30}\bprocedure|\b(invoke|run|use)\b.{0,20}\bprocedure|\bprocedure\b.{0,40}\b(call|invoke)/,
    title: 'Calling a procedure',
    answer: [
      '**Start a PROCEDURE with `CALL` and pass arguments in parentheses.**',
      '',
      'Procedures do not return a value. Parameters default to BYVAL; use BYREF only when the routine must update the caller’s variable.',
      '```pseudocode',
      'PROCEDURE Greet(Name : STRING)',
      '  OUTPUT "Hello ", Name',
      'ENDPROCEDURE',
      '',
      'CALL Greet("Sam")',
      '// Output: Hello Sam',
      '```',
      '',
      'Do not write `CALL` for a FUNCTION — use the function name inside an expression instead.',
    ].join('\n'),
  },
  {
    re: /\breturn\b.{0,50}\b(value|result|function)|\breturn.{0,20}\bfrom\b.{0,20}\bfunction|\bfunction\b.{0,40}\breturn/,
    title: 'Returning from a function',
    answer: [
      '**A FUNCTION declares `RETURNS` a type and exits with `RETURN` expression.**',
      '',
      'Use the function in an assignment or `OUTPUT` — do not `CALL` it.',
      '```pseudocode',
      'FUNCTION Double(N : INTEGER) RETURNS INTEGER',
      '  RETURN N * 2',
      'ENDFUNCTION',
      '',
      'DECLARE Result : INTEGER',
      'Result ← Double(7)',
      'OUTPUT Result',
      '// Output: 14',
      '```',
      '',
      'FUNCTIONs must not use BYREF. If you need in-place updates, use a PROCEDURE instead.',
    ].join('\n'),
  },
  {
    re: /\b(create|declare|make|define)\b.{0,30}\barray|\barray\b.{0,40}\b(create|declare|make|defin|use)/,
    title: 'Creating an array',
    answer: [
      '**Declare an ARRAY with bounds and element type, then assign by index.**',
      '',
      'Cambridge teaching examples are often 1-based and inclusive on both bounds:',
      '```pseudocode',
      'DECLARE Scores : ARRAY[1:3] OF INTEGER',
      'DECLARE I : INTEGER',
      'FOR I ← 1 TO 3',
      '  Scores[I] ← I * 10',
      'NEXT I',
      'OUTPUT Scores[2]',
      '// Output: 20',
      '```',
      '',
      'Stay inside the DECLARE’d bounds. Pass an array BYREF when a PROCEDURE must change elements in place.',
    ].join('\n'),
  },
  {
    re: /\bfor\s+loop\b|\buse\s+(a\s+)?for\b|\bcounted\s+loop\b|\bfor\b.{0,20}\b(to|next|loop)\b/,
    title: 'FOR loops',
    answer: [
      '**`FOR … TO … NEXT` repeats a counted range (inclusive), optionally with `STEP`.**',
      '',
      '```pseudocode',
      'DECLARE I : INTEGER',
      'FOR I ← 1 TO 3',
      '  OUTPUT I',
      'NEXT I',
      '// Output: 1',
      '// Output: 2',
      '// Output: 3',
      '```',
      '',
      'Prefer FOR when you know how many iterations you need. Use `WHILE` / `REPEAT` when the stop condition is not a simple count.',
    ].join('\n'),
  },
];

const TOPICS: readonly Topic[] = [
  {
    re: /\bpython\b.{0,40}\b(generate|create|produce|output|write|emit).{0,20}\bhtml\b|\b(generate|create|produce|output|write|emit).{0,20}\bhtml\b.{0,40}\bpython\b|\bcan python\b.{0,40}\bhtml\b/,
    title: 'Python and HTML',
    answer: [
      '**Yes — Python can generate HTML** as ordinary text (or with libraries).',
      '',
      'Python itself is not a browser markup language, but you can build HTML strings, write `.html` files, or use templating/web frameworks (Jinja, Flask, Django, FastAPI) that emit HTML for browsers. Example of the simple approach:',
      '```python',
      'name = "Sam"',
      'html = f"<p>Hello, {name}</p>"',
      'with open("out.html", "w", encoding="utf-8") as f:',
      '    f.write(html)',
      '```',
      '',
      'PseudoPilot’s editors are Cambridge Pseudocode ↔ Python only — they are not an HTML authoring environment — but general Python outside this IDE can produce HTML freely.',
    ].join('\n'),
  },
  {
    re: /\bhtml\b/,
    title: 'HTML',
    answer: [
      '**HTML** (HyperText Markup Language) is the standard language for structuring web pages.',
      '',
      'You write nested **tags** that describe content: headings (`<h1>`), paragraphs (`<p>`), links (`<a>`), images (`<img>`), lists, forms, and so on. Browsers parse the markup into a document tree (DOM) and display it. HTML is about structure and meaning; **CSS** styles appearance, and **JavaScript** adds behaviour.',
      '',
      'A minimal page looks like:',
      '```html',
      '<!DOCTYPE html>',
      '<html>',
      '  <head><title>Hello</title></head>',
      '  <body><p>Hello, world</p></body>',
      '</html>',
      '```',
    ].join('\n'),
  },
  {
    re: /\bjavascript\b|\bjs\b/,
    title: 'JavaScript',
    answer: [
      '**JavaScript** is a programming language that runs in web browsers (and on servers via Node.js).',
      '',
      'It adds interactivity to pages: responding to clicks, updating the DOM, talking to APIs, and running logic in the page. It is dynamically typed, uses functions and objects heavily, and is distinct from **Java** despite the similar name.',
      '',
      'Example:',
      '```javascript',
      'const name = "Sam";',
      'console.log(`Hello, ${name}`);',
      '```',
    ].join('\n'),
  },
  {
    re: /\bjson\b/,
    title: 'JSON',
    answer: [
      '**JSON** (JavaScript Object Notation) is a lightweight text format for exchanging structured data.',
      '',
      'It supports objects (`{ "key": value }`), arrays (`[1, 2]`), strings, numbers, booleans, and `null`. Many languages can parse and produce JSON. It is language-agnostic despite the “JavaScript” in the name — APIs and config files use it widely.',
      '',
      'Example:',
      '```json',
      '{ "name": "Sam", "score": 42, "passed": true }',
      '```',
    ].join('\n'),
  },
  {
    re: /\bgit\b/,
    title: 'Git',
    answer: [
      '**Git** is a distributed version-control system for tracking changes in source code.',
      '',
      'You keep a history of commits (snapshots), create branches to work in parallel, and merge or rebase to combine work. Remotes (e.g. GitHub) host shared copies so teams can collaborate. Common commands: `git status`, `git add`, `git commit`, `git push`, `git pull`.',
      '',
      'Git records *what changed* over time so you can review, revert, and collaborate safely.',
    ].join('\n'),
  },
  {
    re: /\bcss\b/,
    title: 'CSS',
    answer: [
      '**CSS** (Cascading Style Sheets) describes how HTML content should look.',
      '',
      'Selectors target elements; properties set colour, layout, fonts, spacing, and responsive behaviour. Cascading means more specific or later rules can override earlier ones. HTML structures the page; CSS styles it.',
    ].join('\n'),
  },
  {
    re: /\boop\b|object[- ]orient/,
    title: 'OOP',
    answer: [
      '**OOP** (object-oriented programming) organises programs around **objects** that combine data (attributes) and behaviour (methods).',
      '',
      'Core ideas:',
      '- **Encapsulation** — keep state and the operations on it together',
      '- **Classes** — blueprints for creating objects',
      '- **Inheritance** — specialised classes reuse and extend base classes',
      '- **Polymorphism** — the same message can behave differently on different types',
      '',
      'Languages like Python, Java, and Cambridge Pseudocode (with `CLASS`) support OOP; other styles (procedural, functional) organise code differently.',
    ].join('\n'),
  },
  {
    re: /\brecursion\b|\brecursive\b/,
    title: 'Recursion',
    answer: [
      '**Recursion** is when a function (or procedure) solves a problem by calling itself on a smaller instance, until a **base case** stops the chain.',
      '',
      'Every recursive solution needs:',
      '1. A base case that returns without calling itself',
      '2. A recursive case that moves toward that base case',
      '',
      'In Python:',
      '```python',
      'def factorial(n: int) -> int:',
      '    if n <= 1:',
      '        return 1',
      '    return n * factorial(n - 1)',
      '```',
      '',
      'Without a correct base case, recursion never ends (stack overflow / RecursionError).',
    ].join('\n'),
  },
  {
    re: /\bapi\b|application programming interface/,
    title: 'API',
    answer: [
      'An **API** (Application Programming Interface) is a defined way for one program to talk to another.',
      '',
      'It specifies requests you can make, inputs, and the shape of responses — without exposing internal implementation. Web APIs often use HTTP and JSON; library APIs are the functions and classes a package exposes.',
    ].join('\n'),
  },
  {
    re: /\bhttp\b/,
    title: 'HTTP',
    answer: [
      '**HTTP** (HyperText Transfer Protocol) is how browsers and servers exchange web resources.',
      '',
      'The client sends a request (method like GET/POST, URL, headers, optional body); the server replies with a status code (e.g. 200, 404) and a response body (HTML, JSON, …). HTTPS is HTTP over an encrypted TLS connection.',
    ].join('\n'),
  },
  {
    re: /\bsql\b/,
    title: 'SQL',
    answer: [
      '**SQL** (Structured Query Language) is the standard language for querying and updating relational databases.',
      '',
      'Common statements: `SELECT` (read rows), `INSERT`, `UPDATE`, `DELETE`, plus `JOIN` to combine tables. SQL describes *what* data you want; the database engine decides *how* to fetch it.',
    ].join('\n'),
  },
  {
    re: /\bregex\b|regular expression/,
    title: 'Regular expressions',
    answer: [
      'A **regular expression** (regex) is a pattern language for matching and extracting text.',
      '',
      'Characters, character classes (`\\d`, `\\w`), quantifiers (`*`, `+`, `{n}`), and groups let you describe shapes like email fragments or digits. Most languages include a regex engine; patterns can be powerful but hard to read if overused.',
    ].join('\n'),
  },
  {
    re: /\bcompiler\b/,
    title: 'Compiler',
    answer: [
      'A **compiler** translates source code in one language into another form — often machine code or bytecode — before the program runs.',
      '',
      'It typically checks syntax and types, then emits an executable or intermediate representation. An **interpreter** executes source (or bytecode) more directly. Many modern systems mix both (e.g. compile to bytecode, then interpret/JIT).',
    ].join('\n'),
  },
  {
    re: /\balgorithm\b/,
    title: 'Algorithm',
    answer: [
      'An **algorithm** is a clear, finite sequence of steps that solves a problem or computes a result.',
      '',
      'Good algorithms are correct, terminate, and have understandable cost (time/space). Pseudocode is often used to describe algorithms independently of a specific programming language.',
    ].join('\n'),
  },
  {
    re: /\bvariables?\b/,
    title: 'Variable',
    answer: [
      'A **variable** is a named storage location that holds a value your program can read and update.',
      '',
      'Languages differ on typing (static vs dynamic) and scope (local vs global). In Cambridge Pseudocode you introduce names with `DECLARE` before use; in Python you bind names by assignment.',
      '',
      'Example:',
      '```pseudocode',
      'DECLARE Count : INTEGER',
      'Count ← 0',
      'Count ← Count + 1',
      'OUTPUT Count',
      '// Output: 1',
      '```',
    ].join('\n'),
  },
  {
    re: /\bfunctions?\b/,
    title: 'Function',
    answer: [
      'A **function** is a named block of code that takes inputs (parameters), runs a computation, and usually **returns** a result.',
      '',
      'Functions help reuse logic and keep programs modular. In Cambridge Pseudocode:',
      '```pseudocode',
      'FUNCTION Add(A : INTEGER, B : INTEGER) RETURNS INTEGER',
      '  RETURN A + B',
      'ENDFUNCTION',
      '',
      'OUTPUT Add(2, 3)',
      '// Output: 5',
      '```',
      '',
      'A **procedure** performs an action and is started with `CALL`; it does not return a value for use in expressions.',
    ].join('\n'),
  },
  {
    re: /\barrays?\b|\blists?\b/,
    title: 'Array / list',
    answer: [
      'An **array** (or **list**) stores an ordered sequence of values under one name, usually accessed by index.',
      '',
      'Fixed-size arrays vs growable lists depend on the language. In Cambridge Pseudocode:',
      '```pseudocode',
      'DECLARE A : ARRAY[1:3] OF INTEGER',
      'A[1] ← 10',
      'A[2] ← 20',
      'A[3] ← 30',
      'OUTPUT A[2]',
      '// Output: 20',
      '```',
    ].join('\n'),
  },
  {
    re: /\bboolean\b|\bbool\b/,
    title: 'Boolean',
    answer: [
      'A **Boolean** value is either **true** or **false**.',
      '',
      'Booleans drive decisions (`if` / `WHILE`) and combine with logical operators (`AND`, `OR`, `NOT`). Comparisons like `x > 0` produce Booleans.',
    ].join('\n'),
  },
];

const WHAT_IS =
  /\b(what is|what's|whats|what are|define|explain|meaning of)\b/;

/**
 * Basic coding how-tos answered offline with Cambridge-flavoured examples.
 * Used by the intent classifier so these are not forced into syllabus tutor
 * cards (and never left on the shrug).
 */
export function looksLikeCodingHowTo(q: string): boolean {
  const lower = q.trim().toLowerCase();
  if (!lower) return false;
  // Specific theory questions stay on the Cambridge path.
  if (
    /\bbyref\b|\bbyval\b|change\s+(a\s+)?variable\s+inside|instead\s+of\s+(a\s+)?(function|procedure)/.test(
      lower,
    )
  ) {
    return false;
  }
  if (!/\bhow (do i|do you|can i|to)\b/.test(lower)) return false;
  for (const topic of HOW_TOS) {
    if (topic.re.test(lower)) return true;
  }
  return false;
}

/**
 * True when the question is clearly ordinary CS outside Cambridge Pseudocode
 * product/theory routing (used by the intent classifier).
 */
export function looksLikeGeneralProgrammingTopic(q: string): boolean {
  const lower = q.trim().toLowerCase();
  if (!lower) return false;

  if (looksLikeCodingHowTo(lower)) return true;

  // Explicitly about another language / ecosystem → not Cambridge theory.
  if (
    /\bin\s+(python|javascript|java|c\+\+|cpp|typescript|html|css|sql|ruby|go|rust)\b/.test(
      lower,
    ) &&
    !/\b(cambridge|9618|pseudocode|pseudo[- ]?code)\b/.test(lower)
  ) {
    return true;
  }

  // Standalone OOP / web / tooling topics without Pseudocode framing.
  if (
    /\b(html|css|javascript|\bjs\b|json|git|http|sql|api|regex|regular expression)\b/.test(
      lower,
    ) &&
    !/\b(cambridge|9618|pseudocode|pseudo[- ]?code|translate|export|convert)\b/.test(
      lower,
    )
  ) {
    return true;
  }

  if (
    /\b(oop|object[- ]orient)/.test(lower) &&
    !/\b(cambridge|9618|pseudocode|pseudo[- ]?code|class\b.*\bmethod|inherit)/.test(
      lower,
    )
  ) {
    // Bare "What is OOP?" is general CS; CLASS inheritance questions stay theory.
    if (WHAT_IS.test(lower) || /\bexplain\b/.test(lower)) return true;
  }

  // "Can Python generate HTML?" style capability of a language (not the IDE).
  if (
    /\bcan python\b/.test(lower) &&
    !/\b(here|pseudopilot|this (app|ide|editor|tool))\b/.test(lower)
  ) {
    return true;
  }

  return false;
}

/**
 * True only for empty / gibberish input where no educational answer is possible.
 */
export function isUnintelligibleQuestion(question: string): boolean {
  const q = question.trim();
  if (!q) return true;
  // Very short noise without letters.
  if (q.length < 2) return true;
  const letters = (q.match(/\p{L}/gu) ?? []).length;
  if (letters === 0) return true;
  // Mostly non-letters / keyboard smash with almost no vowels in Latin text.
  const alnum = (q.match(/[\p{L}\p{N}]/gu) ?? []).length;
  if (alnum < 3 && q.length <= 8) return true;
  const words = q.split(/\s+/).filter(Boolean);
  if (
    words.length <= 2 &&
    letters >= 6 &&
    !/[aeiouy]/i.test(q) &&
    !/\b(html|css|sql|api|oop|git|json|http|div|mod)\b/i.test(q)
  ) {
    // e.g. "bcdfghj" — no vowels, not a known acronym topic
    return true;
  }
  if (
    words.length === 1 &&
    q.length >= 12 &&
    !/\s/.test(q) &&
    !/[aeiouy]/i.test(q) &&
    !/^(javascript|typescript|pseudocode)$/i.test(q)
  ) {
    return true;
  }
  return false;
}

/**
 * Produce a substantive educational answer for general programming questions.
 * Returns null only when nothing intelligible can be said (true fallback).
 */
export function answerGeneralProgramming(
  questionLower: string,
  originalQuestion: string,
): GeneralProgrammingAnswer | null {
  const q = questionLower.trim();
  if (!q) return null;
  if (isUnintelligibleQuestion(originalQuestion)) return null;

  // Prefer how-to / basics cards (Cambridge examples for syntax questions).
  for (const topic of HOW_TOS) {
    if (topic.re.test(q)) {
      return {
        citations: [{ label: `General CS: ${topic.title}` }],
        message: topic.answer,
      };
    }
  }

  // Prefer more specific multi-word topics first (Python+HTML, etc.).
  for (const topic of TOPICS) {
    if (topic.re.test(q)) {
      return {
        citations: [{ label: `General CS: ${topic.title}` }],
        message: topic.answer,
      };
    }
  }

  // Sensible explainer for other clear "what is X" questions.
  if (WHAT_IS.test(q)) {
    const term = extractWhatIsTerm(originalQuestion);
    if (term) {
      return {
        citations: [{ label: 'General CS' }],
        message: [
          `**${term}** is a programming / computer-science idea worth learning in its own right.`,
          '',
          `In plain terms: students usually meet “${term}” as a concept with a definition, a small example, and a common pitfall. I do not have a dedicated card for this exact term in the offline coach, but here is a useful framing:`,
          '',
          `- Ask what problem **${term}** solves`,
          `- Sketch one tiny example in a language you know (Python, Pseudocode, …)`,
          `- Note one mistake beginners make with it`,
          '',
          'If you meant a Cambridge 9618 Pseudocode topic (BYREF, DIV, TYPE, ARRAY, …), ask that by name and I will teach it with a full tutor card. If you meant a PseudoPilot feature (translate targets, debug, offline), ask about the IDE specifically.',
        ].join('\n'),
      };
    }
  }

  // Clear how/why programming questions that are still intelligible —
  // never return the shrug; give a direct educational framing + mini example.
  if (
    /\b(how (do|does|can|to)|why (do|does|is|are)|difference between)\b/.test(
      q,
    ) &&
    q.length >= 12
  ) {
    return {
      citations: [{ label: 'General CS' }],
      message: [
        `**Direct answer**`,
        `For “${originalQuestion.trim()}”: break the idea into (1) what you want to compute or do, (2) which construct stores or controls it, and (3) one tiny working example.`,
        '',
        'In this IDE, Cambridge 9618 Pseudocode is the teaching language — a minimal pattern looks like:',
        '```pseudocode',
        'DECLARE Value : INTEGER',
        'Value ← 1',
        'OUTPUT Value',
        '```',
        '',
        'Name the exact operation (add, loop, CALL a PROCEDURE, RETURN from a FUNCTION, ARRAY index, …) for a richer offline card. Ask a 9618 concept or product question when that is what you need.',
      ].join('\n'),
    };
  }

  // Any other prompt with real words — still try to teach rather than shrug.
  if (!isUnintelligibleQuestion(originalQuestion) && q.length >= 8) {
    return {
      citations: [{ label: 'General CS' }],
      message: [
        `Here is a practical take on “${originalQuestion.trim()}”.`,
        '',
        'State the goal in one sentence, pick a small example, then try it in the Pseudocode editor. Common building blocks: `DECLARE`, `←`, `IF` / `FOR` / `WHILE`, `CALL` / `FUNCTION` + `RETURN`, and `ARRAY[…]`.',
        '',
        '```pseudocode',
        'DECLARE Message : STRING',
        'Message ← "Start here"',
        'OUTPUT Message',
        '```',
        '',
        'Rephrase with a concrete topic (e.g. “How do I add two variables?”, “What is JSON?”) for a dedicated offline answer.',
      ].join('\n'),
    };
  }

  return null;
}

function extractWhatIsTerm(original: string): string | null {
  const m = original.match(
    /\b(?:what(?:'s|s)?|what are|define|explain|meaning of)\s+(?:an?\s+|the\s+)?(.+?)(?:\?|$)/i,
  );
  if (!m?.[1]) return null;
  let term = m[1]!.trim();
  term = term.replace(/\s+/g, ' ');
  // Avoid dumping huge leftovers.
  if (term.length < 2 || term.length > 60) return null;
  // Strip trailing filler.
  term = term.replace(/\s+(please|exactly|again)$/i, '').trim();
  if (/^(this|that|it|my|code|program)$/i.test(term)) return null;
  // Title-case short terms for display.
  if (term.length <= 40) {
    return term.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return term;
}
