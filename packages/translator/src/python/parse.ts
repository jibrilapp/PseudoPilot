import {
  emptyTrivia,
  withEmptyTrivia,
  type IrBinaryOp,
  type IrExpression,
  type IrProgram,
  type IrStatement,
  type IrUnaryOp,
} from '../ir/nodes.js';
import { attachTriviaToStatements } from '../trivia/attach.js';
import type { TranslateDiagnostic } from '../types.js';
import { lexPython, PyTokenKind, type PyToken } from './lexer.js';

/** Minimal source span for trivia attachment (1-based line/column). */
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

  constructor(tokens: PyToken[], lexDiagnostics: { message: string; line: number; column: number; code: string }[]) {
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
      // Reject indentation: if line starts with unexpected structure we already skipped ws.
      const startTok = this.peek();
      const stmt = this.parseStatement();
      if (stmt) {
        paired.push(stmt);
      } else {
        // Recovery: skip to newline
        while (!this.check(PyTokenKind.Eof) && !this.check(PyTokenKind.Newline)) {
          this.advance();
        }
      }
      this.skipNewlines();
      void startTok;
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
    if (this.check(PyTokenKind.Print)) {
      return this.parsePrint();
    }

    if (this.check(PyTokenKind.Identifier)) {
      const nameTok = this.advance();
      if (!this.match(PyTokenKind.Equal)) {
        this.error('Expected "=" after identifier (V1 only supports assignments and print).', nameTok);
        return null;
      }
      // input() special form
      if (this.check(PyTokenKind.Input)) {
        return this.parseInputAssign(nameTok);
      }
      const value = this.parseExpression();
      if (!value) return null;
      const end = this.previous();
      return {
        span: tokenSpan(nameTok, end),
        stmt: withEmptyTrivia({
          kind: 'IrAssignment' as const,
          target: { kind: 'IrIdentifier', name: nameTok.lexeme },
          value,
        }),
      };
    }

    this.error('Expected assignment or print statement.', this.peek());
    return null;
  }

  private parseInputAssign(nameTok: PyToken): { stmt: IrStatement; span: StmtSpan } | null {
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
        target: { kind: 'IrIdentifier', name: nameTok.lexeme },
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
      left = {
        kind: 'IrBinaryExpression',
        operator: 'or',
        left,
        right,
      };
    }
    return left;
  }

  private parseAnd(): IrExpression | null {
    let left = this.parseNot();
    if (!left) return null;
    while (this.match(PyTokenKind.And)) {
      const right = this.parseNot();
      if (!right) return null;
      left = {
        kind: 'IrBinaryExpression',
        operator: 'and',
        left,
        right,
      };
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
      const op: IrBinaryOp = this.match(PyTokenKind.Plus) ? '+' : (this.advance(), '-');
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
      const op: IrUnaryOp = this.match(PyTokenKind.Plus) ? '+' : (this.advance(), '-');
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
      // Reject bare calls other than handled at statement level
      if (this.check(PyTokenKind.LParen)) {
        this.error(`V1 translator does not support call '${name}(...).'`, this.previous());
        return null;
      }
      return { kind: 'IrIdentifier', name };
    }
    if (this.match(PyTokenKind.LParen)) {
      const inner = this.parseExpression();
      if (!inner) return null;
      this.expect(PyTokenKind.RParen);
      return { kind: 'IrGroupingExpression', expression: inner };
    }
    // Reject if/while/for keywords used as identifiers
    if (this.isBlockKeyword()) {
      this.error(
        'V1 translator does not support control-flow statements (if/for/while/...).',
        this.peek(),
      );
      return null;
    }
    this.error('Expected expression.', this.peek());
    return null;
  }

  private isBlockKeyword(): boolean {
    const lex = this.peek().lexeme;
    return ['if', 'elif', 'else', 'for', 'while', 'def', 'class', 'return', 'pass'].includes(lex);
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
  // Reject indented blocks early (lines starting with whitespace after a newline with content)
  if (hasIndentedBlock(source)) {
    return {
      ir: {
        kind: 'IrProgram',
        body: [],
        leadingTrivia: emptyTrivia(),
        trailingTrivia: emptyTrivia(),
      },
      diagnostics: [
        {
          severity: 'error',
          code: 'T_PY_INDENT',
          message:
            'V1 translator does not support indented Python blocks (if/for/while/def). Use top-level statements only.',
        },
      ],
    };
  }

  const lexed = lexPython(source);
  const parser = new PyParser(lexed.tokens, lexed.diagnostics);
  const ir = parser.parseProgram(source, preserveTrivia);
  return { ir, diagnostics: parser.diagnostics };
}

function hasIndentedBlock(source: string): boolean {
  const lines = source.split(/\r?\n/);
  for (const line of lines) {
    if (line.length === 0) continue;
    if (/^[ \t]+/.test(line) && line.trim().length > 0 && !line.trim().startsWith('#')) {
      return true;
    }
  }
  return false;
}
