import type { SourceSpan } from '../diagnostics.js';

/**
 * Token kinds for Cambridge pseudocode.
 * TokenKind.Eof is stream end; FileEof is the EOF(…) builtin keyword.
 */
export enum TokenKind {
  Identifier = 'Identifier',
  Integer = 'Integer',
  Real = 'Real',
  String = 'String',
  Char = 'Char',
  Boolean = 'Boolean',

  Input = 'Input',
  Output = 'Output',
  True = 'True',
  False = 'False',
  Div = 'Div',
  Mod = 'Mod',
  Declare = 'Declare',
  Constant = 'Constant',
  If = 'If',
  Then = 'Then',
  Else = 'Else',
  Endif = 'Endif',
  Case = 'Case',
  Otherwise = 'Otherwise',
  Endcase = 'Endcase',
  While = 'While',
  Do = 'Do',
  Endwhile = 'Endwhile',
  For = 'For',
  To = 'To',
  Step = 'Step',
  Next = 'Next',
  Repeat = 'Repeat',
  Until = 'Until',
  Procedure = 'Procedure',
  Endprocedure = 'Endprocedure',
  Function = 'Function',
  Endfunction = 'Endfunction',
  Returns = 'Returns',
  Return = 'Return',
  Call = 'Call',
  And = 'And',
  Or = 'Or',
  Not = 'Not',

  Array = 'Array',
  Of = 'Of',
  Openfile = 'Openfile',
  Readfile = 'Readfile',
  Writefile = 'Writefile',
  Closefile = 'Closefile',
  FileRead = 'FileRead',
  FileWrite = 'FileWrite',
  FileAppend = 'FileAppend',
  FileEof = 'FileEof',

  TypeInteger = 'TypeInteger',
  TypeReal = 'TypeReal',
  TypeString = 'TypeString',
  TypeBoolean = 'TypeBoolean',
  TypeChar = 'TypeChar',

  Assign = 'Assign',
  Equal = 'Equal',
  NotEqual = 'NotEqual',
  Less = 'Less',
  LessEqual = 'LessEqual',
  Greater = 'Greater',
  GreaterEqual = 'GreaterEqual',
  Plus = 'Plus',
  Minus = 'Minus',
  Star = 'Star',
  Slash = 'Slash',
  Ampersand = 'Ampersand',
  LParen = 'LParen',
  RParen = 'RParen',
  LBracket = 'LBracket',
  RBracket = 'RBracket',
  Comma = 'Comma',
  Colon = 'Colon',
  Newline = 'Newline',

  Eof = 'Eof',
}

export type Token = {
  readonly kind: TokenKind;
  readonly lexeme: string;
  readonly span: SourceSpan;
  readonly literal?: string | number | boolean;
};

const KEYWORDS: ReadonlyMap<string, TokenKind> = new Map([
  ['INPUT', TokenKind.Input],
  ['OUTPUT', TokenKind.Output],
  ['TRUE', TokenKind.True],
  ['FALSE', TokenKind.False],
  ['DIV', TokenKind.Div],
  ['MOD', TokenKind.Mod],
  ['DECLARE', TokenKind.Declare],
  ['CONSTANT', TokenKind.Constant],
  ['IF', TokenKind.If],
  ['THEN', TokenKind.Then],
  ['ELSE', TokenKind.Else],
  ['ENDIF', TokenKind.Endif],
  ['CASE', TokenKind.Case],
  ['OTHERWISE', TokenKind.Otherwise],
  ['ENDCASE', TokenKind.Endcase],
  ['WHILE', TokenKind.While],
  ['DO', TokenKind.Do],
  ['ENDWHILE', TokenKind.Endwhile],
  ['FOR', TokenKind.For],
  ['TO', TokenKind.To],
  ['STEP', TokenKind.Step],
  ['NEXT', TokenKind.Next],
  ['REPEAT', TokenKind.Repeat],
  ['UNTIL', TokenKind.Until],
  ['PROCEDURE', TokenKind.Procedure],
  ['ENDPROCEDURE', TokenKind.Endprocedure],
  ['FUNCTION', TokenKind.Function],
  ['ENDFUNCTION', TokenKind.Endfunction],
  ['RETURNS', TokenKind.Returns],
  ['RETURN', TokenKind.Return],
  ['CALL', TokenKind.Call],
  ['AND', TokenKind.And],
  ['OR', TokenKind.Or],
  ['NOT', TokenKind.Not],
  ['ARRAY', TokenKind.Array],
  ['OF', TokenKind.Of],
  ['OPENFILE', TokenKind.Openfile],
  ['READFILE', TokenKind.Readfile],
  ['WRITEFILE', TokenKind.Writefile],
  ['CLOSEFILE', TokenKind.Closefile],
  ['READ', TokenKind.FileRead],
  ['WRITE', TokenKind.FileWrite],
  ['APPEND', TokenKind.FileAppend],
  ['EOF', TokenKind.FileEof],
  ['INTEGER', TokenKind.TypeInteger],
  ['REAL', TokenKind.TypeReal],
  ['STRING', TokenKind.TypeString],
  ['BOOLEAN', TokenKind.TypeBoolean],
  ['CHAR', TokenKind.TypeChar],
]);

export function keywordKind(lexeme: string): TokenKind | undefined {
  return KEYWORDS.get(lexeme.toUpperCase());
}

export function isTypeToken(kind: TokenKind): boolean {
  return (
    kind === TokenKind.TypeInteger ||
    kind === TokenKind.TypeReal ||
    kind === TokenKind.TypeString ||
    kind === TokenKind.TypeBoolean ||
    kind === TokenKind.TypeChar
  );
}

export function isFileModeToken(kind: TokenKind): boolean {
  return (
    kind === TokenKind.FileRead ||
    kind === TokenKind.FileWrite ||
    kind === TokenKind.FileAppend
  );
}
