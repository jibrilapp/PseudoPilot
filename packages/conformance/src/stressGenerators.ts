/**
 * Pathological / large program generators for stability & performance stress.
 * No language semantics invented — only valid Cambridge-shaped source.
 */

/** Many independent statements (paste / large-file stress). */
export function manyAssignments(count: number): string {
  const lines: string[] = ['DECLARE Total : INTEGER', 'Total ← 0'];
  for (let i = 0; i < count; i += 1) {
    lines.push(`Total ← Total + ${i % 17}`);
  }
  lines.push('OUTPUT Total');
  return lines.join('\n');
}

/** Deep IF nesting (parser/checker stack pressure). */
export function deepIfNesting(depth: number): string {
  const lines: string[] = ['DECLARE N : INTEGER', 'N ← 1'];
  for (let i = 0; i < depth; i += 1) {
    lines.push(`${'  '.repeat(i)}IF N > 0 THEN`);
  }
  lines.push(`${'  '.repeat(depth)}N ← N + 1`);
  for (let i = depth - 1; i >= 0; i -= 1) {
    lines.push(`${'  '.repeat(i)}ENDIF`);
  }
  lines.push('OUTPUT N');
  return lines.join('\n');
}

/** Thousands of scalar declarations + one use. */
export function manyDeclarations(count: number): string {
  const lines: string[] = [];
  for (let i = 0; i < count; i += 1) {
    lines.push(`DECLARE V${i} : INTEGER`);
  }
  lines.push('V0 ← 1');
  for (let i = 1; i < Math.min(count, 50); i += 1) {
    lines.push(`V${i} ← V${i - 1} + 1`);
  }
  lines.push(`OUTPUT V${Math.min(count, 50) - 1}`);
  return lines.join('\n');
}

/** Very long identifier names. */
export function longIdentifiers(nameLen: number, count = 3): string {
  const names = Array.from({ length: count }, (_, i) => `A${'x'.repeat(nameLen)}${i}`);
  const lines: string[] = names.map((n) => `DECLARE ${n} : INTEGER`);
  lines.push(`${names[0]} ← 1`);
  for (let i = 1; i < names.length; i += 1) {
    lines.push(`${names[i]} ← ${names[i - 1]} + 1`);
  }
  lines.push(`OUTPUT ${names[names.length - 1]}`);
  return lines.join('\n');
}

/** Large 1D array fill + sum. */
export function largeArrayProgram(size: number): string {
  return `
DECLARE A : ARRAY[1:${size}] OF INTEGER
DECLARE I, Sum : INTEGER
Sum ← 0
FOR I ← 1 TO ${size}
  A[I] ← I
  Sum ← Sum + A[I]
NEXT I
OUTPUT Sum
`.trim();
}

/** TYPE with many fields. */
export function massiveType(fieldCount: number): string {
  const lines: string[] = ['TYPE BigRec'];
  for (let i = 0; i < fieldCount; i += 1) {
    lines.push(`  DECLARE F${i} : INTEGER`);
  }
  lines.push('ENDTYPE');
  lines.push('DECLARE R : BigRec');
  lines.push('R.F0 ← 1');
  if (fieldCount > 1) {
    lines.push(`R.F${fieldCount - 1} ← R.F0 + 1`);
    lines.push(`OUTPUT R.F${fieldCount - 1}`);
  } else {
    lines.push('OUTPUT R.F0');
  }
  return lines.join('\n');
}

/** CLASS with many methods (parse/check/translate pressure). */
export function massiveClass(methodCount: number): string {
  const lines: string[] = [
    'CLASS BigObj',
    '  PRIVATE Value : INTEGER',
    '  PUBLIC PROCEDURE NEW(Start : INTEGER)',
    '    Value ← Start',
    '  ENDPROCEDURE',
  ];
  for (let i = 0; i < methodCount; i += 1) {
    lines.push(`  PUBLIC PROCEDURE M${i}`);
    lines.push(`    Value ← Value + ${i + 1}`);
    lines.push('  ENDPROCEDURE');
  }
  lines.push('  PUBLIC FUNCTION Get() RETURNS INTEGER');
  lines.push('    RETURN Value');
  lines.push('  ENDFUNCTION');
  lines.push('ENDCLASS');
  lines.push('DECLARE O : BigObj');
  lines.push('O ← NEW BigObj(0)');
  const callN = Math.min(methodCount, 20);
  for (let i = 0; i < callN; i += 1) {
    lines.push(`CALL O.M${i}()`);
  }
  lines.push('OUTPUT O.Get()');
  return lines.join('\n');
}

/** Recursive function (deep call stack when run). */
export function recursiveSum(n: number): string {
  return `
FUNCTION SumTo(N : INTEGER) RETURNS INTEGER
  IF N <= 0 THEN
    RETURN 0
  ELSE
    RETURN N + SumTo(N - 1)
  ENDIF
ENDFUNCTION
OUTPUT SumTo(${n})
`.trim();
}

/** Many procedures declared (symbol-table pressure). */
export function manyProcedures(count: number): string {
  const lines: string[] = [];
  for (let i = 0; i < count; i += 1) {
    lines.push(`PROCEDURE P${i}`);
    lines.push(`  OUTPUT ${i}`);
    lines.push('ENDPROCEDURE');
  }
  lines.push(`CALL P0()`);
  if (count > 1) {
    lines.push(`CALL P${count - 1}()`);
  }
  return lines.join('\n');
}

/** Sequential text file write/read cycles. */
export function manyFileOps(lineCount: number): string {
  const lines: string[] = [
    'DECLARE I : INTEGER',
    'DECLARE Line : STRING',
    'OPENFILE "stress.txt" FOR WRITE',
  ];
  for (let i = 0; i < lineCount; i += 1) {
    lines.push(`WRITEFILE "stress.txt", "L${i}"`);
  }
  lines.push('CLOSEFILE "stress.txt"');
  lines.push('OPENFILE "stress.txt" FOR READ');
  lines.push('I ← 0');
  lines.push('WHILE NOT EOF("stress.txt")');
  lines.push('  READFILE "stress.txt", Line');
  lines.push('  I ← I + 1');
  lines.push('ENDWHILE');
  lines.push('CLOSEFILE "stress.txt"');
  lines.push('OUTPUT I');
  return lines.join('\n');
}

/** Nested FOR loops (interpreter step pressure). */
export function nestedLoops(outer: number, inner: number): string {
  return `
DECLARE I, J, C : INTEGER
C ← 0
FOR I ← 1 TO ${outer}
  FOR J ← 1 TO ${inner}
    C ← C + 1
  NEXT J
NEXT I
OUTPUT C
`.trim();
}

/** Compact program used for repeated compile/translate cycles. */
export function cycleSample(): string {
  return `
DECLARE X : INTEGER
X ← 0
FOR X ← 1 TO 10
  OUTPUT X
NEXT X
`.trim();
}

/** Expected triangular number for largeArrayProgram(size). */
export function triangular(n: number): number {
  return (n * (n + 1)) / 2;
}
