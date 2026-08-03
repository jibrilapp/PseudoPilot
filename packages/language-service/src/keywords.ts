/**
 * Cambridge keywords (hard-reserved). Used for rename validation + completion.
 * Soft-reserved builtins live in language-core CORE_BUILTINS.
 */

export const CAMBRIDGE_KEYWORDS: readonly string[] = [
  'INPUT',
  'OUTPUT',
  'TRUE',
  'FALSE',
  'DIV',
  'MOD',
  'DECLARE',
  'CONSTANT',
  'TYPE',
  'ENDTYPE',
  'IF',
  'THEN',
  'ELSE',
  'ENDIF',
  'CASE',
  'OTHERWISE',
  'ENDCASE',
  'WHILE',
  'DO',
  'ENDWHILE',
  'FOR',
  'TO',
  'STEP',
  'NEXT',
  'REPEAT',
  'UNTIL',
  'PROCEDURE',
  'ENDPROCEDURE',
  'FUNCTION',
  'ENDFUNCTION',
  'RETURNS',
  'RETURN',
  'CALL',
  'AND',
  'OR',
  'NOT',
  'ARRAY',
  'OF',
  'INTEGER',
  'REAL',
  'STRING',
  'BOOLEAN',
  'CHAR',
  'OPENFILE',
  'READFILE',
  'WRITEFILE',
  'CLOSEFILE',
  'READ',
  'WRITE',
  'APPEND',
  'EOF',
];

const KEYWORD_SET = new Set(CAMBRIDGE_KEYWORDS.map((k) => k.toLowerCase()));

export function isKeyword(name: string): boolean {
  return KEYWORD_SET.has(name.toLowerCase());
}
