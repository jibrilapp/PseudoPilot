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
  | CaseArm
  | CaseLabel
  | Parameter
  | TypeName
  | NamedType
  | ArrayType
  | ArrayDimension
  | ClassMember;

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
  | CaseStatement
  | WhileStatement
  | RepeatStatement
  | ForStatement
  | DeclareStatement
  | ConstantStatement
  | TypeDeclaration
  | EnumTypeDeclaration
  | PointerTypeDeclaration
  | SetTypeDeclaration
  | DefineStatement
  | ProcedureDeclaration
  | FunctionDeclaration
  | CallStatement
  | ReturnStatement
  | OpenFileStatement
  | ReadFileStatement
  | WriteFileStatement
  | CloseFileStatement
  | SeekStatement
  | GetRecordStatement
  | PutRecordStatement
  | ClassDeclaration
  | ExpressionStatement;

export type TypeNameKind =
  | 'INTEGER'
  | 'REAL'
  | 'STRING'
  | 'BOOLEAN'
  | 'CHAR'
  | 'DATE';

/** Builtin scalar type (INTEGER, REAL, …). */
export type TypeName = {
  readonly kind: 'TypeName';
  readonly name: TypeNameKind;
  readonly span: SourceSpan;
};

/**
 * User-defined type reference (record name from TYPE … ENDTYPE).
 * Display casing preserved; comparison is case-insensitive in the checker.
 */
export type NamedType = {
  readonly kind: 'NamedType';
  readonly name: string;
  readonly span: SourceSpan;
};

/** Scalar builtin or user type name (ARRAY element / param / RETURNS). */
export type SimpleType = TypeName | NamedType;

/** ARRAY[lower:upper, …] OF elementType */
export type ArrayType = {
  readonly kind: 'ArrayType';
  readonly dimensions: ArrayDimension[];
  readonly elementType: SimpleType;
  readonly span: SourceSpan;
};

export type ArrayDimension = {
  readonly kind: 'ArrayDimension';
  readonly lower: Expression;
  readonly upper: Expression;
  readonly span: SourceSpan;
};

/** Scalar, named record, or array type in DECLARE. */
export type TypeReference = TypeName | NamedType | ArrayType;

/** Cambridge §9.1 text modes + §9.2 RANDOM. */
export type FileMode = 'READ' | 'WRITE' | 'APPEND' | 'RANDOM';

/** Left-hand side of assignment / INPUT / READFILE targets. */
export type AssignTarget =
  | Identifier
  | IndexExpression
  | MemberExpression
  | DerefExpression;

/**
 * Cambridge §8.3 parameter passing mode.
 * Omitted keywords default to BYVAL; sticky mode across a parameter list is
 * resolved at parse time so every {@link Parameter} carries an explicit mode.
 */
export type ParameterMode = 'BYVAL' | 'BYREF';

export type Parameter = {
  readonly kind: 'Parameter';
  readonly name: Identifier;
  /** Builtin scalar or user record type (not ARRAY in Core params). */
  readonly typeName: SimpleType;
  /** Pass-by-value (default) or pass-by-reference. */
  readonly mode: ParameterMode;
  readonly span: SourceSpan;
};

/**
 * TYPE Name
 *   DECLARE Field : Type
 *   …
 * ENDTYPE
 */
export type TypeDeclaration = {
  readonly kind: 'TypeDeclaration';
  readonly name: Identifier;
  readonly fields: DeclareStatement[];
  readonly span: SourceSpan;
};

/** TYPE Name = (A, B, C) — Cambridge enumerated type. */
export type EnumTypeDeclaration = {
  readonly kind: 'EnumTypeDeclaration';
  readonly name: Identifier;
  readonly members: Identifier[];
  readonly span: SourceSpan;
};

/** TYPE Name = ^T — Cambridge pointer type. */
export type PointerTypeDeclaration = {
  readonly kind: 'PointerTypeDeclaration';
  readonly name: Identifier;
  readonly targetType: SimpleType;
  readonly span: SourceSpan;
};

/** TYPE Name = SET OF T — Cambridge set type (instances via DEFINE). */
export type SetTypeDeclaration = {
  readonly kind: 'SetTypeDeclaration';
  readonly name: Identifier;
  readonly elementType: SimpleType;
  readonly span: SourceSpan;
};

/**
 * DEFINE Name (value1, value2, …) : SetType
 * Creates a set instance with the given element literals.
 */
export type DefineStatement = {
  readonly kind: 'DefineStatement';
  readonly name: Identifier;
  readonly values: Expression[];
  readonly typeName: Identifier;
  readonly span: SourceSpan;
};

/** DECLARE A, B : INTEGER | DECLARE Scores : ARRAY[1:10] OF INTEGER */
export type DeclareStatement = {
  readonly kind: 'DeclareStatement';
  readonly names: Identifier[];
  readonly typeRef: TypeReference;
  readonly span: SourceSpan;
};

/**
 * CONSTANT Name = <literal>
 * Value must be a literal (optionally unary +/- on a number).
 */
export type ConstantStatement = {
  readonly kind: 'ConstantStatement';
  readonly name: Identifier;
  readonly value: Expression;
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
  readonly returnType: SimpleType;
  readonly body: Statement[];
  readonly span: SourceSpan;
};

export type CallStatement = {
  readonly kind: 'CallStatement';
  readonly callee: Identifier | MemberExpression;
  readonly args: Expression[];
  readonly span: SourceSpan;
};

/**
 * Standalone method/procedure call used as a statement, e.g.
 * `Player.SetAttempts(5)` or `DoSomething(1)` — no `CALL` keyword.
 */
export type ExpressionStatement = {
  readonly kind: 'ExpressionStatement';
  readonly expression: Expression;
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

/** Single value label, or inclusive `low TO high` range. */
export type CaseLabel =
  | { readonly kind: 'Value'; readonly value: Expression; readonly span: SourceSpan }
  | {
      readonly kind: 'Range';
      readonly low: Expression;
      readonly high: Expression;
      readonly span: SourceSpan;
    };

export type CaseArm = {
  readonly kind: 'CaseArm';
  readonly label: CaseLabel;
  readonly body: Statement[];
  readonly span: SourceSpan;
};

/** CASE OF <expression> … [OTHERWISE …] ENDCASE */
export type CaseStatement = {
  readonly kind: 'CaseStatement';
  readonly discriminant: Expression;
  readonly arms: CaseArm[];
  readonly otherwise: Statement[] | null;
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

/**
 * FOR <ident> ← <start> TO <end> [STEP <step>] … NEXT [<ident>]
 * Cambridge allows bare NEXT; repeating the binder is good practice.
 * When present, `nextVariable` is the identifier after NEXT (may mismatch).
 */
export type ForStatement = {
  readonly kind: 'ForStatement';
  readonly variable: string;
  readonly start: Expression;
  readonly end: Expression;
  readonly step: Expression | null;
  readonly body: Statement[];
  /** Identifier after NEXT, or null for bare NEXT. */
  readonly nextVariable: string | null;
  readonly span: SourceSpan;
};

/** OPENFILE name FOR READ | WRITE | APPEND | RANDOM */
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

/** SEEK name, address — Cambridge §9.2; moves the random-file record pointer. */
export type SeekStatement = {
  readonly kind: 'SeekStatement';
  readonly fileName: Expression;
  readonly address: Expression;
  readonly span: SourceSpan;
};

/** GETRECORD name, target — Cambridge §9.2; reads the record at the file pointer. */
export type GetRecordStatement = {
  readonly kind: 'GetRecordStatement';
  readonly fileName: Expression;
  readonly target: AssignTarget;
  readonly span: SourceSpan;
};

/** PUTRECORD name, value — Cambridge §9.2; writes a record at the file pointer. */
export type PutRecordStatement = {
  readonly kind: 'PutRecordStatement';
  readonly fileName: Expression;
  readonly value: Expression;
  readonly span: SourceSpan;
};

export type Visibility = 'PUBLIC' | 'PRIVATE';

/**
 * Class property: `PRIVATE Name : STRING` (DECLARE keyword optional).
 * `visibility` is `null` when omitted (Cambridge defaults members to public,
 * though the guide's examples always specify PUBLIC/PRIVATE explicitly).
 */
export type ClassPropertyDeclaration = {
  readonly kind: 'ClassPropertyDeclaration';
  readonly visibility: Visibility | null;
  readonly names: Identifier[];
  readonly typeRef: TypeReference;
  readonly span: SourceSpan;
};

/** Class method with no return value. `name` is `NEW` for the constructor. */
export type ClassProcedureDeclaration = {
  readonly kind: 'ClassProcedureDeclaration';
  readonly visibility: Visibility | null;
  readonly name: Identifier;
  readonly parameters: Parameter[];
  readonly body: Statement[];
  readonly span: SourceSpan;
};

/** Class method returning a value. */
export type ClassFunctionDeclaration = {
  readonly kind: 'ClassFunctionDeclaration';
  readonly visibility: Visibility | null;
  readonly name: Identifier;
  readonly parameters: Parameter[];
  readonly returnType: SimpleType;
  readonly body: Statement[];
  readonly span: SourceSpan;
};

export type ClassMember =
  | ClassPropertyDeclaration
  | ClassProcedureDeclaration
  | ClassFunctionDeclaration;

/**
 * CLASS Name [INHERITS Parent]
 *   { property | PROCEDURE … ENDPROCEDURE | FUNCTION … ENDFUNCTION }
 * ENDCLASS
 */
export type ClassDeclaration = {
  readonly kind: 'ClassDeclaration';
  readonly name: Identifier;
  readonly inherits: Identifier | null;
  readonly members: ClassMember[];
  readonly span: SourceSpan;
};

export type Expression =
  | IntegerLiteral
  | RealLiteral
  | StringLiteral
  | CharLiteral
  | BooleanLiteral
  | DateLiteral
  | Identifier
  | UnaryExpression
  | BinaryExpression
  | GroupingExpression
  | CallExpression
  | IndexExpression
  | MemberExpression
  | AddressOfExpression
  | DerefExpression
  | EofExpression
  | SuperExpression
  | NewExpression
  | MethodCallExpression;

/** `^Var` — address-of a variable / place (Cambridge pointer). */
export type AddressOfExpression = {
  readonly kind: 'AddressOfExpression';
  readonly target: AssignTarget;
  readonly span: SourceSpan;
};

/** `Ptr^` — dereference a pointer. */
export type DerefExpression = {
  readonly kind: 'DerefExpression';
  readonly pointer: Expression;
  readonly span: SourceSpan;
};

export type CallExpression = {
  readonly kind: 'CallExpression';
  readonly callee: Identifier;
  readonly args: Expression[];
  readonly span: SourceSpan;
};

/**
 * Array / string indexing. Base may be an identifier, member, or prior index
 * (e.g. `Scores[i]`, `S.Marks[1]`, `Rows[i][j]` is not Cambridge — multi-dim uses commas).
 */
export type IndexExpression = {
  readonly kind: 'IndexExpression';
  readonly array: Expression;
  readonly indices: Expression[];
  readonly span: SourceSpan;
};

/** Field access: `S.Name`, `S.Home.City`, `Students[i].Name`. */
export type MemberExpression = {
  readonly kind: 'MemberExpression';
  readonly object: Expression;
  readonly property: Identifier;
  readonly span: SourceSpan;
};

/** EOF(fileName) */
export type EofExpression = {
  readonly kind: 'EofExpression';
  readonly fileName: Expression;
  readonly span: SourceSpan;
};

/** `SUPER` — only meaningful as the object of a `SUPER.NEW(...)` method call. */
export type SuperExpression = {
  readonly kind: 'SuperExpression';
  readonly span: SourceSpan;
};

/** `NEW ClassName(args)` — instantiates a class. */
export type NewExpression = {
  readonly kind: 'NewExpression';
  readonly className: Identifier;
  readonly args: Expression[];
  readonly span: SourceSpan;
};

/** `Object.Method(args)` / `SUPER.NEW(args)` — method call without `CALL`. */
export type MethodCallExpression = {
  readonly kind: 'MethodCallExpression';
  readonly object: Expression;
  readonly method: Identifier;
  readonly args: Expression[];
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

/** Cambridge DATE literal `dd/mm/yyyy`. */
export type DateLiteral = {
  readonly kind: 'DateLiteral';
  readonly day: number;
  readonly month: number;
  readonly year: number;
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
  | '&'
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
