import type { SourceSpan } from '../diagnostics.js';

/**
 * Abstract Syntax Tree for Cambridge pseudocode.
 * Every node carries a SourceSpan for diagnostics / debugger mapping.
 */

export type AstNode =
  | Program
  | Statement
  | Expression
  | ElseIfClause
  | Parameter
  | TypeName
  | ArrayType
  | ArrayDimension;

export type Program = {
  readonly kind: 'Program';
  readonly body: Statement[];
  readonly span: SourceSpan;
};

export type Statement =
  | AssignmentStatement
  | InputStatement
  | OutputStatement
  | IfStatement
  | WhileStatement
  | RepeatStatement
  | DeclareStatement
  | ProcedureDeclaration
  | FunctionDeclaration
  | CallStatement
  | ReturnStatement
  | OpenFileStatement
  | ReadFileStatement
  | WriteFileStatement
  | CloseFileStatement;

export type TypeNameKind = 'INTEGER' | 'REAL' | 'STRING' | 'BOOLEAN' | 'CHAR';

export type TypeName = {
  readonly kind: 'TypeName';
  readonly name: TypeNameKind;
  readonly span: SourceSpan;
};

/** ARRAY[lower:upper, …] OF elementType */
export type ArrayType = {
  readonly kind: 'ArrayType';
  readonly dimensions: ArrayDimension[];
  readonly elementType: TypeName;
  readonly span: SourceSpan;
};

export type ArrayDimension = {
  readonly kind: 'ArrayDimension';
  readonly lower: Expression;
  readonly upper: Expression;
  readonly span: SourceSpan;
};

/** Scalar or array type in DECLARE (and potentially elsewhere). */
export type TypeReference = TypeName | ArrayType;

export type FileMode = 'READ' | 'WRITE' | 'APPEND';

/** Left-hand side of assignment / INPUT / READFILE targets. */
export type AssignTarget = Identifier | IndexExpression;

export type Parameter = {
  readonly kind: 'Parameter';
  readonly name: Identifier;
  readonly typeName: TypeName;
  readonly span: SourceSpan;
};

/** DECLARE A, B : INTEGER | DECLARE Scores : ARRAY[1:10] OF INTEGER */
export type DeclareStatement = {
  readonly kind: 'DeclareStatement';
  readonly names: Identifier[];
  readonly typeRef: TypeReference;
  readonly span: SourceSpan;
};

export type ProcedureDeclaration = {
  readonly kind: 'ProcedureDeclaration';
  readonly name: Identifier;
  readonly parameters: Parameter[];
  readonly body: Statement[];
  readonly span: SourceSpan;
};

export type FunctionDeclaration = {
  readonly kind: 'FunctionDeclaration';
  readonly name: Identifier;
  readonly parameters: Parameter[];
  readonly returnType: TypeName;
  readonly body: Statement[];
  readonly span: SourceSpan;
};

export type CallStatement = {
  readonly kind: 'CallStatement';
  readonly callee: Identifier;
  readonly args: Expression[];
  readonly span: SourceSpan;
};

export type ReturnStatement = {
  readonly kind: 'ReturnStatement';
  readonly value: Expression;
  readonly span: SourceSpan;
};

export type AssignmentStatement = {
  readonly kind: 'AssignmentStatement';
  readonly target: AssignTarget;
  readonly value: Expression;
  readonly span: SourceSpan;
};

export type InputStatement = {
  readonly kind: 'InputStatement';
  readonly target: AssignTarget;
  readonly span: SourceSpan;
};

export type OutputStatement = {
  readonly kind: 'OutputStatement';
  readonly expressions: Expression[];
  readonly span: SourceSpan;
};

export type IfStatement = {
  readonly kind: 'IfStatement';
  readonly condition: Expression;
  readonly consequent: Statement[];
  readonly elseIfClauses: ElseIfClause[];
  readonly alternate: Statement[] | null;
  readonly span: SourceSpan;
};

export type ElseIfClause = {
  readonly kind: 'ElseIfClause';
  readonly condition: Expression;
  readonly consequent: Statement[];
  readonly span: SourceSpan;
};

/**
 * WHILE … [DO] … ENDWHILE
 * `DO` is optional (Teacher Guide omits it; many exams include it).
 */
export type WhileStatement = {
  readonly kind: 'WhileStatement';
  readonly condition: Expression;
  readonly body: Statement[];
  /** True when source included an explicit `DO` after the condition. */
  readonly hasDo: boolean;
  readonly span: SourceSpan;
};

/** REPEAT … UNTIL <condition> */
export type RepeatStatement = {
  readonly kind: 'RepeatStatement';
  readonly body: Statement[];
  readonly condition: Expression;
  readonly span: SourceSpan;
};

/** OPENFILE name FOR READ | WRITE | APPEND */
export type OpenFileStatement = {
  readonly kind: 'OpenFileStatement';
  readonly fileName: Expression;
  readonly mode: FileMode;
  readonly span: SourceSpan;
};

/** READFILE name, target */
export type ReadFileStatement = {
  readonly kind: 'ReadFileStatement';
  readonly fileName: Expression;
  readonly target: AssignTarget;
  readonly span: SourceSpan;
};

/** WRITEFILE name, value — used for both write and append modes (mode set at OPEN). */
export type WriteFileStatement = {
  readonly kind: 'WriteFileStatement';
  readonly fileName: Expression;
  readonly value: Expression;
  readonly span: SourceSpan;
};

/** CLOSEFILE name */
export type CloseFileStatement = {
  readonly kind: 'CloseFileStatement';
  readonly fileName: Expression;
  readonly span: SourceSpan;
};

export type Expression =
  | IntegerLiteral
  | RealLiteral
  | StringLiteral
  | CharLiteral
  | BooleanLiteral
  | Identifier
  | UnaryExpression
  | BinaryExpression
  | GroupingExpression
  | CallExpression
  | IndexExpression
  | EofExpression;

export type CallExpression = {
  readonly kind: 'CallExpression';
  readonly callee: Identifier;
  readonly args: Expression[];
  readonly span: SourceSpan;
};

/** Name[i] or Name[i, j] */
export type IndexExpression = {
  readonly kind: 'IndexExpression';
  readonly array: Identifier;
  readonly indices: Expression[];
  readonly span: SourceSpan;
};

/** EOF(fileName) */
export type EofExpression = {
  readonly kind: 'EofExpression';
  readonly fileName: Expression;
  readonly span: SourceSpan;
};

export type IntegerLiteral = {
  readonly kind: 'IntegerLiteral';
  readonly value: number;
  readonly span: SourceSpan;
};

export type RealLiteral = {
  readonly kind: 'RealLiteral';
  readonly value: number;
  readonly span: SourceSpan;
};

export type StringLiteral = {
  readonly kind: 'StringLiteral';
  readonly value: string;
  readonly span: SourceSpan;
};

/** Single character, Cambridge `'A'` form. */
export type CharLiteral = {
  readonly kind: 'CharLiteral';
  readonly value: string;
  readonly span: SourceSpan;
};

export type BooleanLiteral = {
  readonly kind: 'BooleanLiteral';
  readonly value: boolean;
  readonly span: SourceSpan;
};

export type Identifier = {
  readonly kind: 'Identifier';
  readonly name: string;
  readonly span: SourceSpan;
};

export type UnaryOperator = '-' | '+' | 'NOT';

export type UnaryExpression = {
  readonly kind: 'UnaryExpression';
  readonly operator: UnaryOperator;
  readonly argument: Expression;
  readonly span: SourceSpan;
};

export type BinaryOperator =
  | '+'
  | '-'
  | '*'
  | '/'
  | 'DIV'
  | 'MOD'
  | '='
  | '<>'
  | '<'
  | '<='
  | '>'
  | '>='
  | 'AND'
  | 'OR';

export type BinaryExpression = {
  readonly kind: 'BinaryExpression';
  readonly operator: BinaryOperator;
  readonly left: Expression;
  readonly right: Expression;
  readonly span: SourceSpan;
};

export type GroupingExpression = {
  readonly kind: 'GroupingExpression';
  readonly expression: Expression;
  readonly span: SourceSpan;
};
