import {
  emptyTrivia,
  withEmptyTrivia,
  type IrAssignTarget,
  type IrBinaryOp,
  type IrCaseArm,
  type IrElseIfClause,
  type IrExpression,
  type IrParameter,
  type IrProgram,
  type IrStatement,
  type IrTypeName,
  type IrUnaryOp,
} from '../ir/nodes.js';
import { attachTriviaToStatements } from '../trivia/attach.js';
import type { TranslateDiagnostic } from '../types.js';
import {
  isPythonSyntaxKeyword,
  isPythonTranslatorBuiltin,
} from '../rules/python-names.js';
import { lexPython, PyTokenKind, type PyToken } from './lexer.js';

type StmtSpan = {
  readonly start: { offset: number; line: number; column: number };
  readonly end: { offset: number; line: number; column: number };
};

type ParsedStatement =
  | { stmt: IrStatement; span: StmtSpan }
  | { stmt: ReturnType<typeof makeBreak>; span: StmtSpan };

function tokenSpan(t: PyToken, end?: PyToken): StmtSpan {
  const e = end ?? t;
  return {
    start: { offset: t.offset, line: t.line, column: t.column },
    end: {
      offset: e.offset + e.lexeme.length,
      line: e.line,
      column: e.column + Math.max(e.lexeme.length, 1) - 1,
    },
  };
}

function makeBreak() {
  return withEmptyTrivia({ kind: 'IrBreakStatement' as const });
}

function isBreakStatement(stmt: IrStatement): boolean {
  return stmt.kind === 'IrBreakStatement';
}

function isTrueLiteral(expr: IrExpression): boolean {
  return expr.kind === 'IrBooleanLiteral' && expr.value === true;
}

class PyParser {
  private readonly tokens: PyToken[];
  private i = 0;
  readonly diagnostics: TranslateDiagnostic[] = [];

  constructor(
    tokens: PyToken[],
    lexDiagnostics: { message: string; line: number; column: number; code: string }[],
  ) {
    this.tokens = tokens;
    for (const d of lexDiagnostics) {
      this.diagnostics.push({
        severity: 'error',
        message: d.message,
        code: d.code,
        span: {
          start: { offset: 0, line: d.line, column: d.column },
          end: { offset: 0, line: d.line, column: d.column },
        },
      });
    }
  }

  parseProgram(source: string, preserveTrivia: boolean): IrProgram {
    const paired: { stmt: IrStatement; span: StmtSpan }[] = [];
    this.skipNewlines();
    while (!this.check(PyTokenKind.Eof)) {
      if (this.check(PyTokenKind.Newline)) {
        this.advance();
        continue;
      }
      if (this.check(PyTokenKind.Dedent)) {
        this.advance();
        continue;
      }
      const stmt = this.parseStatement(false, true);
      if (stmt) {
        if (stmt.stmt.kind === 'IrBreakStatement') {
          this.error('Standalone break is not supported in this translator subset.', this.peek());
        } else {
          paired.push(stmt as { stmt: IrStatement; span: StmtSpan });
        }
      } else {
        while (
          !this.check(PyTokenKind.Eof) &&
          !this.check(PyTokenKind.Newline) &&
          !this.check(PyTokenKind.Dedent)
        ) {
          this.advance();
        }
      }
      this.skipNewlines();
    }

    if (!preserveTrivia) {
      return {
        kind: 'IrProgram',
        body: paired.map((p) => p.stmt),
        leadingTrivia: emptyTrivia(),
        trailingTrivia: emptyTrivia(),
      };
    }
    const attached = attachTriviaToStatements(source, 'hash', paired);
    return {
      kind: 'IrProgram',
      body: attached.body,
      leadingTrivia: attached.leadingTrivia,
      trailingTrivia: attached.trailingTrivia,
    };
  }

  private parseStatement(
    allowBreak = false,
    allowDef = false,
    allowReturn = false,
  ): ParsedStatement | null {
    if (this.check(PyTokenKind.If)) {
      return this.parseIf(allowBreak, allowReturn);
    }
    if (this.check(PyTokenKind.While)) {
      return this.parseWhile(allowReturn);
    }
    if (this.check(PyTokenKind.For)) {
      return this.parseFor(allowReturn);
    }
    if (this.check(PyTokenKind.Match)) {
      return this.parseMatch(allowReturn);
    }
    if (this.check(PyTokenKind.Def)) {
      if (!allowDef) {
        this.error(
          "Nested 'def' is not supported (Cambridge PROCEDURE/FUNCTION cannot be nested).",
          this.peek(),
        );
        return null;
      }
      return this.parseDef();
    }
    if (this.check(PyTokenKind.Print)) {
      return this.parsePrint();
    }
    if (this.check(PyTokenKind.Pass)) {
      this.advance();
      return null;
    }
    if (this.check(PyTokenKind.Return)) {
      if (!allowReturn) {
        this.error(
          "'return' is only valid inside a function (def with '->' return type).",
          this.peek(),
        );
        return null;
      }
      return this.parseReturn();
    }
    if (allowBreak && this.check(PyTokenKind.Break)) {
      const breakTok = this.advance();
      return { stmt: makeBreak(), span: tokenSpan(breakTok) };
    }

    if (this.isUnsupportedBlockKeyword()) {
      this.error(
        `Translator does not support '${this.peek().lexeme}' (control-flow / PROCEDURE / FUNCTION subset only).`,
        this.peek(),
      );
      return null;
    }

    if (this.check(PyTokenKind.Identifier)) {
      const nameTok = this.advance();

      // Statement-level procedure call: Name(args)
      if (this.check(PyTokenKind.LParen)) {
        return this.parseCallStatement(nameTok);
      }

      let target: IrAssignTarget = {
        kind: 'IrIdentifier',
        name: nameTok.lexeme,
      };
      let endTok = nameTok;

      if (this.match(PyTokenKind.LBracket)) {
        const indices: IrExpression[] = [];
        do {
          const idx = this.parseExpression();
          if (!idx) return null;
          indices.push(idx);
          this.expect(PyTokenKind.RBracket);
        } while (this.match(PyTokenKind.LBracket));
        target = {
          kind: 'IrIndexExpression',
          array: { kind: 'IrIdentifier', name: nameTok.lexeme },
          indices,
        };
        endTok = this.previous();
      }

      if (!this.match(PyTokenKind.Equal)) {
        this.error(
          'Expected "=" after assignment target (subset supports assignments, print, if, while, for, match, and def).',
          this.peek(),
        );
        return null;
      }

      if (this.check(PyTokenKind.Input)) {
        return this.parseInputAssign(nameTok, target);
      }

      const value = this.parseExpression();
      if (!value) return null;
      endTok = this.previous();
      return {
        span: tokenSpan(nameTok, endTok),
        stmt: withEmptyTrivia({
          kind: 'IrAssignment' as const,
          target,
          value,
        }),
      };
    }

    this.error('Expected assignment, print, if, while, for, match, def, or call.', this.peek());
    return null;
  }

  private parseCallStatement(nameTok: PyToken): ParsedStatement | null {
    if (isPythonSyntaxKeyword(nameTok.lexeme)) {
      this.error(
        `Call target '${nameTok.lexeme}' is a Python keyword and cannot map to CALL.`,
        nameTok,
      );
      return null;
    }
    this.expect(PyTokenKind.LParen);
    const args: IrExpression[] = [];
    if (!this.check(PyTokenKind.RParen)) {
      const first = this.parseExpression();
      if (!first) return null;
      args.push(first);
      while (this.match(PyTokenKind.Comma)) {
        if (this.check(PyTokenKind.RParen)) {
          this.error('Trailing comma in call arguments is not supported.', this.peek());
          return null;
        }
        const arg = this.parseExpression();
        if (!arg) return null;
        args.push(arg);
      }
    }
    if (!this.match(PyTokenKind.RParen)) {
      this.error("Expected ')' after call arguments.", this.peek());
      return null;
    }
    return {
      span: tokenSpan(nameTok, this.previous()),
      stmt: withEmptyTrivia({
        kind: 'IrCallStatement' as const,
        callee: nameTok.lexeme,
        args,
      }),
    };
  }

  /**
   * Parse `def Name(params):` as IrProcedureDeclaration.
   * Optional annotations: int/float/str/bool → INTEGER/REAL/STRING/BOOLEAN.
   * Missing annotations default to INTEGER (with a warning).
   * Top-level only — nested def is rejected in parseStatement.
   */
  private parseDef(): ParsedStatement | null {
    const defTok = this.expect(PyTokenKind.Def)!;
    if (!this.check(PyTokenKind.Identifier)) {
      this.error("Expected procedure name after 'def'.", this.peek());
      return null;
    }
    const nameTok = this.advance();
    const name = nameTok.lexeme;

    if (isPythonSyntaxKeyword(name)) {
      this.error(
        `Procedure name '${name}' is a Python keyword and cannot map to PROCEDURE.`,
        nameTok,
      );
      return null;
    }
    if (isPythonTranslatorBuiltin(name)) {
      this.diagnostics.push({
        severity: 'warning',
        code: 'T_PROC_SHADOWS_BUILTIN',
        message: `Procedure name '${name}' shadows a Python builtin used by the translator (print/input/range).`,
        span: {
          start: { offset: nameTok.offset, line: nameTok.line, column: nameTok.column },
          end: {
            offset: nameTok.offset + nameTok.lexeme.length,
            line: nameTok.line,
            column: nameTok.column + Math.max(nameTok.lexeme.length, 1) - 1,
          },
        },
      });
    }

    if (!this.match(PyTokenKind.LParen)) {
      this.error("Expected '(' after procedure name.", this.peek());
      return null;
    }

    const parameters: IrParameter[] = [];
    const seen = new Set<string>();
    if (!this.check(PyTokenKind.RParen)) {
      const first = this.parseDefParameter(seen);
      if (!first) return null;
      parameters.push(first);
      while (this.match(PyTokenKind.Comma)) {
        if (this.check(PyTokenKind.RParen)) {
          this.error('Trailing comma in parameter list is not supported.', this.peek());
          return null;
        }
        const next = this.parseDefParameter(seen);
        if (!next) return null;
        parameters.push(next);
      }
    }

    if (!this.match(PyTokenKind.RParen)) {
      this.error("Expected ')' after parameter list.", this.peek());
      return null;
    }

    // `def Foo() -> int:` → FUNCTION; bare `def Foo():` → PROCEDURE.
    let returnType: IrTypeName | null = null;
    if (this.check(PyTokenKind.Minus)) {
      this.advance();
      if (!this.match(PyTokenKind.Gt)) {
        this.error("Expected '>' after '-' to form return annotation '->'.", this.peek());
        return null;
      }
      if (!this.check(PyTokenKind.Identifier)) {
        this.error('Expected return type after "->".', this.peek());
        return null;
      }
      const mapped = pythonTypeToIr(this.advance().lexeme);
      if (!mapped) {
        this.error(
          'Unsupported return type annotation (use int, float, str, bool).',
          this.previous(),
        );
        return null;
      }
      returnType = mapped;
    }

    this.expect(PyTokenKind.Colon);
    this.skipNewlines();
    const body = this.parseSuite(false, returnType !== null);

    if (returnType !== null) {
      if (!containsReturnIr(body)) {
        this.diagnostics.push({
          severity: 'warning',
          code: 'T_FUNC_NO_RETURN',
          message: `Function '${name}' has no return statement.`,
          span: {
            start: { offset: defTok.offset, line: defTok.line, column: defTok.column },
            end: {
              offset: defTok.offset + defTok.lexeme.length,
              line: defTok.line,
              column: defTok.column + Math.max(defTok.lexeme.length, 1) - 1,
            },
          },
        });
      }
      return {
        span: tokenSpan(defTok, this.previous()),
        stmt: withEmptyTrivia({
          kind: 'IrFunctionDeclaration' as const,
          name,
          parameters,
          returnType,
          body,
        }),
      };
    }

    return {
      span: tokenSpan(defTok, this.previous()),
      stmt: withEmptyTrivia({
        kind: 'IrProcedureDeclaration' as const,
        name,
        parameters,
        body,
      }),
    };
  }

  private parseReturn(): ParsedStatement | null {
    const retTok = this.expect(PyTokenKind.Return)!;
    const value = this.parseExpression();
    if (!value) return null;
    return {
      span: tokenSpan(retTok, this.previous()),
      stmt: withEmptyTrivia({
        kind: 'IrReturnStatement' as const,
        value,
      }),
    };
  }

  private parseDefParameter(seen: Set<string>): IrParameter | null {
    if (!this.check(PyTokenKind.Identifier)) {
      this.error('Expected parameter name.', this.peek());
      return null;
    }
    const nameTok = this.advance();
    const name = nameTok.lexeme;

    if (isPythonSyntaxKeyword(name)) {
      this.error(
        `Parameter name '${name}' is a Python keyword and cannot map to PROCEDURE.`,
        nameTok,
      );
      return null;
    }
    if (seen.has(name)) {
      this.error(`Duplicate parameter name '${name}'.`, nameTok);
      return null;
    }
    seen.add(name);

    let typeName: IrTypeName = 'INTEGER';
    if (this.match(PyTokenKind.Colon)) {
      if (!this.check(PyTokenKind.Identifier)) {
        this.error('Expected type name after ":".', this.peek());
        return null;
      }
      const mapped = pythonTypeToIr(this.advance().lexeme);
      if (!mapped) {
        this.error(
          'Unsupported parameter type annotation (use int, float, str, bool).',
          this.previous(),
        );
        return null;
      }
      typeName = mapped;
    } else {
      this.diagnostics.push({
        severity: 'warning',
        code: 'T_PROC_DEFAULT_TYPE',
        message: `Parameter '${name}' has no type annotation; defaulting to INTEGER for Cambridge PROCEDURE.`,
        span: {
          start: { offset: nameTok.offset, line: nameTok.line, column: nameTok.column },
          end: {
            offset: nameTok.offset + nameTok.lexeme.length,
            line: nameTok.line,
            column: nameTok.column + Math.max(nameTok.lexeme.length, 1) - 1,
          },
        },
      });
    }
    return { kind: 'IrParameter', name, typeName };
  }

  /**
   * Parse Python `match`/`case` (3.10+) into IrCaseStatement.
   * Supported patterns:
   *   case <expr>:
   *   case _v if <low> <= _v and _v <= <high>:
   *   case _:
   */
  private parseMatch(allowReturn = false): ParsedStatement | null {
    const matchTok = this.expect(PyTokenKind.Match)!;
    const discriminant = this.parseExpression();
    if (!discriminant) return null;
    this.expect(PyTokenKind.Colon);
    this.skipNewlines();

    if (!this.match(PyTokenKind.Indent)) {
      this.error("Expected indented case block after 'match'.", this.peek());
      return null;
    }

    const arms: IrCaseArm[] = [];
    let otherwise: IrStatement[] | null = null;
    let sawOtherwise = false;

    while (!this.check(PyTokenKind.Dedent) && !this.check(PyTokenKind.Eof)) {
      this.skipNewlines();
      if (this.check(PyTokenKind.Dedent) || this.check(PyTokenKind.Eof)) break;

      if (!this.match(PyTokenKind.Case)) {
        this.error("Expected 'case' in match block.", this.peek());
        return null;
      }

      // case _:
      if (
        this.check(PyTokenKind.Identifier) &&
        this.peek().lexeme === '_' &&
        this.tokens[this.i + 1]?.kind === PyTokenKind.Colon
      ) {
        this.advance(); // _
        this.expect(PyTokenKind.Colon);
        this.skipNewlines();
        const body = this.parseSuite(false, allowReturn);
        if (sawOtherwise) {
          this.error('Duplicate wildcard case (_) in match.', matchTok);
        }
        sawOtherwise = true;
        otherwise = body;
        continue;
      }

      // case _v if low <= _v and _v <= high:
      if (
        this.check(PyTokenKind.Identifier) &&
        this.tokens[this.i + 1]?.kind === PyTokenKind.If
      ) {
        const capture = this.advance().lexeme;
        this.advance(); // if
        const guard = this.parseExpression();
        if (!guard) return null;
        this.expect(PyTokenKind.Colon);
        this.skipNewlines();
        const body = this.parseSuite(false, allowReturn);
        const range = this.extractRangeGuard(guard, capture);
        if (!range) {
          this.error(
            "Unsupported case guard; expected '<low> <= <var> and <var> <= <high>'.",
            matchTok,
          );
          return null;
        }
        if (sawOtherwise) {
          this.error('Unreachable case after wildcard (_).', matchTok);
        }
        arms.push({
          kind: 'IrCaseArm',
          label: { kind: 'IrCaseRange', low: range.low, high: range.high },
          body,
        });
        continue;
      }

      // case <expr>:
      const value = this.parseExpression();
      if (!value) return null;
      this.expect(PyTokenKind.Colon);
      this.skipNewlines();
      const body = this.parseSuite(false, allowReturn);
      if (sawOtherwise) {
        this.error('Unreachable case after wildcard (_).', matchTok);
      }
      arms.push({
        kind: 'IrCaseArm',
        label: { kind: 'IrCaseValue', value },
        body,
      });
    }

    this.expect(PyTokenKind.Dedent);

    return {
      span: tokenSpan(matchTok, this.previous()),
      stmt: withEmptyTrivia({
        kind: 'IrCaseStatement' as const,
        discriminant,
        arms,
        otherwise,
      }),
    };
  }

  /** Recognize `low <= var and var <= high`. */
  private extractRangeGuard(
    guard: IrExpression,
    capture: string,
  ): { low: IrExpression; high: IrExpression } | null {
    if (guard.kind !== 'IrBinaryExpression' || guard.operator !== 'and') {
      return null;
    }
    const left = guard.left;
    const right = guard.right;
    if (
      left.kind === 'IrBinaryExpression' &&
      left.operator === '<=' &&
      right.kind === 'IrBinaryExpression' &&
      right.operator === '<=' &&
      left.right.kind === 'IrIdentifier' &&
      left.right.name === capture &&
      right.left.kind === 'IrIdentifier' &&
      right.left.name === capture
    ) {
      return { low: left.left, high: right.right };
    }
    return null;
  }

  private parseWhile(allowReturn = false): { stmt: IrStatement; span: StmtSpan } | null {
    const whileTok = this.expect(PyTokenKind.While)!;
    const condition = this.parseExpression();
    if (!condition) return null;
    this.expect(PyTokenKind.Colon);
    this.skipNewlines();
    const rawBody = this.parseSuite(true, allowReturn);
    const repeat = this.tryParseRepeat(condition, rawBody, whileTok);
    if (repeat) return repeat;
    const body = this.stripUnsupportedBreaks(rawBody);
    return {
      span: tokenSpan(whileTok, this.previous()),
      stmt: withEmptyTrivia({
        kind: 'IrWhileStatement' as const,
        condition,
        body,
      }),
    };
  }

  /**
   * Parse `for <var> in range(<start>, <stop>[, <step>]):` into IrForStatement.
   * Recovers Cambridge inclusive semantics from the ±1 adjustment on stop.
   */
  private parseFor(allowReturn = false): ParsedStatement | null {
    const forTok = this.expect(PyTokenKind.For)!;

    if (!this.check(PyTokenKind.Identifier)) {
      this.error("Expected loop variable after 'for'.", this.peek());
      return null;
    }
    const variable = this.advance().lexeme;

    if (!this.match(PyTokenKind.In)) {
      this.error("Expected 'in' after loop variable.", this.peek());
      return null;
    }

    if (!this.match(PyTokenKind.Range)) {
      this.error(
        "Translator only supports 'for <var> in range(...)' loops.",
        this.peek(),
      );
      return null;
    }

    if (!this.match(PyTokenKind.LParen)) {
      this.error("Expected '(' after 'range'.", this.peek());
      return null;
    }

    const args: IrExpression[] = [];
    if (!this.check(PyTokenKind.RParen)) {
      const first = this.parseExpression();
      if (!first) return null;
      args.push(first);
      while (this.match(PyTokenKind.Comma)) {
        const arg = this.parseExpression();
        if (!arg) return null;
        args.push(arg);
      }
    }

    if (!this.match(PyTokenKind.RParen)) {
      this.error("Expected ')' after range arguments.", this.peek());
      return null;
    }

    this.expect(PyTokenKind.Colon);
    this.skipNewlines();
    const body = this.parseSuite(false, allowReturn);

    if (args.length < 2 || args.length > 3) {
      this.error(
        'Translator expects range(start, stop) or range(start, stop, step).',
        forTok,
      );
      return null;
    }

    const rawStart = args[0]!;
    const rawStop = args[1]!;
    const rawStep = args.length === 3 ? args[2]! : null;

    const end = this.reverseRangeAdjust(rawStop, rawStep);
    if (!end) {
      this.error(
        'Cannot reverse-translate range stop value into Cambridge inclusive bound.',
        forTok,
      );
      return null;
    }

    return {
      span: tokenSpan(forTok, this.previous()),
      stmt: withEmptyTrivia({
        kind: 'IrForStatement' as const,
        variable,
        start: rawStart,
        end,
        step: rawStep,
        body,
      }),
    };
  }

  /**
   * Reverse the ±1 adjustment that the Python printer added.
   * `stop` in range() is `end + 1` (ascending) or `end - 1` (descending).
   * Returns the Cambridge inclusive `end`.
   */
  private reverseRangeAdjust(
    stop: IrExpression,
    step: IrExpression | null,
  ): IrExpression | null {
    const isDesc =
      step !== null &&
      ((step.kind === 'IrUnaryExpression' &&
        step.operator === '-' &&
        (step.argument.kind === 'IrIntegerLiteral' || step.argument.kind === 'IrRealLiteral')) ||
        ((step.kind === 'IrIntegerLiteral' || step.kind === 'IrRealLiteral') && step.value < 0));

    const expectedOp: '+' | '-' = isDesc ? '-' : '+';

    if (
      stop.kind === 'IrBinaryExpression' &&
      stop.operator === expectedOp &&
      stop.right.kind === 'IrIntegerLiteral' &&
      stop.right.value === 1
    ) {
      return stop.left;
    }

    return null;
  }

  private parseIf(allowBreak = false, allowReturn = false): ParsedStatement | null {
    const ifTok = this.expect(PyTokenKind.If)!;
    const condition = this.parseExpression();
    if (!condition) return null;
    this.expect(PyTokenKind.Colon);
    this.skipNewlines();
    const consequent = this.parseSuite(allowBreak, allowReturn);

    const elseIfClauses: IrElseIfClause[] = [];
    while (this.check(PyTokenKind.Elif)) {
      this.advance();
      const c = this.parseExpression();
      if (!c) return null;
      this.expect(PyTokenKind.Colon);
      this.skipNewlines();
      const clauseBody = this.parseSuite(allowBreak, allowReturn);
      elseIfClauses.push({
        kind: 'IrElseIfClause',
        condition: c,
        consequent: allowBreak ? clauseBody : this.stripUnsupportedBreaks(clauseBody),
      });
    }

    let alternate: IrStatement[] | null = null;
    if (this.check(PyTokenKind.Else)) {
      this.advance();
      this.expect(PyTokenKind.Colon);
      this.skipNewlines();
      const elseBody = this.parseSuite(allowBreak, allowReturn);
      alternate = allowBreak ? elseBody : this.stripUnsupportedBreaks(elseBody);
    }

    return {
      span: tokenSpan(ifTok, this.previous()),
      stmt: withEmptyTrivia({
        kind: 'IrIfStatement' as const,
        condition,
        consequent: allowBreak ? consequent : this.stripUnsupportedBreaks(consequent),
        elseIfClauses,
        alternate,
      }),
    };
  }

  /** Parse an indented block; `pass` alone yields an empty statement list. */
  private parseSuite(allowBreak = false, allowReturn = false): IrStatement[] {
    if (!this.match(PyTokenKind.Indent)) {
      // Single-line suite not supported in this subset
      this.error('Expected indented block after ":".', this.peek());
      return [];
    }

    const body: IrStatement[] = [];
    let onlyPass = true;

    while (!this.check(PyTokenKind.Dedent) && !this.check(PyTokenKind.Eof)) {
      this.skipNewlines();
      if (this.check(PyTokenKind.Dedent) || this.check(PyTokenKind.Eof)) break;

      if (this.check(PyTokenKind.Pass)) {
        this.advance();
        this.skipNewlines();
        continue;
      }

      onlyPass = false;
      const stmt = this.parseStatement(allowBreak, false, allowReturn);
      if (stmt) body.push(stmt.stmt);
      else {
        while (
          !this.check(PyTokenKind.Eof) &&
          !this.check(PyTokenKind.Newline) &&
          !this.check(PyTokenKind.Dedent)
        ) {
          this.advance();
        }
      }
      this.skipNewlines();
    }

    this.expect(PyTokenKind.Dedent);
    return onlyPass && body.length === 0 ? [] : body;
  }

  private stripUnsupportedBreaks(body: IrStatement[]): IrStatement[] {
    const out: IrStatement[] = [];
    for (const stmt of body) {
      if (isBreakStatement(stmt)) {
        this.error(
          'Python break is only supported as the final `if <condition>: break` in REPEAT translation.',
          this.previous(),
        );
        continue;
      }
      if (stmt.kind === 'IrIfStatement') {
        out.push({
          ...stmt,
          consequent: this.stripUnsupportedBreaks(stmt.consequent),
          elseIfClauses: stmt.elseIfClauses.map((clause) => ({
            ...clause,
            consequent: this.stripUnsupportedBreaks(clause.consequent),
          })),
          alternate:
            stmt.alternate === null
              ? null
              : this.stripUnsupportedBreaks(stmt.alternate),
        });
        continue;
      }
      if (stmt.kind === 'IrWhileStatement') {
        out.push({ ...stmt, body: this.stripUnsupportedBreaks(stmt.body) });
        continue;
      }
      if (stmt.kind === 'IrRepeatStatement') {
        out.push({ ...stmt, body: this.stripUnsupportedBreaks(stmt.body) });
        continue;
      }
      out.push(stmt);
    }
    return out;
  }

  private tryParseRepeat(
    condition: IrExpression,
    rawBody: IrStatement[],
    whileTok: PyToken,
  ): { stmt: IrStatement; span: StmtSpan } | null {
    if (!isTrueLiteral(condition) || rawBody.length === 0) return null;
    const last = rawBody[rawBody.length - 1];
    if (!last || last.kind !== 'IrIfStatement') return null;
    if (last.elseIfClauses.length > 0 || last.alternate !== null) return null;
    if (
      last.consequent.length !== 1 ||
      !isBreakStatement(last.consequent[0]!)
    ) {
      return null;
    }

    return {
      span: tokenSpan(whileTok, this.previous()),
      stmt: withEmptyTrivia({
        kind: 'IrRepeatStatement' as const,
        body: this.stripUnsupportedBreaks(rawBody.slice(0, -1)),
        condition: last.condition,
      }),
    };
  }

  private parseInputAssign(
    nameTok: PyToken,
    target: IrAssignTarget,
  ): { stmt: IrStatement; span: StmtSpan } | null {
    this.expect(PyTokenKind.Input);
    this.expect(PyTokenKind.LParen);
    let prompt: IrExpression | null = null;
    if (!this.check(PyTokenKind.RParen)) {
      prompt = this.parseExpression();
      if (!prompt) return null;
    }
    const rparen = this.expect(PyTokenKind.RParen);
    return {
      span: tokenSpan(nameTok, rparen ?? this.previous()),
      stmt: withEmptyTrivia({
        kind: 'IrInput' as const,
        target,
        prompt,
      }),
    };
  }

  private parsePrint(): { stmt: IrStatement; span: StmtSpan } | null {
    const printTok = this.expect(PyTokenKind.Print)!;
    this.expect(PyTokenKind.LParen);
    const values: IrExpression[] = [];
    if (!this.check(PyTokenKind.RParen)) {
      const first = this.parseExpression();
      if (!first) return null;
      values.push(first);
      while (this.match(PyTokenKind.Comma)) {
        const next = this.parseExpression();
        if (!next) return null;
        values.push(next);
      }
    }
    const rparen = this.expect(PyTokenKind.RParen);
    return {
      span: tokenSpan(printTok, rparen ?? this.previous()),
      stmt: withEmptyTrivia({
        kind: 'IrOutput' as const,
        values,
      }),
    };
  }

  private parseExpression(): IrExpression | null {
    return this.parseOr();
  }

  private parseOr(): IrExpression | null {
    let left = this.parseAnd();
    if (!left) return null;
    while (this.match(PyTokenKind.Or)) {
      const right = this.parseAnd();
      if (!right) return null;
      left = { kind: 'IrBinaryExpression', operator: 'or', left, right };
    }
    return left;
  }

  private parseAnd(): IrExpression | null {
    let left = this.parseNot();
    if (!left) return null;
    while (this.match(PyTokenKind.And)) {
      const right = this.parseNot();
      if (!right) return null;
      left = { kind: 'IrBinaryExpression', operator: 'and', left, right };
    }
    return left;
  }

  private parseNot(): IrExpression | null {
    if (this.match(PyTokenKind.Not)) {
      const argument = this.parseNot();
      if (!argument) return null;
      return { kind: 'IrUnaryExpression', operator: 'not', argument };
    }
    return this.parseComparison();
  }

  private parseComparison(): IrExpression | null {
    let left = this.parseAdd();
    if (!left) return null;
    const op = this.matchComparisonOp();
    if (op) {
      const right = this.parseAdd();
      if (!right) return null;
      left = { kind: 'IrBinaryExpression', operator: op, left, right };
    }
    return left;
  }

  private matchComparisonOp(): IrBinaryOp | null {
    if (this.match(PyTokenKind.EqEq)) return '==';
    if (this.match(PyTokenKind.NotEq)) return '!=';
    if (this.match(PyTokenKind.LtEq)) return '<=';
    if (this.match(PyTokenKind.GtEq)) return '>=';
    if (this.match(PyTokenKind.Lt)) return '<';
    if (this.match(PyTokenKind.Gt)) return '>';
    return null;
  }

  private parseAdd(): IrExpression | null {
    let left = this.parseMul();
    if (!left) return null;
    while (this.check(PyTokenKind.Plus) || this.check(PyTokenKind.Minus)) {
      const op: IrBinaryOp = this.match(PyTokenKind.Plus)
        ? '+'
        : (this.advance(), '-');
      const right = this.parseMul();
      if (!right) return null;
      left = { kind: 'IrBinaryExpression', operator: op, left, right };
    }
    return left;
  }

  private parseMul(): IrExpression | null {
    let left = this.parseUnary();
    if (!left) return null;
    while (
      this.check(PyTokenKind.Star) ||
      this.check(PyTokenKind.Slash) ||
      this.check(PyTokenKind.SlashSlash) ||
      this.check(PyTokenKind.Percent)
    ) {
      let op: IrBinaryOp;
      if (this.match(PyTokenKind.Star)) op = '*';
      else if (this.match(PyTokenKind.SlashSlash)) op = '//';
      else if (this.match(PyTokenKind.Percent)) op = '%';
      else {
        this.advance();
        op = '/';
      }
      const right = this.parseUnary();
      if (!right) return null;
      left = { kind: 'IrBinaryExpression', operator: op, left, right };
    }
    return left;
  }

  private parseUnary(): IrExpression | null {
    if (this.check(PyTokenKind.Plus) || this.check(PyTokenKind.Minus)) {
      const op: IrUnaryOp = this.match(PyTokenKind.Plus)
        ? '+'
        : (this.advance(), '-');
      const argument = this.parseUnary();
      if (!argument) return null;
      return { kind: 'IrUnaryExpression', operator: op, argument };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): IrExpression | null {
    if (this.match(PyTokenKind.Integer)) {
      return { kind: 'IrIntegerLiteral', value: Number(this.previous().lexeme) };
    }
    if (this.match(PyTokenKind.Real)) {
      return { kind: 'IrRealLiteral', value: Number(this.previous().lexeme) };
    }
    if (this.match(PyTokenKind.Char)) {
      return { kind: 'IrCharLiteral', value: this.previous().lexeme };
    }
    if (this.match(PyTokenKind.String)) {
      return { kind: 'IrStringLiteral', value: this.previous().lexeme };
    }
    if (this.match(PyTokenKind.True)) {
      return { kind: 'IrBooleanLiteral', value: true };
    }
    if (this.match(PyTokenKind.False)) {
      return { kind: 'IrBooleanLiteral', value: false };
    }
    if (this.match(PyTokenKind.Identifier)) {
      const name = this.previous().lexeme;
      if (this.check(PyTokenKind.LParen)) {
        if (isPythonSyntaxKeyword(name)) {
          this.error(
            `Call target '${name}' is a Python keyword and cannot map to a function call.`,
            this.previous(),
          );
          return null;
        }
        this.advance(); // (
        const args: IrExpression[] = [];
        if (!this.check(PyTokenKind.RParen)) {
          const first = this.parseExpression();
          if (!first) return null;
          args.push(first);
          while (this.match(PyTokenKind.Comma)) {
            if (this.check(PyTokenKind.RParen)) {
              this.error('Trailing comma in call arguments is not supported.', this.peek());
              return null;
            }
            const arg = this.parseExpression();
            if (!arg) return null;
            args.push(arg);
          }
        }
        if (!this.match(PyTokenKind.RParen)) {
          this.error("Expected ')' after call arguments.", this.peek());
          return null;
        }
        return { kind: 'IrCallExpression', callee: name, args };
      }
      if (this.match(PyTokenKind.LBracket)) {
        const indices: IrExpression[] = [];
        do {
          const idx = this.parseExpression();
          if (!idx) return null;
          indices.push(idx);
          this.expect(PyTokenKind.RBracket);
        } while (this.match(PyTokenKind.LBracket));
        return {
          kind: 'IrIndexExpression',
          array: { kind: 'IrIdentifier', name },
          indices,
        };
      }
      return { kind: 'IrIdentifier', name };
    }
    if (this.match(PyTokenKind.LParen)) {
      const inner = this.parseExpression();
      if (!inner) return null;
      this.expect(PyTokenKind.RParen);
      return { kind: 'IrGroupingExpression', expression: inner };
    }
    this.error('Expected expression.', this.peek());
    return null;
  }

  private isUnsupportedBlockKeyword(): boolean {
    const lex = this.peek().lexeme;
    return ['class', 'with'].includes(lex);
  }

  private skipNewlines(): void {
    while (this.match(PyTokenKind.Newline)) {
      /* skip */
    }
  }

  private peek(): PyToken {
    return this.tokens[this.i]!;
  }

  private previous(): PyToken {
    return this.tokens[this.i - 1]!;
  }

  private check(kind: PyTokenKind): boolean {
    return this.peek().kind === kind;
  }

  private advance(): PyToken {
    const t = this.peek();
    if (t.kind !== PyTokenKind.Eof) this.i += 1;
    return t;
  }

  private match(kind: PyTokenKind): boolean {
    if (!this.check(kind)) return false;
    this.advance();
    return true;
  }

  private expect(kind: PyTokenKind): PyToken | null {
    if (this.check(kind)) return this.advance();
    this.error(`Expected ${kind}.`, this.peek());
    return null;
  }

  private error(message: string, tok: PyToken): void {
    this.diagnostics.push({
      severity: 'error',
      message,
      code: 'T_PY_PARSE',
      span: tokenSpan(tok),
    });
  }
}

function pythonTypeToIr(name: string): IrTypeName | null {
  switch (name) {
    case 'int':
      return 'INTEGER';
    case 'float':
      return 'REAL';
    case 'str':
      return 'STRING';
    case 'bool':
      return 'BOOLEAN';
    default:
      return null;
  }
}

function containsReturnIr(statements: readonly IrStatement[]): boolean {
  for (const stmt of statements) {
    if (stmt.kind === 'IrReturnStatement') return true;
    if (stmt.kind === 'IrIfStatement') {
      if (containsReturnIr(stmt.consequent)) return true;
      for (const c of stmt.elseIfClauses) {
        if (containsReturnIr(c.consequent)) return true;
      }
      if (stmt.alternate && containsReturnIr(stmt.alternate)) return true;
    } else if (
      stmt.kind === 'IrWhileStatement' ||
      stmt.kind === 'IrRepeatStatement' ||
      stmt.kind === 'IrForStatement'
    ) {
      if (containsReturnIr(stmt.body)) return true;
    } else if (stmt.kind === 'IrCaseStatement') {
      for (const arm of stmt.arms) {
        if (containsReturnIr(arm.body)) return true;
      }
      if (stmt.otherwise && containsReturnIr(stmt.otherwise)) return true;
    }
  }
  return false;
}

export function parsePythonToIr(
  source: string,
  preserveTrivia: boolean,
): { ir: IrProgram; diagnostics: TranslateDiagnostic[] } {
  const lexed = lexPython(source);
  const parser = new PyParser(lexed.tokens, lexed.diagnostics);
  const ir = parser.parseProgram(source, preserveTrivia);
  return { ir, diagnostics: parser.diagnostics };
}
