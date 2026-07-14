import type { Diagnostic } from '../diagnostics.js';
import { span } from '../diagnostics.js';
import type {
  BinaryOperator,
  Expression,
  Identifier,
  AssignTarget,
  UnaryOperator,
} from '../ast/nodes.js';
import { TokenKind, type Token } from '../lexer/token.js';
import { pushError, type TokenCursor } from './cursor.js';

/**
 * Pratt expression parser.
 *
 * Binding powers (higher = tighter):
 *    1  OR
 *    2  AND
 *    3  relational  = <> < <= > >=
 *   10  + -
 *   20  * / DIV MOD
 *   30  unary + - NOT
 */
export class ExpressionParser {
  constructor(
    private readonly cursor: TokenCursor,
    private readonly diagnostics: Diagnostic[],
  ) {}

  parseExpression(): Expression | null {
    return this.parsePrecedence(0);
  }

  private parsePrecedence(minBp: number): Expression | null {
    let left = this.parsePrefix();
    if (!left) return null;

    for (;;) {
      if (this.cursor.isExpressionTerminator()) break;

      const op = this.cursor.peek();
      const bp = infixBindingPower(op.kind);
      if (bp === null || bp.left < minBp) break;

      const operator = binaryOperatorFromToken(op);
      if (!operator) break;

      this.cursor.advance();

      if (this.cursor.check(TokenKind.Newline, TokenKind.Eof)) {
        pushError(this.diagnostics, `Expected expression after '${operator}'.`, op);
        break;
      }

      const right = this.parsePrecedence(bp.right);
      if (!right) {
        pushError(this.diagnostics, `Expected expression after '${operator}'.`, op);
        break;
      }

      left = {
        kind: 'BinaryExpression',
        operator,
        left,
        right,
        span: span(left.span.start, right.span.end),
      };
    }

    return left;
  }

  private parsePrefix(): Expression | null {
    const token = this.cursor.peek();

    if (
      token.kind === TokenKind.Plus ||
      token.kind === TokenKind.Minus ||
      token.kind === TokenKind.Not
    ) {
      this.cursor.advance();
      const argument = this.parsePrecedence(PREFIX_BP);
      if (!argument) {
        pushError(this.diagnostics, 'Expected expression after unary operator.', token);
        return null;
      }
      const operator: UnaryOperator =
        token.kind === TokenKind.Not ? 'NOT' : token.kind === TokenKind.Minus ? '-' : '+';
      return {
        kind: 'UnaryExpression',
        operator,
        argument,
        span: span(token.span.start, argument.span.end),
      };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): Expression | null {
    const token = this.cursor.peek();

    switch (token.kind) {
      case TokenKind.Integer: {
        this.cursor.advance();
        return { kind: 'IntegerLiteral', value: token.literal as number, span: token.span };
      }
      case TokenKind.Real: {
        this.cursor.advance();
        return { kind: 'RealLiteral', value: token.literal as number, span: token.span };
      }
      case TokenKind.String: {
        this.cursor.advance();
        return { kind: 'StringLiteral', value: token.literal as string, span: token.span };
      }
      case TokenKind.Boolean: {
        this.cursor.advance();
        return { kind: 'BooleanLiteral', value: token.literal as boolean, span: token.span };
      }
      case TokenKind.Identifier: {
        const id = this.parseIdentifier();
        if (!id) return null;
        if (this.cursor.match(TokenKind.LParen)) {
          const args = this.parseArgumentList();
          return {
            kind: 'CallExpression',
            callee: id,
            args,
            span: span(id.span.start, this.cursor.previous().span.end),
          };
        }
        if (this.cursor.match(TokenKind.LBracket)) {
          const indices = this.parseIndexList();
          return {
            kind: 'IndexExpression',
            array: id,
            indices,
            span: span(id.span.start, this.cursor.previous().span.end),
          };
        }
        return id;
      }
      case TokenKind.FileEof: {
        const start = this.cursor.advance();
        if (!this.cursor.match(TokenKind.LParen)) {
          pushError(this.diagnostics, "Expected '(' after EOF.", this.cursor.peek());
          return null;
        }
        const fileName = this.parseExpression();
        if (!fileName) return null;
        if (!this.cursor.match(TokenKind.RParen)) {
          pushError(this.diagnostics, "Expected ')' after EOF(…).", this.cursor.peek());
        }
        return {
          kind: 'EofExpression',
          fileName,
          span: span(start.span.start, this.cursor.previous().span.end),
        };
      }
      case TokenKind.LParen: {
        this.cursor.advance();
        const expr = this.parseExpression();
        if (!expr) {
          pushError(this.diagnostics, 'Expected expression after "(".', token);
          return null;
        }
        if (!this.cursor.match(TokenKind.RParen)) {
          pushError(this.diagnostics, 'Expected ")" after expression.', this.cursor.peek());
        }
        return {
          kind: 'GroupingExpression',
          expression: expr,
          span: span(token.span.start, this.cursor.previous().span.end),
        };
      }
      default:
        pushError(this.diagnostics, 'Expected expression.', token);
        return null;
    }
  }

  parseIdentifier(): Identifier | null {
    const token = this.cursor.peek();
    if (token.kind !== TokenKind.Identifier) {
      pushError(this.diagnostics, 'Expected identifier.', token);
      return null;
    }
    this.cursor.advance();
    return { kind: 'Identifier', name: token.lexeme, span: token.span };
  }

  /** Assumes opening "(" already consumed. Consumes closing ")". */
  parseArgumentList(): Expression[] {
    if (this.cursor.match(TokenKind.RParen)) return [];

    const args: Expression[] = [];
    const first = this.parseExpression();
    if (!first) {
      pushError(this.diagnostics, 'Expected argument expression.', this.cursor.peek());
      this.cursor.match(TokenKind.RParen);
      return args;
    }
    args.push(first);

    while (this.cursor.match(TokenKind.Comma)) {
      if (this.cursor.check(TokenKind.RParen)) {
        pushError(
          this.diagnostics,
          'Trailing comma in argument list.',
          this.cursor.previous(),
          'E_TRAILING_COMMA',
        );
        break;
      }
      const next = this.parseExpression();
      if (!next) {
        pushError(this.diagnostics, 'Expected argument expression after ",".', this.cursor.peek());
        break;
      }
      args.push(next);
    }

    if (!this.cursor.match(TokenKind.RParen)) {
      pushError(this.diagnostics, 'Expected ")" after argument list.', this.cursor.peek());
    }
    return args;
  }

  /** Assumes opening "[" already consumed. Consumes closing "]". */
  parseIndexList(): Expression[] {
    const indices: Expression[] = [];
    const first = this.parseExpression();
    if (!first) {
      pushError(this.diagnostics, 'Expected array index expression.', this.cursor.peek());
      this.cursor.match(TokenKind.RBracket);
      return indices;
    }
    indices.push(first);

    while (this.cursor.match(TokenKind.Comma)) {
      if (this.cursor.check(TokenKind.RBracket)) {
        pushError(
          this.diagnostics,
          'Trailing comma in array index list.',
          this.cursor.previous(),
          'E_TRAILING_COMMA',
        );
        break;
      }
      const next = this.parseExpression();
      if (!next) {
        pushError(this.diagnostics, 'Expected array index after ",".', this.cursor.peek());
        break;
      }
      indices.push(next);
    }

    if (!this.cursor.match(TokenKind.RBracket)) {
      pushError(this.diagnostics, 'Expected "]" after array indices.', this.cursor.peek());
    }
    return indices;
  }

  /**
   * Parse an assignable location: Name or Name[i, …]
   * (Opening "[" is not yet consumed when called after reading the identifier.)
   */
  parseAssignTarget(): AssignTarget | null {
    const id = this.parseIdentifier();
    if (!id) return null;
    if (this.cursor.match(TokenKind.LBracket)) {
      const indices = this.parseIndexList();
      return {
        kind: 'IndexExpression',
        array: id,
        indices,
        span: span(id.span.start, this.cursor.previous().span.end),
      };
    }
    return id;
  }
}

const PREFIX_BP = 30;

type BindingPower = { readonly left: number; readonly right: number };

const INFIX_BP: Partial<Record<TokenKind, BindingPower>> = {
  [TokenKind.Or]: { left: 1, right: 2 },
  [TokenKind.And]: { left: 3, right: 4 },
  [TokenKind.Equal]: { left: 5, right: 6 },
  [TokenKind.NotEqual]: { left: 5, right: 6 },
  [TokenKind.Less]: { left: 5, right: 6 },
  [TokenKind.LessEqual]: { left: 5, right: 6 },
  [TokenKind.Greater]: { left: 5, right: 6 },
  [TokenKind.GreaterEqual]: { left: 5, right: 6 },
  [TokenKind.Plus]: { left: 10, right: 11 },
  [TokenKind.Minus]: { left: 10, right: 11 },
  [TokenKind.Star]: { left: 20, right: 21 },
  [TokenKind.Slash]: { left: 20, right: 21 },
  [TokenKind.Div]: { left: 20, right: 21 },
  [TokenKind.Mod]: { left: 20, right: 21 },
};

function infixBindingPower(kind: TokenKind): BindingPower | null {
  return INFIX_BP[kind] ?? null;
}

function binaryOperatorFromToken(token: Token): BinaryOperator | null {
  switch (token.kind) {
    case TokenKind.Plus:
      return '+';
    case TokenKind.Minus:
      return '-';
    case TokenKind.Star:
      return '*';
    case TokenKind.Slash:
      return '/';
    case TokenKind.Div:
      return 'DIV';
    case TokenKind.Mod:
      return 'MOD';
    case TokenKind.Equal:
      return '=';
    case TokenKind.NotEqual:
      return '<>';
    case TokenKind.Less:
      return '<';
    case TokenKind.LessEqual:
      return '<=';
    case TokenKind.Greater:
      return '>';
    case TokenKind.GreaterEqual:
      return '>=';
    case TokenKind.And:
      return 'AND';
    case TokenKind.Or:
      return 'OR';
    default:
      return null;
  }
}
