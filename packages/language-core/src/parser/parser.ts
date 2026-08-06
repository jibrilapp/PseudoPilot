import type { Diagnostic, Position } from '../diagnostics.js';
import { span } from '../diagnostics.js';
import type {
  AssignmentStatement,
  ArrayDimension,
  ArrayType,
  ClassDeclaration,
  ClassFunctionDeclaration,
  ClassMember,
  ClassProcedureDeclaration,
  ClassPropertyDeclaration,
  CloseFileStatement,
  ConstantStatement,
  DeclareStatement,
  ElseIfClause,
  Expression,
  ExpressionStatement,
  FileMode,
  FunctionDeclaration,
  GetRecordStatement,
  Identifier,
  IfStatement,
  InputStatement,
  MemberExpression,
  OpenFileStatement,
  OutputStatement,
  Parameter,
  ParameterMode,
  ProcedureDeclaration,
  Program,
  PutRecordStatement,
  CallStatement,
  CaseArm,
  CaseLabel,
  CaseStatement,
  ReadFileStatement,
  ForStatement,
  RepeatStatement,
  ReturnStatement,
  SeekStatement,
  Statement,
  TypeDeclaration,
  EnumTypeDeclaration,
  PointerTypeDeclaration,
  SetTypeDeclaration,
  DefineStatement,
  TypeName,
  TypeNameKind,
  NamedType,
  SimpleType,
  TypeReference,
  Visibility,
  WhileStatement,
  WriteFileStatement,
} from '../ast/nodes.js';
import { isFileModeToken, isTypeToken, TokenKind, type Token } from '../lexer/token.js';
import { pushError, TokenCursor } from './cursor.js';
import { ExpressionParser } from './expression.js';

type BodyContext = 'program' | 'procedure' | 'function' | 'class';

/**
 * Recursive-descent parser for program / statements.
 * Expressions are delegated to {@link ExpressionParser} (Pratt) via a shared cursor.
 */
export class Parser {
  private readonly cursor: TokenCursor;
  private readonly diagnostics: Diagnostic[];
  private bodyContext: BodyContext = 'program';

  constructor(tokens: Token[], diagnostics: Diagnostic[] = []) {
    this.cursor = new TokenCursor(tokens);
    this.diagnostics = diagnostics;
  }

  parseProgram(): Program {
    const start = this.cursor.peek().span.start;
    const body: Statement[] = [];
    this.bodyContext = 'program';

    this.skipNewlines();
    while (!this.cursor.isAtEnd()) {
      const before = this.cursor.index;
      const stmt = this.parseStatement();
      if (stmt) {
        body.push(stmt);
        this.expectStatementEnd();
      } else if (this.cursor.index === before) {
        this.cursor.advance();
      } else {
        this.synchronizeToNewline();
      }
      this.skipNewlines();
    }

    return {
      kind: 'Program',
      body,
      span: span(start, this.cursor.previous().span.end),
    };
  }

  private parseStatement(): Statement | null {
    const token = this.cursor.peek();

    if (token.kind === TokenKind.Input) return this.parseInput();
    if (token.kind === TokenKind.Output) return this.parseOutput();
    if (token.kind === TokenKind.If) return this.parseIf();
    if (token.kind === TokenKind.Case) return this.parseCase();
    if (token.kind === TokenKind.While) return this.parseWhile();
    if (token.kind === TokenKind.Repeat) return this.parseRepeat();
    if (token.kind === TokenKind.For) return this.parseFor();
    if (token.kind === TokenKind.Declare) return this.parseDeclare();
    if (token.kind === TokenKind.Type) return this.parseTypeDeclaration();
    if (token.kind === TokenKind.Define) return this.parseDefine();
    if (token.kind === TokenKind.Constant) return this.parseConstant();
    if (token.kind === TokenKind.Call) return this.parseCallStatement();
    if (token.kind === TokenKind.Return) return this.parseReturn();
    if (token.kind === TokenKind.Procedure) return this.parseProcedure();
    if (token.kind === TokenKind.Function) return this.parseFunction();
    if (token.kind === TokenKind.Openfile) return this.parseOpenFile();
    if (token.kind === TokenKind.Readfile) return this.parseReadFile();
    if (token.kind === TokenKind.Writefile) return this.parseWriteFile();
    if (token.kind === TokenKind.Closefile) return this.parseCloseFile();
    if (token.kind === TokenKind.Seek) return this.parseSeek();
    if (token.kind === TokenKind.Getrecord) return this.parseGetRecord();
    if (token.kind === TokenKind.Putrecord) return this.parsePutRecord();
    if (token.kind === TokenKind.Class) return this.parseClassDeclaration();
    if (token.kind === TokenKind.Identifier || token.kind === TokenKind.Super) {
      return this.parseAssignmentOrExpressionStatement();
    }

    if (token.kind === TokenKind.Public || token.kind === TokenKind.Private) {
      pushError(
        this.diagnostics,
        `'${token.lexeme}' is only allowed inside a CLASS body.`,
        token,
        'E_VISIBILITY_OUTSIDE_CLASS',
      );
      this.cursor.advance();
      return null;
    }

    if (isUnexpectedStructuralKeyword(token.kind)) {
      pushError(
        this.diagnostics,
        `Unexpected '${token.lexeme}'.`,
        token,
        'E_UNEXPECTED_KW',
      );
      this.cursor.advance();
      return null;
    }

    if (isReservedFutureKeyword(token.kind)) {
      pushError(
        this.diagnostics,
        `'${token.lexeme}' is not supported in this parser milestone yet.`,
        token,
        'E_UNSUPPORTED',
      );
      this.cursor.advance();
      return null;
    }

    pushError(
      this.diagnostics,
      'Expected a statement.',
      token,
    );
    this.cursor.advance();
    return null;
  }

  private parseProcedure(): ProcedureDeclaration | null {
    if (this.bodyContext !== 'program') {
      pushError(
        this.diagnostics,
        'Nested PROCEDURE declarations are not allowed.',
        this.cursor.peek(),
        'E_NESTED_ROUTINE',
      );
      this.cursor.advance();
      return null;
    }

    const startToken = this.cursor.advance(); // PROCEDURE
    const name = this.expressions().parseIdentifier();
    if (!name) return null;

    const parameters = this.parseParameterListOptional();
    this.skipNewlines();

    const previous = this.bodyContext;
    this.bodyContext = 'procedure';
    const body = this.parseBlock(() => this.cursor.check(TokenKind.Endprocedure));
    this.bodyContext = previous;

    if (!this.cursor.match(TokenKind.Endprocedure)) {
      pushError(
        this.diagnostics,
        "Expected 'ENDPROCEDURE'.",
        this.cursor.peek(),
      );
      return null;
    }

    return {
      kind: 'ProcedureDeclaration',
      name,
      parameters,
      body,
      span: span(startToken.span.start, this.cursor.previous().span.end),
    };
  }

  private parseFunction(): FunctionDeclaration | null {
    if (this.bodyContext !== 'program') {
      pushError(
        this.diagnostics,
        'Nested FUNCTION declarations are not allowed.',
        this.cursor.peek(),
        'E_NESTED_ROUTINE',
      );
      this.cursor.advance();
      return null;
    }

    const startToken = this.cursor.advance(); // FUNCTION
    const name = this.expressions().parseIdentifier();
    if (!name) return null;

    const parameters = this.parseParameterListOptional();

    if (!this.cursor.match(TokenKind.Returns)) {
      pushError(
        this.diagnostics,
        "Expected 'RETURNS' after FUNCTION parameter list.",
        this.cursor.peek(),
      );
      return null;
    }

    const returnType = this.parseTypeName();
    if (!returnType) return null;

    this.skipNewlines();

    const previous = this.bodyContext;
    this.bodyContext = 'function';
    const body = this.parseBlock(() => this.cursor.check(TokenKind.Endfunction));
    this.bodyContext = previous;

    if (!this.cursor.match(TokenKind.Endfunction)) {
      pushError(
        this.diagnostics,
        "Expected 'ENDFUNCTION'.",
        this.cursor.peek(),
      );
      return null;
    }

    return {
      kind: 'FunctionDeclaration',
      name,
      parameters,
      returnType,
      body,
      span: span(startToken.span.start, this.cursor.previous().span.end),
    };
  }

  /**
   * CLASS Name [INHERITS Parent]
   *   { property | PROCEDURE … ENDPROCEDURE | FUNCTION … ENDFUNCTION }
   * ENDCLASS
   *
   * Cambridge 9618 OOP: properties default PUBLIC visibility is written
   * explicitly in the guide's examples; `DECLARE` before a property is
   * optional. The constructor is a PROCEDURE named `NEW`.
   */
  private parseClassDeclaration(): ClassDeclaration | null {
    if (this.bodyContext !== 'program') {
      pushError(
        this.diagnostics,
        'Nested CLASS declarations are not allowed.',
        this.cursor.peek(),
        'E_NESTED_CLASS',
      );
      this.cursor.advance();
      return null;
    }

    const startToken = this.cursor.advance(); // CLASS
    const name = this.expressions().parseIdentifier();
    if (!name) return null;

    let inherits: Identifier | null = null;
    if (this.cursor.match(TokenKind.Inherits)) {
      inherits = this.expressions().parseIdentifier();
      if (!inherits) return null;
    }

    this.skipNewlines();

    const previousBodyContext = this.bodyContext;
    this.bodyContext = 'class';

    const members: ClassMember[] = [];
    while (!this.cursor.check(TokenKind.Endclass) && !this.cursor.isAtEnd()) {
      const before = this.cursor.index;
      const member = this.parseClassMember();
      if (member) {
        members.push(member);
      } else if (this.cursor.index === before) {
        this.cursor.advance();
      }
      this.skipNewlines();
    }

    this.bodyContext = previousBodyContext;

    if (!this.cursor.match(TokenKind.Endclass)) {
      pushError(this.diagnostics, "Expected 'ENDCLASS'.", this.cursor.peek(), 'E_CLASS_END');
      return null;
    }

    return {
      kind: 'ClassDeclaration',
      name,
      inherits,
      members,
      span: span(startToken.span.start, this.cursor.previous().span.end),
    };
  }

  private parseClassMember(): ClassMember | null {
    const memberStart = this.cursor.peek();
    let visibility: Visibility | null = null;
    if (this.cursor.match(TokenKind.Public)) visibility = 'PUBLIC';
    else if (this.cursor.match(TokenKind.Private)) visibility = 'PRIVATE';

    const token = this.cursor.peek();

    if (token.kind === TokenKind.Class) {
      pushError(
        this.diagnostics,
        'Nested CLASS declarations are not allowed.',
        token,
        'E_NESTED_CLASS',
      );
      this.cursor.advance();
      return null;
    }
    if (token.kind === TokenKind.Procedure) {
      return this.parseClassProcedure(visibility, memberStart);
    }
    if (token.kind === TokenKind.Function) {
      return this.parseClassFunction(visibility, memberStart);
    }
    if (token.kind === TokenKind.Declare || token.kind === TokenKind.Identifier) {
      return this.parseClassProperty(visibility, memberStart);
    }

    if (isUnexpectedStructuralKeyword(token.kind)) {
      pushError(this.diagnostics, `Unexpected '${token.lexeme}'.`, token, 'E_UNEXPECTED_KW');
      this.cursor.advance();
      return null;
    }

    pushError(
      this.diagnostics,
      'Expected a class member (property, PUBLIC/PRIVATE, PROCEDURE, or FUNCTION).',
      token,
      'E_CLASS_MEMBER',
    );
    this.cursor.advance();
    return null;
  }

  /** `[DECLARE] Name [, Name]* : Type` — DECLARE is optional in class bodies. */
  private parseClassProperty(
    visibility: Visibility | null,
    startToken: Token,
  ): ClassPropertyDeclaration | null {
    this.cursor.match(TokenKind.Declare); // optional

    const names: Identifier[] = [];
    const first = this.expressions().parseIdentifier();
    if (!first) return null;
    names.push(first);

    while (this.cursor.match(TokenKind.Comma)) {
      const next = this.expressions().parseIdentifier();
      if (!next) return null;
      names.push(next);
    }

    if (!this.cursor.match(TokenKind.Colon)) {
      pushError(
        this.diagnostics,
        "Expected ':' in class property declaration.",
        this.cursor.peek(),
      );
      return null;
    }

    const typeRef = this.parseTypeReference();
    if (!typeRef) return null;

    return {
      kind: 'ClassPropertyDeclaration',
      visibility,
      names,
      typeRef,
      span: span(startToken.span.start, typeRef.span.end),
    };
  }

  private parseClassProcedure(
    visibility: Visibility | null,
    startToken: Token,
  ): ClassProcedureDeclaration | null {
    this.cursor.advance(); // PROCEDURE
    const name = this.parseClassMethodName();
    if (!name) return null;

    const parameters = this.parseParameterListOptional();
    this.skipNewlines();

    const previous = this.bodyContext;
    this.bodyContext = 'procedure';
    const body = this.parseBlock(() => this.cursor.check(TokenKind.Endprocedure));
    this.bodyContext = previous;

    if (!this.cursor.match(TokenKind.Endprocedure)) {
      pushError(this.diagnostics, "Expected 'ENDPROCEDURE'.", this.cursor.peek());
      return null;
    }

    return {
      kind: 'ClassProcedureDeclaration',
      visibility,
      name,
      parameters,
      body,
      span: span(startToken.span.start, this.cursor.previous().span.end),
    };
  }

  private parseClassFunction(
    visibility: Visibility | null,
    startToken: Token,
  ): ClassFunctionDeclaration | null {
    this.cursor.advance(); // FUNCTION
    const name = this.parseClassMethodName();
    if (!name) return null;

    const parameters = this.parseParameterListOptional();

    if (!this.cursor.match(TokenKind.Returns)) {
      pushError(
        this.diagnostics,
        "Expected 'RETURNS' after FUNCTION parameter list.",
        this.cursor.peek(),
      );
      return null;
    }

    const returnType = this.parseTypeName();
    if (!returnType) return null;

    this.skipNewlines();

    const previous = this.bodyContext;
    this.bodyContext = 'function';
    const body = this.parseBlock(() => this.cursor.check(TokenKind.Endfunction));
    this.bodyContext = previous;

    if (!this.cursor.match(TokenKind.Endfunction)) {
      pushError(this.diagnostics, "Expected 'ENDFUNCTION'.", this.cursor.peek());
      return null;
    }

    return {
      kind: 'ClassFunctionDeclaration',
      visibility,
      name,
      parameters,
      returnType,
      body,
      span: span(startToken.span.start, this.cursor.previous().span.end),
    };
  }

  /** Method name after PROCEDURE/FUNCTION — accepts `NEW` for the constructor. */
  private parseClassMethodName(): Identifier | null {
    const token = this.cursor.peek();
    // NEW is a keyword used as the constructor name; SET may appear as a
    // method name in classroom OOP examples (Cambridge keyword otherwise).
    if (token.kind === TokenKind.New) {
      this.cursor.advance();
      return { kind: 'Identifier', name: 'NEW', span: token.span };
    }
    if (token.kind === TokenKind.Set) {
      this.cursor.advance();
      return { kind: 'Identifier', name: token.lexeme, span: token.span };
    }
    return this.expressions().parseIdentifier();
  }

  /**
   * Optional `(…)` list. Bare `PROCEDURE Foo` and `PROCEDURE Foo()` both allowed.
   *
   * Cambridge allows grouped parameters sharing one type:
   *   `(a, b : INTEGER, c : REAL)` → three individual {@link Parameter} nodes.
   * Guide §8.3: optional `BYVAL`/`BYREF` before a group; when omitted, the
   * previous group's mode sticks (default BYVAL for the first group).
   * Newlines inside the parentheses are skipped (multiline parameter lists).
   */
  private parseParameterListOptional(): Parameter[] {
    if (!this.cursor.match(TokenKind.LParen)) return [];
    this.skipNewlines();
    if (this.cursor.match(TokenKind.RParen)) return [];

    const parameters: Parameter[] = [];
    // Sticky mode across groups (Cambridge SWAP example: BYREF X : INTEGER, Y : INTEGER).
    let currentMode: ParameterMode = 'BYVAL';
    const first = this.parseParameterGroup(currentMode);
    if (!first) {
      this.cursor.match(TokenKind.RParen);
      return parameters;
    }
    currentMode = first.mode;
    parameters.push(...first.params);

    while (this.cursor.match(TokenKind.Comma)) {
      this.skipNewlines();
      const next = this.parseParameterGroup(currentMode);
      if (!next) break;
      currentMode = next.mode;
      parameters.push(...next.params);
    }

    this.skipNewlines();
    if (!this.cursor.match(TokenKind.RParen)) {
      pushError(this.diagnostics, 'Expected ")" after parameter list.', this.cursor.peek());
    }
    return parameters;
  }

  /**
   * One Cambridge parameter group: `[BYVAL|BYREF] Ident { "," Ident } ":" TypeName`.
   * Expanded into one {@link Parameter} per identifier (shared type / mode / span end).
   * When the mode keyword is omitted, `stickyMode` from the previous group applies.
   */
  private parseParameterGroup(
    stickyMode: ParameterMode,
  ): { params: Parameter[]; mode: ParameterMode } | null {
    this.skipNewlines();
    let mode = stickyMode;
    let modeExplicit = false;
    if (this.cursor.check(TokenKind.Byval) || this.cursor.check(TokenKind.Byref)) {
      mode = this.cursor.check(TokenKind.Byval) ? 'BYVAL' : 'BYREF';
      this.cursor.advance();
      modeExplicit = true;
      this.skipNewlines();
    }

    const names = [];
    const first = this.expressions().parseIdentifier();
    if (!first) {
      if (modeExplicit) {
        pushError(
          this.diagnostics,
          `Expected parameter name after ${mode}.`,
          this.cursor.peek(),
        );
      }
      return null;
    }
    names.push(first);

    while (this.cursor.match(TokenKind.Comma)) {
      this.skipNewlines();
      // Next group may start with BYVAL/BYREF — leave the comma for the list loop.
      if (this.cursor.check(TokenKind.Byval) || this.cursor.check(TokenKind.Byref)) {
        // Put the comma back conceptually: we already consumed it. The outer
        // list loop expects to consume commas between groups, so we cannot
        // peek a mode here after eating a comma meant for another name.
        // Cambridge groups names before `:` — a mode keyword after `,` starts
        // a new group. Re-parse by returning what we have only if we already
        // saw `:`, which we haven't — so treat mode-after-comma as end of
        // this name list without a type (error) unless we support
        // `A, BYREF B : T`. Guide form is `BYREF X : INTEGER, Y : INTEGER`
        // (mode at group start) or `BYREF X, Y : INTEGER`. Mode mid-list
        // after comma without completing the type is a new group: roll back
        // by requiring type first. Practically: after comma, if BYVAL/BYREF,
        // that is invalid inside a name list — error.
        pushError(
          this.diagnostics,
          `Unexpected ${this.cursor.peek().lexeme.toUpperCase()} inside a parameter name list; place BYVAL/BYREF before the first name of a group.`,
          this.cursor.peek(),
        );
        return null;
      }
      // `a, : INTEGER` — comma must introduce another identifier, not the colon.
      if (this.cursor.check(TokenKind.Colon)) {
        pushError(
          this.diagnostics,
          "Expected identifier after ',' in parameter list.",
          this.cursor.peek(),
        );
        return null;
      }
      // `a,, b : INTEGER` or trailing `a,)` before a type — empty name slot.
      if (
        this.cursor.check(TokenKind.Comma) ||
        this.cursor.check(TokenKind.RParen)
      ) {
        pushError(
          this.diagnostics,
          "Expected identifier after ',' in parameter list.",
          this.cursor.peek(),
        );
        return null;
      }
      const next = this.expressions().parseIdentifier();
      if (!next) return null;
      names.push(next);
    }

    this.skipNewlines();
    if (!this.cursor.match(TokenKind.Colon)) {
      pushError(
        this.diagnostics,
        "Expected ':' after parameter name.",
        this.cursor.peek(),
      );
      return null;
    }

    const typeName = this.parseTypeName();
    if (!typeName) return null;

    return {
      mode,
      params: names.map((name) => ({
        kind: 'Parameter' as const,
        name,
        typeName,
        mode,
        span: span(name.span.start, typeName.span.end),
      })),
    };
  }

  private parseDeclare(): DeclareStatement | null {
    const startToken = this.cursor.advance(); // DECLARE
    const names = [];
    const first = this.expressions().parseIdentifier();
    if (!first) return null;
    names.push(first);

    while (this.cursor.match(TokenKind.Comma)) {
      const next = this.expressions().parseIdentifier();
      if (!next) return null;
      names.push(next);
    }

    if (!this.cursor.match(TokenKind.Colon)) {
      pushError(this.diagnostics, "Expected ':' in DECLARE statement.", this.cursor.peek());
      return null;
    }

    const typeRef = this.parseTypeReference();
    if (!typeRef) return null;

    return {
      kind: 'DeclareStatement',
      names,
      typeRef,
      span: span(startToken.span.start, typeRef.span.end),
    };
  }

  /**
   * TYPE Name … ENDTYPE (record)
   * TYPE Name = (A, B, …) (enum)
   * TYPE Name = ^T (pointer)
   * TYPE Name = SET OF T (set)
   */
  private parseTypeDeclaration():
    | TypeDeclaration
    | EnumTypeDeclaration
    | PointerTypeDeclaration
    | SetTypeDeclaration
    | null {
    if (this.bodyContext !== 'program') {
      pushError(
        this.diagnostics,
        'TYPE declarations are only allowed at program level.',
        this.cursor.peek(),
        'E_NESTED_TYPE',
      );
      this.cursor.advance();
      return null;
    }

    const startToken = this.cursor.advance(); // TYPE
    const name = this.expressions().parseIdentifier();
    if (!name) {
      // Recover: skip until ENDTYPE so field DECLAREs are not hoisted.
      while (
        !this.cursor.check(TokenKind.Endtype) &&
        !this.cursor.check(TokenKind.Eof)
      ) {
        this.cursor.advance();
      }
      this.cursor.match(TokenKind.Endtype);
      return null;
    }

    if (this.cursor.match(TokenKind.Equal)) {
      return this.parseEqualsTypeForm(startToken, name);
    }

    this.skipNewlines();
    const fields: DeclareStatement[] = [];
    while (
      !this.cursor.check(TokenKind.Endtype) &&
      !this.cursor.check(TokenKind.Eof)
    ) {
      if (!this.cursor.check(TokenKind.Declare)) {
        pushError(
          this.diagnostics,
          "Expected 'DECLARE' field or 'ENDTYPE' in TYPE body.",
          this.cursor.peek(),
          'E_TYPE_BODY',
        );
        this.cursor.advance();
        this.skipNewlines();
        continue;
      }
      const field = this.parseDeclare();
      if (field) fields.push(field);
      this.skipNewlines();
    }

    if (!this.cursor.match(TokenKind.Endtype)) {
      pushError(
        this.diagnostics,
        "Expected 'ENDTYPE'.",
        this.cursor.peek(),
        'E_TYPE_END',
      );
      return null;
    }

    return {
      kind: 'TypeDeclaration',
      name,
      fields,
      span: span(startToken.span.start, this.cursor.previous().span.end),
    };
  }

  /** TYPE Name = (enum) | ^T | SET OF T */
  private parseEqualsTypeForm(
    startToken: Token,
    name: Identifier,
  ): EnumTypeDeclaration | PointerTypeDeclaration | SetTypeDeclaration | null {
    // Enum: TYPE Name = (A, B, C)
    if (this.cursor.match(TokenKind.LParen)) {
      const members: Identifier[] = [];
      if (this.cursor.check(TokenKind.RParen)) {
        pushError(
          this.diagnostics,
          'Enumerated TYPE must list at least one member.',
          this.cursor.peek(),
          'E_ENUM_EMPTY',
        );
        this.cursor.advance();
        return null;
      }
      const first = this.expressions().parseIdentifier();
      if (!first) return null;
      members.push(first);
      while (this.cursor.match(TokenKind.Comma)) {
        const next = this.expressions().parseIdentifier();
        if (!next) break;
        members.push(next);
      }
      if (!this.cursor.match(TokenKind.RParen)) {
        pushError(
          this.diagnostics,
          "Expected ')' after enumerated TYPE members.",
          this.cursor.peek(),
          'E_ENUM_RPAREN',
        );
      }
      return {
        kind: 'EnumTypeDeclaration',
        name,
        members,
        span: span(startToken.span.start, this.cursor.previous().span.end),
      };
    }

    // Pointer: TYPE Name = ^T
    if (this.cursor.match(TokenKind.Caret)) {
      const targetType = this.parseSimpleTypeRef();
      if (!targetType) {
        pushError(
          this.diagnostics,
          'Expected type name after ^ in pointer TYPE.',
          this.cursor.peek(),
          'E_POINTER_TARGET',
        );
        return null;
      }
      return {
        kind: 'PointerTypeDeclaration',
        name,
        targetType,
        span: span(startToken.span.start, targetType.span.end),
      };
    }

    // Set: TYPE Name = SET OF T
    if (this.cursor.match(TokenKind.Set)) {
      if (!this.cursor.match(TokenKind.Of)) {
        pushError(
          this.diagnostics,
          "Expected 'OF' after 'SET' in set TYPE.",
          this.cursor.peek(),
          'E_SET_OF',
        );
        return null;
      }
      const elementType = this.parseSimpleTypeRef();
      if (!elementType) {
        pushError(
          this.diagnostics,
          'Expected element type after SET OF.',
          this.cursor.peek(),
          'E_SET_ELEMENT',
        );
        return null;
      }
      return {
        kind: 'SetTypeDeclaration',
        name,
        elementType,
        span: span(startToken.span.start, elementType.span.end),
      };
    }

    pushError(
      this.diagnostics,
      "Expected '(…)', '^Type', or 'SET OF Type' after 'TYPE Name ='.",
      this.cursor.peek(),
      'E_UNSUPPORTED_TYPE_FORM',
    );
    // Recover: skip to newline / EOF (non-record forms are single-line).
    while (
      !this.cursor.check(TokenKind.Newline) &&
      !this.cursor.check(TokenKind.Eof) &&
      !this.cursor.check(TokenKind.Endtype)
    ) {
      this.cursor.advance();
    }
    this.cursor.match(TokenKind.Endtype);
    return null;
  }

  /**
   * DEFINE Name (value1, value2, …) : SetType
   * Cambridge §4.1 set instance.
   */
  private parseDefine(): DefineStatement | null {
    if (this.bodyContext !== 'program') {
      pushError(
        this.diagnostics,
        'DEFINE is only allowed at program level.',
        this.cursor.peek(),
        'E_NESTED_DEFINE',
      );
      this.cursor.advance();
      return null;
    }

    const startToken = this.cursor.advance(); // DEFINE
    const name = this.expressions().parseIdentifier();
    if (!name) return null;

    if (!this.cursor.match(TokenKind.LParen)) {
      pushError(
        this.diagnostics,
        "Expected '(' after DEFINE name.",
        this.cursor.peek(),
        'E_DEFINE_LPAREN',
      );
      return null;
    }

    const values: Expression[] = [];
    if (!this.cursor.check(TokenKind.RParen)) {
      const first = this.expressions().parseExpression();
      if (first) values.push(first);
      while (this.cursor.match(TokenKind.Comma)) {
        const next = this.expressions().parseExpression();
        if (!next) break;
        values.push(next);
      }
    }
    if (!this.cursor.match(TokenKind.RParen)) {
      pushError(
        this.diagnostics,
        "Expected ')' after DEFINE values.",
        this.cursor.peek(),
        'E_DEFINE_RPAREN',
      );
    }

    if (!this.cursor.match(TokenKind.Colon)) {
      pushError(
        this.diagnostics,
        "Expected ':' before set type name in DEFINE.",
        this.cursor.peek(),
        'E_DEFINE_COLON',
      );
      return null;
    }

    const typeName = this.expressions().parseIdentifier();
    if (!typeName) return null;

    return {
      kind: 'DefineStatement',
      name,
      values,
      typeName,
      span: span(startToken.span.start, typeName.span.end),
    };
  }

  /** Builtin scalar or user type name (not ARRAY) for pointer/set targets. */
  private parseSimpleTypeRef(): SimpleType | null {
    const token = this.cursor.peek();
    if (isTypeToken(token.kind)) {
      this.cursor.advance();
      const name = token.lexeme.toUpperCase() as TypeNameKind;
      return { kind: 'TypeName', name, span: token.span };
    }
    if (token.kind === TokenKind.Identifier) {
      this.cursor.advance();
      return { kind: 'NamedType', name: token.lexeme, span: token.span };
    }
    return null;
  }

  /**
   * CONSTANT Name = <literal>
   * Accepts optional unary +/- before numeric literals.
   */
  private parseConstant(): ConstantStatement | null {
    const startToken = this.cursor.advance(); // CONSTANT
    const name = this.expressions().parseIdentifier();
    if (!name) return null;

    if (!this.cursor.match(TokenKind.Equal)) {
      pushError(
        this.diagnostics,
        "Expected '=' after CONSTANT name.",
        this.cursor.peek(),
        'E_CONSTANT_EQUALS',
      );
      return null;
    }

    const value = this.parseConstantLiteral();
    if (!value) return null;

    return {
      kind: 'ConstantStatement',
      name,
      value,
      span: span(startToken.span.start, value.span.end),
    };
  }

  /** Literal (or +/- number) for CONSTANT — rejects general expressions. */
  private parseConstantLiteral(): Expression | null {
    const token = this.cursor.peek();

    if (token.kind === TokenKind.Plus || token.kind === TokenKind.Minus) {
      const opTok = this.cursor.advance();
      const numTok = this.cursor.peek();
      if (numTok.kind !== TokenKind.Integer && numTok.kind !== TokenKind.Real) {
        pushError(
          this.diagnostics,
          'CONSTANT value must be a literal (integer, real, string, char, or boolean).',
          numTok,
          'E_CONSTANT_LITERAL',
        );
        return null;
      }
      this.cursor.advance();
      const argument =
        numTok.kind === TokenKind.Integer
          ? {
              kind: 'IntegerLiteral' as const,
              value: numTok.literal as number,
              span: numTok.span,
            }
          : {
              kind: 'RealLiteral' as const,
              value: numTok.literal as number,
              span: numTok.span,
            };
      return {
        kind: 'UnaryExpression',
        operator: opTok.kind === TokenKind.Minus ? '-' : '+',
        argument,
        span: span(opTok.span.start, numTok.span.end),
      };
    }

    if (token.kind === TokenKind.Integer) {
      this.cursor.advance();
      return {
        kind: 'IntegerLiteral',
        value: token.literal as number,
        span: token.span,
      };
    }
    if (token.kind === TokenKind.Real) {
      this.cursor.advance();
      return {
        kind: 'RealLiteral',
        value: token.literal as number,
        span: token.span,
      };
    }
    if (token.kind === TokenKind.String) {
      this.cursor.advance();
      return {
        kind: 'StringLiteral',
        value: token.literal as string,
        span: token.span,
      };
    }
    if (token.kind === TokenKind.Char) {
      this.cursor.advance();
      return {
        kind: 'CharLiteral',
        value: token.literal as string,
        span: token.span,
      };
    }
    if (token.kind === TokenKind.Boolean) {
      this.cursor.advance();
      return {
        kind: 'BooleanLiteral',
        value: token.literal as boolean,
        span: token.span,
      };
    }

    pushError(
      this.diagnostics,
      'CONSTANT value must be a literal (integer, real, string, char, or boolean).',
      token,
      'E_CONSTANT_LITERAL',
    );
    return null;
  }

  private parseTypeReference(): TypeReference | null {
    if (this.cursor.check(TokenKind.Array)) return this.parseArrayType();
    return this.parseTypeName();
  }

  private parseArrayType(): ArrayType | null {
    const startToken = this.cursor.advance(); // ARRAY
    if (!this.cursor.match(TokenKind.LBracket)) {
      pushError(this.diagnostics, "Expected '[' after ARRAY.", this.cursor.peek());
      return null;
    }

    const dimensions: ArrayDimension[] = [];
    const first = this.parseArrayDimension();
    if (!first) return null;
    dimensions.push(first);

    while (this.cursor.match(TokenKind.Comma)) {
      const next = this.parseArrayDimension();
      if (!next) return null;
      dimensions.push(next);
    }

    if (!this.cursor.match(TokenKind.RBracket)) {
      pushError(this.diagnostics, "Expected ']' after ARRAY bounds.", this.cursor.peek());
      return null;
    }
    if (!this.cursor.match(TokenKind.Of)) {
      pushError(this.diagnostics, "Expected 'OF' after ARRAY bounds.", this.cursor.peek());
      return null;
    }

    const elementType = this.parseTypeName();
    if (!elementType) return null;

    return {
      kind: 'ArrayType',
      dimensions,
      elementType,
      span: span(startToken.span.start, elementType.span.end),
    };
  }

  private parseArrayDimension(): ArrayDimension | null {
    const lower = this.expressions().parseExpression();
    if (!lower) return null;
    if (!this.cursor.match(TokenKind.Colon)) {
      pushError(
        this.diagnostics,
        "Expected ':' between ARRAY lower and upper bounds.",
        this.cursor.peek(),
      );
      return null;
    }
    const upper = this.expressions().parseExpression();
    if (!upper) return null;
    return {
      kind: 'ArrayDimension',
      lower,
      upper,
      span: span(lower.span.start, upper.span.end),
    };
  }

  private parseTypeName(): SimpleType | null {
    const token = this.cursor.peek();
    if (isTypeToken(token.kind)) {
      this.cursor.advance();
      return {
        kind: 'TypeName',
        name: token.lexeme.toUpperCase() as TypeNameKind,
        span: token.span,
      };
    }
    if (token.kind === TokenKind.Identifier) {
      this.cursor.advance();
      return {
        kind: 'NamedType',
        name: token.lexeme,
        span: token.span,
      };
    }
    pushError(
      this.diagnostics,
      'Expected a type name (INTEGER, REAL, STRING, BOOLEAN, CHAR, DATE, or a TYPE name).',
      token,
    );
    return null;
  }

  private parseOpenFile(): OpenFileStatement | null {
    const startToken = this.cursor.advance(); // OPENFILE
    const fileName = this.expressions().parseExpression();
    if (!fileName) return null;

    if (!this.cursor.match(TokenKind.For)) {
      pushError(
        this.diagnostics,
        "Expected 'FOR' after OPENFILE filename.",
        this.cursor.peek(),
      );
      return null;
    }

    const modeTok = this.cursor.peek();
    if (!isFileModeToken(modeTok.kind)) {
      pushError(
        this.diagnostics,
        "Expected READ, WRITE, APPEND, or RANDOM after OPENFILE … FOR.",
        modeTok,
      );
      return null;
    }
    this.cursor.advance();
    const mode = modeTok.lexeme.toUpperCase() as FileMode;

    return {
      kind: 'OpenFileStatement',
      fileName,
      mode,
      span: span(startToken.span.start, modeTok.span.end),
    };
  }

  private parseReadFile(): ReadFileStatement | null {
    const startToken = this.cursor.advance(); // READFILE
    const fileName = this.expressions().parseExpression();
    if (!fileName) return null;
    if (!this.cursor.match(TokenKind.Comma)) {
      pushError(
        this.diagnostics,
        "Expected ',' after READFILE filename.",
        this.cursor.peek(),
      );
      return null;
    }
    const target = this.expressions().parseAssignTarget();
    if (!target) return null;
    return {
      kind: 'ReadFileStatement',
      fileName,
      target,
      span: span(startToken.span.start, target.span.end),
    };
  }

  private parseWriteFile(): WriteFileStatement | null {
    const startToken = this.cursor.advance(); // WRITEFILE
    const fileName = this.expressions().parseExpression();
    if (!fileName) return null;
    if (!this.cursor.match(TokenKind.Comma)) {
      pushError(
        this.diagnostics,
        "Expected ',' after WRITEFILE filename.",
        this.cursor.peek(),
      );
      return null;
    }
    const value = this.expressions().parseExpression();
    if (!value) return null;
    return {
      kind: 'WriteFileStatement',
      fileName,
      value,
      span: span(startToken.span.start, value.span.end),
    };
  }

  private parseCloseFile(): CloseFileStatement | null {
    const startToken = this.cursor.advance(); // CLOSEFILE
    const fileName = this.expressions().parseExpression();
    if (!fileName) return null;
    return {
      kind: 'CloseFileStatement',
      fileName,
      span: span(startToken.span.start, fileName.span.end),
    };
  }

  /** SEEK <file>, <address> — Cambridge §9.2 */
  private parseSeek(): SeekStatement | null {
    const startToken = this.cursor.advance(); // SEEK
    const fileName = this.expressions().parseExpression();
    if (!fileName) return null;
    if (!this.cursor.match(TokenKind.Comma)) {
      pushError(
        this.diagnostics,
        "Expected ',' after SEEK filename.",
        this.cursor.peek(),
      );
      return null;
    }
    const address = this.expressions().parseExpression();
    if (!address) return null;
    return {
      kind: 'SeekStatement',
      fileName,
      address,
      span: span(startToken.span.start, address.span.end),
    };
  }

  /** GETRECORD <file>, <assignTarget> — Cambridge §9.2 */
  private parseGetRecord(): GetRecordStatement | null {
    const startToken = this.cursor.advance(); // GETRECORD
    const fileName = this.expressions().parseExpression();
    if (!fileName) return null;
    if (!this.cursor.match(TokenKind.Comma)) {
      pushError(
        this.diagnostics,
        "Expected ',' after GETRECORD filename.",
        this.cursor.peek(),
      );
      return null;
    }
    const target = this.expressions().parseAssignTarget();
    if (!target) return null;
    return {
      kind: 'GetRecordStatement',
      fileName,
      target,
      span: span(startToken.span.start, target.span.end),
    };
  }

  /** PUTRECORD <file>, <expression> — Cambridge §9.2 */
  private parsePutRecord(): PutRecordStatement | null {
    const startToken = this.cursor.advance(); // PUTRECORD
    const fileName = this.expressions().parseExpression();
    if (!fileName) return null;
    if (!this.cursor.match(TokenKind.Comma)) {
      pushError(
        this.diagnostics,
        "Expected ',' after PUTRECORD filename.",
        this.cursor.peek(),
      );
      return null;
    }
    const value = this.expressions().parseExpression();
    if (!value) return null;
    return {
      kind: 'PutRecordStatement',
      fileName,
      value,
      span: span(startToken.span.start, value.span.end),
    };
  }

  private parseCallStatement(): CallStatement | null {
    const startToken = this.cursor.advance(); // CALL
    const id = this.expressions().parseIdentifier();
    if (!id) return null;

    let callee: Identifier | MemberExpression = id;
    if (this.cursor.match(TokenKind.Dot)) {
      const property = this.expressions().parseIdentifier();
      if (!property) return null;
      callee = {
        kind: 'MemberExpression',
        object: id,
        property,
        span: span(id.span.start, property.span.end),
      };
    }

    let args: Expression[] = [];
    if (this.cursor.match(TokenKind.LParen)) {
      args = this.expressions().parseArgumentList();
    }

    return {
      kind: 'CallStatement',
      callee,
      args,
      span: span(startToken.span.start, this.cursor.previous().span.end),
    };
  }

  private parseReturn(): ReturnStatement | null {
    const startToken = this.cursor.advance(); // RETURN

    if (this.bodyContext === 'procedure') {
      pushError(
        this.diagnostics,
        'RETURN is not allowed inside a PROCEDURE (use a FUNCTION).',
        startToken,
        'E_RETURN_IN_PROCEDURE',
      );
    } else if (this.bodyContext === 'program') {
      pushError(
        this.diagnostics,
        'RETURN is only valid inside a FUNCTION.',
        startToken,
        'E_RETURN_OUTSIDE',
      );
    }

    const value = this.expressions().parseExpression();
    if (!value) return null;

    return {
      kind: 'ReturnStatement',
      value,
      span: span(startToken.span.start, value.span.end),
    };
  }

  private parseIf(): IfStatement | null {
    const startToken = this.cursor.advance();
    const condition = this.expressions().parseExpression();
    if (!condition) return null;

    this.skipNewlines();
    if (!this.cursor.match(TokenKind.Then)) {
      pushError(this.diagnostics, "Expected 'THEN' after IF condition.", this.cursor.peek());
      return null;
    }

    this.skipNewlines();
    const consequent = this.parseBlock(() => this.checkElseOrEndif());

    const elseIfClauses: ElseIfClause[] = [];
    while (this.isElseIf()) {
      const clause = this.parseElseIfClause();
      if (!clause) break;
      elseIfClauses.push(clause);
    }

    let alternate: Statement[] | null = null;
    if (this.cursor.check(TokenKind.Else) && !this.isElseIf()) {
      this.cursor.advance();
      this.skipNewlines();
      alternate = this.parseBlock(() => this.cursor.check(TokenKind.Endif));
    }

    if (!this.cursor.match(TokenKind.Endif)) {
      pushError(this.diagnostics, "Expected 'ENDIF' to close IF statement.", this.cursor.peek());
      return null;
    }

    return {
      kind: 'IfStatement',
      condition,
      consequent,
      elseIfClauses,
      alternate,
      span: span(startToken.span.start, this.cursor.previous().span.end),
    };
  }

  /**
   * WHILE <condition> [DO] NL <block> ENDWHILE
   * `DO` optional — Guide form omits it; exam form often includes it.
   */
  private parseWhile(): WhileStatement | null {
    const startToken = this.cursor.advance(); // WHILE
    const condition = this.expressions().parseExpression();
    if (!condition) return null;

    this.skipNewlines();
    const hasDo = this.cursor.match(TokenKind.Do);
    this.skipNewlines();

    const body = this.parseBlock(() => this.cursor.check(TokenKind.Endwhile));

    if (!this.cursor.match(TokenKind.Endwhile)) {
      pushError(
        this.diagnostics,
        "Expected 'ENDWHILE' to close WHILE statement.",
        this.cursor.peek(),
      );
      return null;
    }

    return {
      kind: 'WhileStatement',
      condition,
      body,
      hasDo,
      span: span(startToken.span.start, this.cursor.previous().span.end),
    };
  }

  /** REPEAT NL <block> UNTIL <condition> */
  private parseRepeat(): RepeatStatement | null {
    const startToken = this.cursor.advance(); // REPEAT
    this.skipNewlines();

    const body = this.parseBlock(() => this.cursor.check(TokenKind.Until));

    if (!this.cursor.match(TokenKind.Until)) {
      pushError(
        this.diagnostics,
        "Expected 'UNTIL' to close REPEAT statement.",
        this.cursor.peek(),
      );
      return null;
    }

    const condition = this.expressions().parseExpression();
    if (!condition) return null;

    return {
      kind: 'RepeatStatement',
      body,
      condition,
      span: span(startToken.span.start, condition.span.end),
    };
  }

  /** FOR <ident> ← <start> TO <end> [STEP <step>] NL <block> NEXT <ident> */
  private parseFor(): ForStatement | null {
    const startToken = this.cursor.advance(); // FOR

    if (!this.cursor.check(TokenKind.Identifier)) {
      pushError(
        this.diagnostics,
        "Expected loop variable after 'FOR'.",
        this.cursor.peek(),
        'E_FOR_VAR',
      );
      return null;
    }
    const variable = this.cursor.advance().lexeme;

    if (!this.cursor.match(TokenKind.Assign)) {
      pushError(
        this.diagnostics,
        "Expected '←' after loop variable in FOR.",
        this.cursor.peek(),
        'E_FOR_ASSIGN',
      );
      return null;
    }

    const start = this.expressions().parseExpression();
    if (!start) return null;

    if (!this.cursor.match(TokenKind.To)) {
      pushError(
        this.diagnostics,
        "Expected 'TO' after start value in FOR.",
        this.cursor.peek(),
        'E_FOR_TO',
      );
      return null;
    }

    const end = this.expressions().parseExpression();
    if (!end) return null;

    let step: Expression | null = null;
    if (this.cursor.match(TokenKind.Step)) {
      step = this.expressions().parseExpression();
      if (!step) return null;
    }

    this.skipNewlines();

    const body = this.parseBlock(() => this.cursor.check(TokenKind.Next));

    if (!this.cursor.match(TokenKind.Next)) {
      pushError(
        this.diagnostics,
        "Expected 'NEXT' to close FOR loop.",
        this.cursor.peek(),
        'E_FOR_NEXT',
      );
      return null;
    }

    // Cambridge §7.1: bare NEXT is legal; repeating the binder is good practice.
    let nextVariable: string | null = null;
    let endSpan = this.cursor.previous().span.end;
    if (this.cursor.check(TokenKind.Identifier)) {
      const nextVar = this.cursor.advance();
      nextVariable = nextVar.lexeme;
      endSpan = nextVar.span.end;
      if (nextVar.lexeme !== variable) {
        pushError(
          this.diagnostics,
          `NEXT variable '${nextVar.lexeme}' does not match FOR variable '${variable}'.`,
          nextVar,
          'E_FOR_NEXT_MISMATCH',
        );
      }
    }

    return {
      kind: 'ForStatement',
      variable,
      start,
      end,
      step,
      body,
      nextVariable,
      span: span(startToken.span.start, endSpan),
    };
  }

  /**
   * CASE OF <expression> NL
   *   { <label> : <block> }
   *   [ OTHERWISE [:] <block> ]
   * ENDCASE
   *
   * Labels: <expression> | <expression> TO <expression>
   * Arm bodies are blocks until the next label, OTHERWISE, or ENDCASE.
   */
  private parseCase(): CaseStatement | null {
    const startToken = this.cursor.advance(); // CASE

    if (!this.cursor.match(TokenKind.Of)) {
      pushError(
        this.diagnostics,
        "Expected 'OF' after 'CASE'.",
        this.cursor.peek(),
        'E_CASE_OF',
      );
      return null;
    }

    const discriminant = this.expressions().parseExpression();
    if (!discriminant) {
      pushError(
        this.diagnostics,
        "Expected expression after 'CASE OF'.",
        this.cursor.peek(),
        'E_CASE_DISC',
      );
      return null;
    }

    this.skipNewlines();

    const arms: CaseArm[] = [];
    const seenKeys = new Map<string, Token>();

    while (
      !this.cursor.isAtEnd() &&
      !this.cursor.check(TokenKind.Otherwise) &&
      !this.cursor.check(TokenKind.Endcase)
    ) {
      const armStart = this.cursor.peek();
      const label = this.parseCaseLabel();
      if (!label) {
        pushError(
          this.diagnostics,
          "Expected CASE label, 'OTHERWISE', or 'ENDCASE'.",
          this.cursor.peek(),
          'E_CASE_LABEL',
        );
        this.synchronizeToNewline();
        this.skipNewlines();
        continue;
      }

      if (!this.cursor.match(TokenKind.Colon)) {
        pushError(
          this.diagnostics,
          "Expected ':' after CASE label.",
          this.cursor.peek(),
          'E_CASE_COLON',
        );
        return null;
      }

      const key = caseLabelKey(label);
      if (seenKeys.has(key)) {
        pushError(
          this.diagnostics,
          `Duplicate CASE label '${key}'.`,
          armStart,
          'E_CASE_DUP',
        );
      } else {
        seenKeys.set(key, armStart);
      }

      this.skipNewlines();
      const body = this.parseCaseArmBody();
      arms.push({
        kind: 'CaseArm',
        label,
        body,
        span: span(label.span.start, this.cursor.previous().span.end),
      });
      this.skipNewlines();
    }

    let otherwise: Statement[] | null = null;
    if (this.cursor.match(TokenKind.Otherwise)) {
      // Colon after OTHERWISE is optional (classroom variants omit it).
      this.cursor.match(TokenKind.Colon);
      this.skipNewlines();
      otherwise = this.parseBlock(() => this.cursor.check(TokenKind.Endcase));

      // Arms after OTHERWISE are unreachable.
      if (
        !this.cursor.check(TokenKind.Endcase) &&
        !this.cursor.isAtEnd() &&
        this.looksLikeCaseLabel()
      ) {
        pushError(
          this.diagnostics,
          'Unreachable CASE arm after OTHERWISE.',
          this.cursor.peek(),
          'E_CASE_UNREACHABLE',
        );
      }
    }

    if (!this.cursor.match(TokenKind.Endcase)) {
      pushError(
        this.diagnostics,
        "Expected 'ENDCASE' to close CASE statement.",
        this.cursor.peek(),
        'E_CASE_END',
      );
      return null;
    }

    return {
      kind: 'CaseStatement',
      discriminant,
      arms,
      otherwise,
      span: span(startToken.span.start, this.cursor.previous().span.end),
    };
  }

  private parseCaseLabel(): CaseLabel | null {
    const low = this.expressions().parseExpression();
    if (!low) return null;

    if (this.cursor.match(TokenKind.To)) {
      const high = this.expressions().parseExpression();
      if (!high) {
        pushError(
          this.diagnostics,
          "Expected expression after 'TO' in CASE range label.",
          this.cursor.peek(),
          'E_CASE_RANGE',
        );
        return null;
      }
      return {
        kind: 'Range',
        low,
        high,
        span: span(low.span.start, high.span.end),
      };
    }

    return {
      kind: 'Value',
      value: low,
      span: low.span,
    };
  }

  /** Parse statements until next CASE label, OTHERWISE, or ENDCASE. */
  private parseCaseArmBody(): Statement[] {
    const body: Statement[] = [];
    this.skipNewlines();

    while (
      !this.cursor.isAtEnd() &&
      !this.cursor.check(TokenKind.Otherwise) &&
      !this.cursor.check(TokenKind.Endcase)
    ) {
      if (this.looksLikeCaseLabel()) break;

      const before = this.cursor.index;
      const stmt = this.parseStatement();
      if (stmt) {
        body.push(stmt);
        this.expectStatementEnd();
      } else if (this.cursor.index === before) {
        this.cursor.advance();
      } else {
        this.synchronizeToNewline();
      }
      this.skipNewlines();
    }

    return body;
  }

  /** Speculative: can we parse `<expr> [TO <expr>] :` from the current position? */
  private looksLikeCaseLabel(): boolean {
    if (
      this.cursor.check(
        TokenKind.Otherwise,
        TokenKind.Endcase,
        TokenKind.Eof,
      )
    ) {
      return false;
    }

    // Statement keywords cannot start a label expression in this dialect.
    if (
      this.cursor.check(
        TokenKind.Input,
        TokenKind.Output,
        TokenKind.If,
        TokenKind.Case,
        TokenKind.While,
        TokenKind.Repeat,
        TokenKind.For,
        TokenKind.Declare,
        TokenKind.Constant,
        TokenKind.Call,
        TokenKind.Return,
        TokenKind.Procedure,
        TokenKind.Function,
        TokenKind.Openfile,
        TokenKind.Readfile,
        TokenKind.Writefile,
        TokenKind.Closefile,
      )
    ) {
      return false;
    }

    const savedIndex = this.cursor.index;
    const savedDiagLen = this.diagnostics.length;

    const low = this.expressions().parseExpression();
    let ok = false;
    if (low) {
      if (this.cursor.match(TokenKind.To)) {
        const high = this.expressions().parseExpression();
        ok = high !== null && this.cursor.check(TokenKind.Colon);
      } else {
        ok = this.cursor.check(TokenKind.Colon);
      }
    }

    this.cursor.index = savedIndex;
    this.diagnostics.length = savedDiagLen;
    return ok;
  }

  private parseElseIfClause(): ElseIfClause | null {
    const elseToken = this.cursor.advance();
    this.cursor.advance(); // IF

    const condition = this.expressions().parseExpression();
    if (!condition) return null;

    this.skipNewlines();
    if (!this.cursor.match(TokenKind.Then)) {
      pushError(
        this.diagnostics,
        "Expected 'THEN' after ELSE IF condition.",
        this.cursor.peek(),
      );
      return null;
    }

    this.skipNewlines();
    const consequent = this.parseBlock(() => this.checkElseOrEndif());

    return {
      kind: 'ElseIfClause',
      condition,
      consequent,
      span: span(elseToken.span.start, this.lastSpanEnd(consequent, condition.span.end)),
    };
  }

  private parseBlock(stop: () => boolean): Statement[] {
    const body: Statement[] = [];
    this.skipNewlines();

    while (!this.cursor.isAtEnd() && !stop()) {
      const before = this.cursor.index;
      const stmt = this.parseStatement();
      if (stmt) {
        body.push(stmt);
        this.expectStatementEnd();
      } else if (this.cursor.index === before) {
        this.cursor.advance();
      } else {
        this.synchronizeToNewline();
      }
      this.skipNewlines();
    }

    return body;
  }

  private checkElseOrEndif(): boolean {
    return this.cursor.check(TokenKind.Else, TokenKind.Endif);
  }

  private isElseIf(): boolean {
    return this.cursor.check(TokenKind.Else) && this.cursor.peek(1).kind === TokenKind.If;
  }

  private lastSpanEnd(body: Statement[], fallback: Position) {
    if (body.length > 0) return body[body.length - 1]!.span.end;
    return fallback;
  }

  /**
   * Statements starting with an identifier or `SUPER` are ambiguous until we
   * see whether `←` follows: `Total ← A + B` is an assignment, while
   * `Player.SetAttempts(5)` and `SUPER.NEW(GivenName)` are call statements
   * (no `CALL` keyword — Cambridge OOP syntax).
   */
  private parseAssignmentOrExpressionStatement(): AssignmentStatement | ExpressionStatement | null {
    const expr = this.expressions();
    const base = expr.parsePrimary();
    if (!base) return null;

    if (this.cursor.match(TokenKind.Assign)) {
      if (
        base.kind !== 'Identifier' &&
        base.kind !== 'IndexExpression' &&
        base.kind !== 'MemberExpression' &&
        base.kind !== 'DerefExpression'
      ) {
        pushError(
          this.diagnostics,
          'Invalid assignment target.',
          this.cursor.previous(),
          'E_ASSIGN_TARGET',
        );
        return null;
      }

      const value = expr.parseExpression();
      if (!value) return null;

      return {
        kind: 'AssignmentStatement',
        target: base,
        value,
        span: span(base.span.start, value.span.end),
      };
    }

    if (base.kind === 'MethodCallExpression' || base.kind === 'CallExpression') {
      return {
        kind: 'ExpressionStatement',
        expression: base,
        span: base.span,
      };
    }

    pushError(
      this.diagnostics,
      "Expected '←' (or '<-') after identifier, or a procedure/method call.",
      this.cursor.peek(),
    );
    return null;
  }

  private parseInput(): InputStatement | null {
    const startToken = this.cursor.advance();
    const target = this.expressions().parseAssignTarget();
    if (!target) return null;
    return {
      kind: 'InputStatement',
      target,
      span: span(startToken.span.start, target.span.end),
    };
  }

  private parseOutput(): OutputStatement | null {
    const startToken = this.cursor.advance();
    const expressions = [];
    const expr = this.expressions();

    const first = expr.parseExpression();
    if (!first) return null;
    expressions.push(first);

    while (this.cursor.match(TokenKind.Comma)) {
      if (this.cursor.check(TokenKind.Newline, TokenKind.Eof)) {
        pushError(
          this.diagnostics,
          'Trailing comma in OUTPUT list.',
          this.cursor.previous(),
          'E_TRAILING_COMMA',
        );
        return null;
      }
      const next = expr.parseExpression();
      if (!next) {
        pushError(
          this.diagnostics,
          'Expected expression after "," in OUTPUT.',
          this.cursor.peek(),
        );
        return null;
      }
      expressions.push(next);
    }

    return {
      kind: 'OutputStatement',
      expressions,
      span: span(startToken.span.start, expressions[expressions.length - 1]!.span.end),
    };
  }

  private expressions(): ExpressionParser {
    return new ExpressionParser(this.cursor, this.diagnostics);
  }

  private expectStatementEnd(): void {
    if (this.cursor.isAtEnd() || this.cursor.check(TokenKind.Newline)) return;
    if (
      this.cursor.check(
        TokenKind.Else,
        TokenKind.Endif,
        TokenKind.Endwhile,
      TokenKind.Until,
      TokenKind.Next,
      TokenKind.Endcase,
      TokenKind.Otherwise,
      TokenKind.Endprocedure,
        TokenKind.Endfunction,
      )
    ) {
      return;
    }

    pushError(
      this.diagnostics,
      `Unexpected '${this.cursor.peek().lexeme}' — expected end of line after statement.`,
      this.cursor.peek(),
      'E_STMT_END',
    );
    this.synchronizeToNewline();
  }

  private synchronizeToNewline(): void {
    while (!this.cursor.isAtEnd() && !this.cursor.check(TokenKind.Newline)) {
      this.cursor.advance();
    }
  }

  private skipNewlines(): void {
    while (this.cursor.match(TokenKind.Newline)) {
      /* skip */
    }
  }
}

function isUnexpectedStructuralKeyword(kind: TokenKind): boolean {
  return (
    kind === TokenKind.Then ||
    kind === TokenKind.Else ||
    kind === TokenKind.Endif ||
    kind === TokenKind.Do ||
    kind === TokenKind.Endwhile ||
    kind === TokenKind.Until ||
    kind === TokenKind.Next ||
    kind === TokenKind.Otherwise ||
    kind === TokenKind.Endcase ||
    kind === TokenKind.Endprocedure ||
    kind === TokenKind.Endfunction ||
    kind === TokenKind.Endtype ||
    kind === TokenKind.Endclass ||
    kind === TokenKind.Returns
  );
}

function isReservedFutureKeyword(kind: TokenKind): boolean {
  return kind === TokenKind.To;
}

/** Stable key for duplicate CASE label detection (literals + simple ids). */
function caseLabelKey(label: CaseLabel): string {
  if (label.kind === 'Range') {
    return `${exprKey(label.low)} TO ${exprKey(label.high)}`;
  }
  return exprKey(label.value);
}

function exprKey(expr: Expression): string {
  switch (expr.kind) {
    case 'IntegerLiteral':
      return String(expr.value);
    case 'RealLiteral':
      return String(expr.value);
    case 'StringLiteral':
      return `"${expr.value}"`;
    case 'CharLiteral':
      return `'${expr.value}'`;
    case 'BooleanLiteral':
      return expr.value ? 'TRUE' : 'FALSE';
    case 'DateLiteral':
      return `${expr.day}/${expr.month}/${expr.year}`;
    case 'Identifier':
      return expr.name;
    case 'UnaryExpression':
      return `${expr.operator}${exprKey(expr.argument)}`;
    case 'BinaryExpression':
      return `(${exprKey(expr.left)} ${expr.operator} ${exprKey(expr.right)})`;
    case 'GroupingExpression':
      return `(${exprKey(expr.expression)})`;
    case 'IndexExpression':
      return `${exprKey(expr.array)}[${expr.indices.map(exprKey).join(', ')}]`;
    case 'MemberExpression':
      return `${exprKey(expr.object)}.${expr.property.name}`;
    case 'CallExpression':
      return `${expr.callee.name}(${expr.args.map(exprKey).join(', ')})`;
    case 'EofExpression':
      return `EOF(${exprKey(expr.fileName)})`;
    case 'SuperExpression':
      return 'SUPER';
    case 'NewExpression':
      return `NEW ${expr.className.name}(${expr.args.map(exprKey).join(', ')})`;
    case 'MethodCallExpression':
      return `${exprKey(expr.object)}.${expr.method.name}(${expr.args.map(exprKey).join(', ')})`;
    case 'AddressOfExpression':
      return `^${exprKey(expr.target as Expression)}`;
    case 'DerefExpression':
      return `${exprKey(expr.pointer)}^`;
    default: {
      const _exhaustive: never = expr;
      return String(_exhaustive);
    }
  }
}
