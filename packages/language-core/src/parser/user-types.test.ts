import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import type {
  DefineStatement,
  EnumTypeDeclaration,
  ForStatement,
  PointerTypeDeclaration,
  SetTypeDeclaration,
} from '../ast/nodes.js';

function parseOk(source: string) {
  const result = parse(source);
  expect(result.ok, JSON.stringify(result.diagnostics, null, 2)).toBe(true);
  return result.ast;
}

describe('enum / pointer / SET TYPE parser', () => {
  it('parses enumerated TYPE', () => {
    const ast = parseOk('TYPE Season = (Spring, Summer, Autumn, Winter)\n');
    const decl = ast.body[0] as EnumTypeDeclaration;
    expect(decl.kind).toBe('EnumTypeDeclaration');
    expect(decl.name.name).toBe('Season');
    expect(decl.members.map((m) => m.name)).toEqual([
      'Spring',
      'Summer',
      'Autumn',
      'Winter',
    ]);
  });

  it('parses pointer TYPE', () => {
    const ast = parseOk('TYPE TIntPointer = ^INTEGER\n');
    const decl = ast.body[0] as PointerTypeDeclaration;
    expect(decl.kind).toBe('PointerTypeDeclaration');
    expect(decl.name.name).toBe('TIntPointer');
    expect(decl.targetType.kind).toBe('TypeName');
    if (decl.targetType.kind === 'TypeName') {
      expect(decl.targetType.name).toBe('INTEGER');
    }
  });

  it('parses SET TYPE and DEFINE', () => {
    const ast = parseOk(`
TYPE LetterSet = SET OF CHAR
DEFINE Vowels ('A','E','I','O','U'): LetterSet
`);
    const setDecl = ast.body[0] as SetTypeDeclaration;
    expect(setDecl.kind).toBe('SetTypeDeclaration');
    expect(setDecl.name.name).toBe('LetterSet');
    const define = ast.body[1] as DefineStatement;
    expect(define.kind).toBe('DefineStatement');
    expect(define.name.name).toBe('Vowels');
    expect(define.values).toHaveLength(5);
    expect(define.typeName.name).toBe('LetterSet');
  });

  it('parses address-of and dereference', () => {
    const ast = parseOk(`
TYPE TIntPointer = ^INTEGER
DECLARE X : INTEGER
DECLARE P : TIntPointer
P ← ^X
P^ ← 5
X ← P^
`);
    const assigns = ast.body.filter((s) => s.kind === 'AssignmentStatement');
    expect(assigns).toHaveLength(3);
    expect(assigns[0]?.kind === 'AssignmentStatement' && assigns[0].value.kind).toBe(
      'AddressOfExpression',
    );
    expect(assigns[1]?.kind === 'AssignmentStatement' && assigns[1].target.kind).toBe(
      'DerefExpression',
    );
    expect(assigns[2]?.kind === 'AssignmentStatement' && assigns[2].value.kind).toBe(
      'DerefExpression',
    );
  });

  it('parses bare NEXT (Cambridge-legal)', () => {
    const ast = parseOk(`
FOR I ← 1 TO 3
    OUTPUT I
NEXT
`);
    const stmt = ast.body[0] as ForStatement;
    expect(stmt.kind).toBe('ForStatement');
    expect(stmt.nextVariable).toBeNull();
  });

  it('still records NEXT identifier when present', () => {
    const ast = parseOk(`
FOR I ← 1 TO 3
    OUTPUT I
NEXT I
`);
    const stmt = ast.body[0] as ForStatement;
    expect(stmt.nextVariable).toBe('I');
  });

  it('rejects unknown TYPE = form', () => {
    const result = parse('TYPE Colour = ARRAY\n');
    expect(result.diagnostics.some((d) => d.code === 'E_UNSUPPORTED_TYPE_FORM')).toBe(
      true,
    );
  });
});
