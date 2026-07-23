/**
 * @pseudopilot/language-core
 *
 * Deterministic Cambridge pseudocode language pipeline.
 * Lexer + recursive-descent / Pratt parser → AST.
 */

export const PACKAGE_NAME = '@pseudopilot/language-core' as const;
export const PACKAGE_VERSION = '0.0.0' as const;

export { parse, type ParseResult } from './parse.js';
export { lex, type LexResult } from './lexer/lexer.js';
export type {
  Program,
  Statement,
  Expression,
  AssignmentStatement,
  InputStatement,
  OutputStatement,
  IfStatement,
  WhileStatement,
  ElseIfClause,
  DeclareStatement,
  ProcedureDeclaration,
  FunctionDeclaration,
  CallStatement,
  ReturnStatement,
  OpenFileStatement,
  ReadFileStatement,
  WriteFileStatement,
  CloseFileStatement,
  CallExpression,
  IndexExpression,
  EofExpression,
  ArrayType,
  ArrayDimension,
  TypeReference,
  AssignTarget,
  FileMode,
  Parameter,
  TypeName,
  TypeNameKind,
  Identifier,
  BinaryExpression,
  UnaryExpression,
  GroupingExpression,
  IntegerLiteral,
  RealLiteral,
  StringLiteral,
  CharLiteral,
  BooleanLiteral,
  BinaryOperator,
  UnaryOperator,
  AstNode,
} from './ast/nodes.js';
export { TokenKind, type Token, isTypeToken, isFileModeToken } from './lexer/token.js';
export type {
  Diagnostic,
  DiagnosticSeverity,
  Position,
  SourceSpan,
} from './diagnostics.js';
