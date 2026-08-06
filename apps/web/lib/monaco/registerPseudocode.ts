/**
 * Register Cambridge pseudocode language + light IDE theme for Monaco.
 */

import type * as Monaco from 'monaco-editor';
import { PSEUDOCODE_LANGUAGE_ID } from './protocol';

let registered = false;

export const KEYWORDS = [
  'DECLARE',
  'CONSTANT',
  'TYPE',
  'SET',
  'DEFINE',
  'ENDTYPE',
  'IF',
  'THEN',
  'ELSE',
  'ELSEIF',
  'ENDIF',
  'WHILE',
  'ENDWHILE',
  'FOR',
  'TO',
  'STEP',
  'NEXT',
  'REPEAT',
  'UNTIL',
  'CASE',
  'OF',
  'OTHERWISE',
  'ENDCASE',
  'PROCEDURE',
  'ENDPROCEDURE',
  'FUNCTION',
  'ENDFUNCTION',
  'RETURNS',
  'RETURN',
  'CALL',
  'OUTPUT',
  'INPUT',
  'AND',
  'OR',
  'NOT',
  'TRUE',
  'FALSE',
  'DIV',
  'MOD',
  'OPENFILE',
  'READFILE',
  'WRITEFILE',
  'CLOSEFILE',
  'SEEK',
  'GETRECORD',
  'PUTRECORD',
  'READ',
  'WRITE',
  'APPEND',
  'RANDOM',
  'CLASS',
  'ENDCLASS',
  'PUBLIC',
  'PRIVATE',
  'INHERITS',
  'SUPER',
  'NEW',
];

export const TYPES = ['INTEGER', 'REAL', 'STRING', 'BOOLEAN', 'CHAR', 'DATE', 'ARRAY'];

/** Exported for unit tests — must stay in sync with `setLanguageConfiguration` below. */
export const INDENT_INCREASE_PATTERN =
  /^\s*(IF|ELSE|ELSEIF|WHILE|FOR|REPEAT|CASE|PROCEDURE|FUNCTION|TYPE|CLASS|OTHERWISE)\b/i;
export const INDENT_DECREASE_PATTERN =
  /^\s*(ENDIF|ENDWHILE|NEXT|UNTIL|ENDCASE|ENDPROCEDURE|ENDFUNCTION|ENDTYPE|ENDCLASS|ELSE|ELSEIF|OTHERWISE)\b/i;
export const FOLDING_START_PATTERN =
  /^\s*(IF|WHILE|FOR|REPEAT|CASE|PROCEDURE|FUNCTION|TYPE|CLASS)\b/i;
export const FOLDING_END_PATTERN =
  /^\s*(ENDIF|ENDWHILE|NEXT|UNTIL|ENDCASE|ENDPROCEDURE|ENDFUNCTION|ENDTYPE|ENDCLASS)\b/i;

export function ensurePseudocodeLanguage(monaco: typeof Monaco): void {
  if (registered) return;
  registered = true;

  monaco.languages.register({ id: PSEUDOCODE_LANGUAGE_ID });

  monaco.languages.setLanguageConfiguration(PSEUDOCODE_LANGUAGE_ID, {
    comments: { lineComment: '//' },
    brackets: [
      ['(', ')'],
      ['[', ']'],
    ],
    autoClosingPairs: [
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    indentationRules: {
      increaseIndentPattern: INDENT_INCREASE_PATTERN,
      decreaseIndentPattern: INDENT_DECREASE_PATTERN,
    },
    folding: {
      markers: {
        start: FOLDING_START_PATTERN,
        end: FOLDING_END_PATTERN,
      },
    },
  });

  monaco.languages.setMonarchTokensProvider(PSEUDOCODE_LANGUAGE_ID, {
    ignoreCase: true,
    defaultToken: '',
    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string_double'],
        [/'([^'\\]|\\.)*$/, 'string.invalid'],
        [/'/, 'string', '@string_single'],
        [/\d+\.\d+/, 'number.float'],
        [/\d+/, 'number'],
        [/←|<-/, 'operator'],
        [/[=<>]=|<>|[+\-*/&=<>]/, 'operator'],
        [
          /[a-zA-Z_][\w]*/,
          {
            cases: {
              '@keywords': 'keyword',
              '@types': 'type',
              '@builtins': 'predefined',
              '@default': 'identifier',
            },
          },
        ],
        [/[{}()[\]]/, '@brackets'],
        [/[,.:]/, 'delimiter'],
      ],
      string_double: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop'],
      ],
      string_single: [
        [/[^\\']+/, 'string'],
        [/\\./, 'string.escape'],
        [/'/, 'string', '@pop'],
      ],
    },
    keywords: KEYWORDS,
    types: TYPES,
    builtins: [
      'LENGTH',
      'LEFT',
      'RIGHT',
      'MID',
      'LCASE',
      'UCASE',
      'INT',
      'RAND',
      'ASC',
      'CHR',
      'IS_NUM',
      'EOF',
      'DAY',
      'MONTH',
      'YEAR',
      'DAYINDEX',
      'SETDATE',
      'TODAY',
    ],
  });

  monaco.editor.defineTheme('pseudopilot-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '64748B', fontStyle: 'italic' },
      { token: 'keyword', foreground: '0D7370', fontStyle: 'bold' },
      { token: 'type', foreground: '0369A1' },
      { token: 'predefined', foreground: '7C3AED' },
      { token: 'string', foreground: 'B45309' },
      { token: 'number', foreground: 'C2410C' },
      { token: 'operator', foreground: '334155' },
      { token: 'identifier', foreground: '0F172A' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#0F172A',
      'editorLineNumber.foreground': '#94A3B8',
      'editorLineNumber.activeForeground': '#475569',
      'editor.selectionBackground': '#0D73702E',
      'editor.lineHighlightBackground': '#0D73700A',
      'editorCursor.foreground': '#0D7370',
      'editorIndentGuide.background': '#E2E8F0',
      'editorGutter.background': '#FAFBFC',
      'editorWidget.background': '#FFFFFF',
      'editorWidget.border': '#E2E8F0',
      'scrollbarSlider.background': '#0F172A22',
      'scrollbarSlider.hoverBackground': '#0F172A33',
    },
  });
}

/** Test helper — reset registration flag between Vitest runs. */
export function resetPseudocodeLanguageRegistrationForTests(): void {
  registered = false;
}
