/**
 * @pseudopilot/language-core
 *
 * Deterministic Cambridge pseudocode language pipeline.
 * Lexer + recursive-descent / Pratt parser → AST.
 */

export const PACKAGE_NAME = '@pseudopilot/language-core' as const;
export const PACKAGE_VERSION = '0.11.0' as const;

export {
  parse,
  DEFAULT_MAX_SOURCE_CHARS,
  ABSOLUTE_MAX_SOURCE_CHARS,
  type ParseResult,
  type ParseOptions,
} from './parse.js';
export { lex, type LexResult } from './lexer/lexer.js';
export type {
  Program,
  Statement,
  Expression,
  AssignmentStatement,
  InputStatement,
  OutputStatement,
  IfStatement,
  CaseStatement,
  CaseArm,
  CaseLabel,
  WhileStatement,
  RepeatStatement,
  ForStatement,
  ElseIfClause,
  DeclareStatement,
  ConstantStatement,
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
  MemberExpression,
  ArrayType,
  ArrayDimension,
  TypeReference,
  NamedType,
  SimpleType,
  AssignTarget,
  FileMode,
  Parameter,
  TypeName,
  TypeNameKind,
  TypeDeclaration,
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
export {
  CORE_BUILTINS,
  lookupBuiltin,
  isBuiltinName,
  allBuiltinNames,
  type BuiltinSpec,
  type BuiltinParamSpec,
} from './builtins/registry.js';
export type {
  Diagnostic,
  DiagnosticSeverity,
  Position,
  SourceSpan,
} from './diagnostics.js';
