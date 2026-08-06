/**
 * Canonical Intermediate Representation (V1).
 *
 * Language-neutral program model for bidirectional translation.
 * See docs/language/TRANSLATION.md and ADR 0006.
 */

export type IrTrivia =
  | { readonly kind: 'Comment'; readonly text: string }
  | { readonly kind: 'BlankLine' };

export type IrProgram = {
  readonly kind: 'IrProgram';
  readonly body: IrStatement[];
  readonly leadingTrivia: IrTrivia[];
  readonly trailingTrivia: IrTrivia[];
};

export type IrStatement =
  | IrAssignment
  | IrInput
  | IrOutput
  | IrIfStatement
  | IrCaseStatement
  | IrWhileStatement
  | IrRepeatStatement
  | IrForStatement
  | IrDeclareStatement
  | IrConstantStatement
  | IrTypeDeclaration
  | IrEnumTypeDeclaration
  | IrPointerTypeDeclaration
  | IrSetTypeDeclaration
  | IrDefineStatement
  | IrProcedureDeclaration
  | IrFunctionDeclaration
  | IrCallStatement
  | IrReturnStatement
  | IrBreakStatement
  | IrOpenFileStatement
  | IrReadFileStatement
  | IrWriteFileStatement
  | IrCloseFileStatement
  | IrSeekStatement
  | IrGetRecordStatement
  | IrPutRecordStatement
  | IrClassDeclaration
  | IrExpressionStatement;

type WithTrivia = {
  readonly leadingTrivia: IrTrivia[];
  readonly trailingTrivia: IrTrivia[];
};

/**
 * Identifier, array element (Scores[1]), record field (S.Name), or pointer
 * dereference (`P^`) as an assignment destination.
 */
export type IrAssignTarget =
  | IrIdentifier
  | IrIndexExpression
  | IrMemberExpression
  | IrDerefExpression;

/** x ← value / x = value */
export type IrAssignment = WithTrivia & {
  readonly kind: 'IrAssignment';
  readonly target: IrAssignTarget;
  readonly value: IrExpression;
};

/** INPUT x / x = input() — valueType drives typed Python conversions. */
export type IrInput = WithTrivia & {
  readonly kind: 'IrInput';
  readonly target: IrAssignTarget;
  /** Optional prompt expression (from Python input(prompt)). */
  readonly prompt: IrExpression | null;
  /**
   * Declared scalar type of the target (INTEGER/REAL/BOOLEAN/CHAR/STRING).
   * `null` when unknown (e.g. reverse without annotations) → plain `input()`.
   */
  readonly valueType: IrTypeName | null;
};

/** OUTPUT a, b / print(a, b) */
export type IrOutput = WithTrivia & {
  readonly kind: 'IrOutput';
  readonly values: IrExpression[];
};

/** IF / ELSE IF / ELSE — maps to Python if / elif / else. */
export type IrIfStatement = WithTrivia & {
  readonly kind: 'IrIfStatement';
  readonly condition: IrExpression;
  readonly consequent: IrStatement[];
  readonly elseIfClauses: IrElseIfClause[];
  readonly alternate: IrStatement[] | null;
};

export type IrElseIfClause = {
  readonly kind: 'IrElseIfClause';
  readonly condition: IrExpression;
  readonly consequent: IrStatement[];
};

/** Value arm or inclusive `low TO high` range arm. */
export type IrCaseLabel =
  | { readonly kind: 'IrCaseValue'; readonly value: IrExpression }
  | {
      readonly kind: 'IrCaseRange';
      readonly low: IrExpression;
      readonly high: IrExpression;
    };

export type IrCaseArm = {
  readonly kind: 'IrCaseArm';
  readonly label: IrCaseLabel;
  readonly body: IrStatement[];
};

/** CASE OF … ENDCASE — maps to Python match/case. */
export type IrCaseStatement = WithTrivia & {
  readonly kind: 'IrCaseStatement';
  readonly discriminant: IrExpression;
  readonly arms: IrCaseArm[];
  readonly otherwise: IrStatement[] | null;
};

/** WHILE … ENDWHILE — maps to Python while. */
export type IrWhileStatement = WithTrivia & {
  readonly kind: 'IrWhileStatement';
  readonly condition: IrExpression;
  readonly body: IrStatement[];
};

/** REPEAT … UNTIL — prints to `while True` + trailing `if cond: break`. */
export type IrRepeatStatement = WithTrivia & {
  readonly kind: 'IrRepeatStatement';
  readonly body: IrStatement[];
  readonly condition: IrExpression;
};

/**
 * FOR <var> ← <start> TO <end> [STEP <step>] — maps to Python for…range.
 * `nextVariable` is the identifier after NEXT, or `null` for bare `NEXT`
 * (Cambridge allows both). Omitted when reverse-lifted from Python (printer
 * then repeats {@link variable}).
 */
export type IrForStatement = WithTrivia & {
  readonly kind: 'IrForStatement';
  readonly variable: string;
  readonly start: IrExpression;
  readonly end: IrExpression;
  readonly step: IrExpression | null;
  readonly body: IrStatement[];
  /** Identifier after NEXT, or null for bare NEXT. */
  readonly nextVariable?: string | null;
};

/** Cambridge scalar type names on procedure parameters / DECLARE / RETURNS. */
export type IrTypeName =
  | 'INTEGER'
  | 'REAL'
  | 'STRING'
  | 'BOOLEAN'
  | 'CHAR'
  | 'DATE';

export type IrArrayDimension = {
  readonly kind: 'IrArrayDimension';
  readonly lower: IrExpression;
  readonly upper: IrExpression;
};

export type IrScalarType = {
  readonly kind: 'IrScalarType';
  readonly name: IrTypeName;
};

/**
 * Reference to a user-defined TYPE … ENDTYPE record (display casing preserved;
 * comparison is case-insensitive upstream in the checker).
 */
export type IrNamedType = {
  readonly kind: 'IrNamedType';
  readonly name: string;
};

/** Scalar builtin or user-defined record type (ARRAY element / param / RETURNS). */
export type IrSimpleType = IrScalarType | IrNamedType;

/** ARRAY[l:u, …] OF elementType */
export type IrArrayType = {
  readonly kind: 'IrArrayType';
  readonly dimensions: IrArrayDimension[];
  readonly elementType: IrSimpleType;
};

export type IrTypeReference = IrScalarType | IrNamedType | IrArrayType;

/**
 * DECLARE Name[, Name]* : Type
 * Emitted as Python annotated names (`Name: int`) — one IR node may list many names.
 */
export type IrDeclareStatement = WithTrivia & {
  readonly kind: 'IrDeclareStatement';
  readonly names: string[];
  readonly typeRef: IrTypeReference;
};

/**
 * CONSTANT Name = <literal>
 * Emitted as `Name = literal  # CONSTANT`.
 */
export type IrConstantStatement = WithTrivia & {
  readonly kind: 'IrConstantStatement';
  readonly name: string;
  readonly value: IrExpression;
};

/** DECLARE Field[, Field]* : Type line inside a TYPE … ENDTYPE body. */
export type IrTypeField = {
  readonly kind: 'IrTypeField';
  readonly names: string[];
  readonly typeRef: IrTypeReference;
};

/**
 * TYPE Name … ENDTYPE — maps to a Python `@dataclass`.
 */
export type IrTypeDeclaration = WithTrivia & {
  readonly kind: 'IrTypeDeclaration';
  readonly name: string;
  readonly fields: IrTypeField[];
};

/** TYPE Name = (A, B, C) — Cambridge enumerated type → Python Enum/IntEnum. */
export type IrEnumTypeDeclaration = WithTrivia & {
  readonly kind: 'IrEnumTypeDeclaration';
  readonly name: string;
  readonly members: string[];
};

/** TYPE Name = ^T — Cambridge pointer type. */
export type IrPointerTypeDeclaration = WithTrivia & {
  readonly kind: 'IrPointerTypeDeclaration';
  readonly name: string;
  readonly targetType: IrSimpleType;
};

/** TYPE Name = SET OF T — Cambridge set type (instances via DEFINE). */
export type IrSetTypeDeclaration = WithTrivia & {
  readonly kind: 'IrSetTypeDeclaration';
  readonly name: string;
  readonly elementType: IrSimpleType;
};

/**
 * DEFINE Name (value1, value2, …) : SetType
 * Creates a set instance with the given element literals.
 */
export type IrDefineStatement = WithTrivia & {
  readonly kind: 'IrDefineStatement';
  readonly name: string;
  readonly values: IrExpression[];
  readonly typeName: string;
};

export type IrParameter = {
  readonly kind: 'IrParameter';
  readonly name: string;
  readonly typeName: IrSimpleType;
  /** Cambridge §8.3 — default BYVAL. */
  readonly mode: 'BYVAL' | 'BYREF';
};

/** PROCEDURE … ENDPROCEDURE — maps to Python def (no return annotation). */
export type IrProcedureDeclaration = WithTrivia & {
  readonly kind: 'IrProcedureDeclaration';
  readonly name: string;
  readonly parameters: IrParameter[];
  readonly body: IrStatement[];
};

/** FUNCTION … RETURNS … ENDFUNCTION — maps to Python def … -> type. */
export type IrFunctionDeclaration = WithTrivia & {
  readonly kind: 'IrFunctionDeclaration';
  readonly name: string;
  readonly parameters: IrParameter[];
  readonly returnType: IrSimpleType;
  readonly body: IrStatement[];
};

/** CALL Name[(args)] — maps to Python Name(args) statement. */
export type IrCallStatement = WithTrivia & {
  readonly kind: 'IrCallStatement';
  readonly callee: string;
  readonly args: IrExpression[];
};

/** RETURN expr — maps to Python return expr (functions only). */
export type IrReturnStatement = WithTrivia & {
  readonly kind: 'IrReturnStatement';
  readonly value: IrExpression;
};

/** Internal-only for Python pattern recognition; not a Cambridge surface feature. */
export type IrBreakStatement = WithTrivia & {
  readonly kind: 'IrBreakStatement';
};

/** OPENFILE path FOR READ|WRITE|APPEND|RANDOM */
export type IrOpenFileStatement = WithTrivia & {
  readonly kind: 'IrOpenFileStatement';
  readonly fileName: IrExpression;
  readonly mode: 'READ' | 'WRITE' | 'APPEND' | 'RANDOM';
};

/** READFILE path, target */
export type IrReadFileStatement = WithTrivia & {
  readonly kind: 'IrReadFileStatement';
  readonly fileName: IrExpression;
  readonly target: IrAssignTarget;
};

/** WRITEFILE path, value */
export type IrWriteFileStatement = WithTrivia & {
  readonly kind: 'IrWriteFileStatement';
  readonly fileName: IrExpression;
  readonly value: IrExpression;
};

/** CLOSEFILE path */
export type IrCloseFileStatement = WithTrivia & {
  readonly kind: 'IrCloseFileStatement';
  readonly fileName: IrExpression;
};

/** SEEK path, address — Cambridge §9.2 */
export type IrSeekStatement = WithTrivia & {
  readonly kind: 'IrSeekStatement';
  readonly fileName: IrExpression;
  readonly address: IrExpression;
};

/** GETRECORD path, target — Cambridge §9.2 */
export type IrGetRecordStatement = WithTrivia & {
  readonly kind: 'IrGetRecordStatement';
  readonly fileName: IrExpression;
  readonly target: IrAssignTarget;
};

/** PUTRECORD path, value — Cambridge §9.2 */
export type IrPutRecordStatement = WithTrivia & {
  readonly kind: 'IrPutRecordStatement';
  readonly fileName: IrExpression;
  readonly value: IrExpression;
};

export type IrVisibility = 'PUBLIC' | 'PRIVATE';

/** `PRIVATE Name : STRING` inside a CLASS body (no direct Python emission — see IrClassDeclaration). */
export type IrClassProperty = {
  readonly kind: 'IrClassProperty';
  readonly names: string[];
  readonly typeRef: IrTypeReference;
  readonly visibility: IrVisibility;
};

/**
 * Class method with no return value. `name` is `NEW` for the constructor,
 * which prints as Python `__init__`.
 */
export type IrClassProcedure = {
  readonly kind: 'IrClassProcedure';
  readonly name: string;
  readonly parameters: IrParameter[];
  readonly body: IrStatement[];
  readonly visibility: IrVisibility;
};

/** Class method returning a value. */
export type IrClassFunction = {
  readonly kind: 'IrClassFunction';
  readonly name: string;
  readonly parameters: IrParameter[];
  readonly returnType: IrSimpleType;
  readonly body: IrStatement[];
  readonly visibility: IrVisibility;
};

export type IrClassMember = IrClassProperty | IrClassProcedure | IrClassFunction;

/**
 * CLASS Name [INHERITS Parent] … ENDCLASS — maps to a Python `class`.
 * `inherits` is the parent class name (display casing) or `null`.
 */
export type IrClassDeclaration = WithTrivia & {
  readonly kind: 'IrClassDeclaration';
  readonly name: string;
  readonly inherits: string | null;
  readonly members: IrClassMember[];
};

/**
 * Standalone call used as a statement with no assignment/CALL target value,
 * e.g. `Player.SetAttempts(5)` (bare method call) or a `CALL Obj.Method(...)`
 * lowered from a MemberExpression callee.
 */
export type IrExpressionStatement = WithTrivia & {
  readonly kind: 'IrExpressionStatement';
  readonly expression: IrExpression;
};

export type IrExpression =
  | IrIntegerLiteral
  | IrRealLiteral
  | IrStringLiteral
  | IrCharLiteral
  | IrBooleanLiteral
  | IrDateLiteral
  | IrIdentifier
  | IrIndexExpression
  | IrMemberExpression
  | IrCallExpression
  | IrUnaryExpression
  | IrBinaryExpression
  | IrGroupingExpression
  | IrEofExpression
  | IrDeepCopyExpression
  | IrSuperExpression
  | IrNewExpression
  | IrMethodCallExpression
  | IrAddressOfExpression
  | IrDerefExpression;

/** `^Var` — address-of a variable / place (Cambridge pointer). */
export type IrAddressOfExpression = {
  readonly kind: 'IrAddressOfExpression';
  readonly target: IrAssignTarget;
};

/** `Ptr^` — dereference a pointer. */
export type IrDerefExpression = {
  readonly kind: 'IrDerefExpression';
  readonly pointer: IrExpression;
};

/** `SUPER` — only meaningful as the `object` of an {@link IrMethodCallExpression}. */
export type IrSuperExpression = {
  readonly kind: 'IrSuperExpression';
};

/** `NEW ClassName(args)` — instantiates a class; prints as `ClassName(args)` in Python. */
export type IrNewExpression = {
  readonly kind: 'IrNewExpression';
  readonly className: string;
  readonly args: IrExpression[];
};

/**
 * `Object.Method(args)` / `SUPER.NEW(args)` — method call (expression form).
 * `SUPER.NEW` prints as Python `super().__init__(args)`.
 */
export type IrMethodCallExpression = {
  readonly kind: 'IrMethodCallExpression';
  readonly object: IrExpression;
  readonly method: string;
  readonly args: IrExpression[];
};

/**
 * Explicit deep copy for Cambridge by-value record/array semantics in Python.
 * Printed as `copy.deepcopy(value)`.
 */
export type IrDeepCopyExpression = {
  readonly kind: 'IrDeepCopyExpression';
  readonly value: IrExpression;
};

/** EOF(path) — Cambridge end-of-file test. */
export type IrEofExpression = {
  readonly kind: 'IrEofExpression';
  readonly fileName: IrExpression;
};

export type IrIntegerLiteral = {
  readonly kind: 'IrIntegerLiteral';
  readonly value: number;
};

export type IrRealLiteral = {
  readonly kind: 'IrRealLiteral';
  readonly value: number;
};

export type IrStringLiteral = {
  readonly kind: 'IrStringLiteral';
  readonly value: string;
};

/** Single character (Cambridge `'A'` / Python `'A'`). */
export type IrCharLiteral = {
  readonly kind: 'IrCharLiteral';
  readonly value: string;
};

export type IrBooleanLiteral = {
  readonly kind: 'IrBooleanLiteral';
  readonly value: boolean;
};

/** Cambridge DATE literal components (dd/mm/yyyy). */
export type IrDateLiteral = {
  readonly kind: 'IrDateLiteral';
  readonly day: number;
  readonly month: number;
  readonly year: number;
};

export type IrIdentifier = {
  readonly kind: 'IrIdentifier';
  readonly name: string;
};

/**
 * Name[i, j] — Cambridge indices preserved on IR.
 * Python print subtracts {@link lowers} so dense 0-based lists stay correct
 * for arbitrary Cambridge bounds (1:5, 5:10, -3:3, …).
 * `array` may itself be a member/index expression (e.g. `Students[i].Marks[1]`).
 */
export type IrIndexExpression = {
  readonly kind: 'IrIndexExpression';
  readonly array: IrExpression;
  readonly indices: IrExpression[];
  /**
   * Parallel to {@link indices}: Cambridge lower bound of each dimension.
   * Omitted when bounds are unknown (incomplete reverse / untyped IR).
   */
  readonly lowers?: readonly IrExpression[];
};

/** Field access: `S.Name`, `S.Home.City`, `Students[i].Name`. */
export type IrMemberExpression = {
  readonly kind: 'IrMemberExpression';
  readonly object: IrExpression;
  readonly property: string;
};

/** F(args) — function call expression (not CALL statement). */
export type IrCallExpression = {
  readonly kind: 'IrCallExpression';
  readonly callee: string;
  readonly args: IrExpression[];
};

/** Canonical IR operators (Python-leaning surface; printers map to Cambridge). */
export type IrBinaryOp =
  | '+'
  | '-'
  | '*'
  | '/'
  | '//'
  | '%'
  | '&'
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'and'
  | 'or';

export type IrUnaryOp = '+' | '-' | 'not';

export type IrUnaryExpression = {
  readonly kind: 'IrUnaryExpression';
  readonly operator: IrUnaryOp;
  readonly argument: IrExpression;
};

export type IrBinaryExpression = {
  readonly kind: 'IrBinaryExpression';
  readonly operator: IrBinaryOp;
  readonly left: IrExpression;
  readonly right: IrExpression;
};

/** Explicit parentheses preserved from source where possible. */
export type IrGroupingExpression = {
  readonly kind: 'IrGroupingExpression';
  readonly expression: IrExpression;
};

export function emptyTrivia(): IrTrivia[] {
  return [];
}

export function withEmptyTrivia<T extends object>(
  node: T,
): T & WithTrivia {
  return {
    ...node,
    leadingTrivia: emptyTrivia(),
    trailingTrivia: emptyTrivia(),
  };
}
