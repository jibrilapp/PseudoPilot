import {
  emptyTrivia,
  withEmptyTrivia,
  type IrAssignTarget,
  type IrBinaryOp,
  type IrElseIfClause,
  type IrExpression,
  type IrProgram,
  type IrStatement,
  type IrUnaryOp,
} from '../ir/nodes.js';
import { attachTriviaToStatements } from '../trivia/attach.js';
import type { TranslateDiagnostic } from '../types.js';
import { lexPython, PyTokenKind, type PyToken } from './lexer.js';

type StmtSpan = {
  readonly start: { offset: number; line: number; column: number };
  readonly end: { offset: number; line: number; column: number };
};

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
      const stmt = this.parseStatement();
      if (stmt) {
        paired.push(stmt);
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

  private parseStatement(): { stmt: IrStatement; span: StmtSpan } | null {
    if (this.check(PyTokenKind.If)) {
      return this.parseIf();
    }
    if (this.check(PyTokenKind.Print)) {
      return this.parsePrint();
    }
    if (this.check(PyTokenKind.Pass)) {
      this.advance();
      return null;
    }

    if (this.isUnsupportedBlockKeyword()) {
      this.error(
        `Translator does not support '${this.peek().lexeme}' (IF only among control-flow).`,
        this.peek(),
      );
      return null;
    }

    if (this.check(PyTokenKind.Identifier)) {
      const nameTok = this.advance();
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
          'Expected "=" after assignment target (subset supports assignments, print, and if).',
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

    this.error('Expected assignment, print, or if statement.', this.peek());
    return null;
  }

  private parseIf(): { stmt: IrStatement; span: StmtSpan } | null {
    const ifTok = this.expect(PyTokenKind.If)!;
    const condition = this.parseExpression();
    if (!condition) return null;
    this.expect(PyTokenKind.Colon);
    this.skipNewlines();
    const consequent = this.parseSuite();

    const elseIfClauses: IrElseIfClause[] = [];
    while (this.check(PyTokenKind.Elif)) {
      this.advance();
      const c = this.parseExpression();
      if (!c) return null;
      this.expect(PyTokenKind.Colon);
      this.skipNewlines();
      elseIfClauses.push({
        kind: 'IrElseIfClause',
        condition: c,
        consequent: this.parseSuite(),
      });
    }

    let alternate: IrStatement[] | null = null;
    if (this.check(PyTokenKind.Else)) {
      this.advance();
      this.expect(PyTokenKind.Colon);
      this.skipNewlines();
      alternate = this.parseSuite();
    }

    return {
      span: tokenSpan(ifTok, this.previous()),
      stmt: withEmptyTrivia({
        kind: 'IrIfStatement' as const,
        condition,
        consequent,
        elseIfClauses,
        alternate,
      }),
    };
  }

  /** Parse an indented block; `pass` alone yields an empty statement list. */
  private parseSuite(): IrStatement[] {
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
      const stmt = this.parseStatement();
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
        this.error(
          `Translator does not support call '${name}(...).'`,
          this.previous(),
        );
        return null;
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
    return ['for', 'while', 'def', 'class', 'return', 'match', 'with'].includes(
      lex,
    );
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

export function parsePythonToIr(
  source: string,
  preserveTrivia: boolean,
): { ir: IrProgram; diagnostics: TranslateDiagnostic[] } {
  const lexed = lexPython(source);
  const parser = new PyParser(lexed.tokens, lexed.diagnostics);
  const ir = parser.parseProgram(source, preserveTrivia);
  return { ir, diagnostics: parser.diagnostics };
}
