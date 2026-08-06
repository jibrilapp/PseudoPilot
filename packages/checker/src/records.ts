/**
 * TYPE registration for records, enums, pointers, and sets.
 */

import type {
  EnumTypeDeclaration,
  PointerTypeDeclaration,
  Program,
  SetTypeDeclaration,
  SimpleType,
  TypeDeclaration,
  TypeReference,
} from '@pseudopilot/language-core';
import { identKey, makeSymbol } from './scope.js';
import {
  enumType,
  errorType,
  lookupRecordField,
  pointerType,
  recordType,
  resolveSimpleType,
  resolveTypeRef,
  setType,
  type TypeTable,
} from './type-system.js';
import type {
  CheckerDiagnostic,
  PpType,
  RecordFieldInfo,
  SymbolInfo,
} from './types.js';

export type RecordCheckHost = {
  readonly typeTable: Map<string, PpType>;
  diag(partial: {
    code: string;
    message: string;
    span: CheckerDiagnostic['span'];
    help?: string;
  }): void;
  /** TYPE names — participate in the global scope (collide with variables). */
  defineSymbol(symbol: ReturnType<typeof makeSymbol>): boolean;
  /**
   * Field symbols for the language service only.
   * Must NOT enter the global Scope — fields are namespaced by their TYPE
   * (`Student.Name` ≠ `Teacher.Name`).
   */
  recordFieldSymbol(symbol: SymbolInfo): void;
};

type UserTypeDecl =
  | TypeDeclaration
  | EnumTypeDeclaration
  | PointerTypeDeclaration
  | SetTypeDeclaration;

/**
 * Pass 0: register all TYPE forms into the type table and symbol list.
 * Supports forward references between user types; rejects recursive *records*
 * that contain themselves directly (pointer fields to a record are allowed).
 */
export function registerTypeDeclarations(
  host: RecordCheckHost,
  program: Program,
): void {
  const decls: UserTypeDecl[] = [];
  for (const stmt of program.body) {
    if (
      stmt.kind === 'TypeDeclaration' ||
      stmt.kind === 'EnumTypeDeclaration' ||
      stmt.kind === 'PointerTypeDeclaration' ||
      stmt.kind === 'SetTypeDeclaration'
    ) {
      decls.push(stmt);
    }
  }

  /** Decls that successfully reserved a TYPE table key (first wins). */
  const accepted: UserTypeDecl[] = [];

  // Pass 0a — reserve names with placeholders (forward refs).
  for (const decl of decls) {
    const key = identKey(decl.name.name);
    const existing = host.typeTable.get(key);
    if (existing) {
      // CLASS and TYPE share one case-insensitive namespace; a name already
      // taken by a CLASS is reported as C_DUP_CLASS, not C_DUP_TYPE.
      const code = existing.kind === 'class' ? 'C_DUP_CLASS' : 'C_DUP_TYPE';
      host.diag({
        code,
        message:
          existing.kind === 'class'
            ? `TYPE '${decl.name.name}' collides with an existing CLASS of the same name.`
            : `Duplicate TYPE '${decl.name.name}'.`,
        span: decl.name.span,
        help: 'TYPE and CLASS names are case-insensitive.',
      });
      continue;
    }
    host.typeTable.set(key, placeholderFor(decl));
    accepted.push(decl);
  }

  // Pass 0b — bind bodies (fields / members / targets / elements).
  for (const decl of accepted) {
    const key = identKey(decl.name.name);
    if (decl.kind === 'TypeDeclaration') {
      const fields = bindRecordFields(host, decl);
      host.typeTable.set(key, recordType(decl.name.name, fields));
    } else if (decl.kind === 'EnumTypeDeclaration') {
      host.typeTable.set(
        key,
        enumType(
          decl.name.name,
          decl.members.map((m) => m.name),
        ),
      );
    } else if (decl.kind === 'PointerTypeDeclaration') {
      host.typeTable.set(
        key,
        pointerType(decl.name.name, resolveSimpleTypeRef(host, decl.targetType)),
      );
    } else {
      host.typeTable.set(
        key,
        setType(decl.name.name, resolveSimpleTypeRef(host, decl.elementType)),
      );
    }
  }

  const cyclic = findRecursiveTypeKeys(host.typeTable);
  for (const key of cyclic) {
    const t = host.typeTable.get(key);
    if (!t || t.kind !== 'record') continue;
    host.diag({
      code: 'C_RECURSIVE_TYPE',
      message: `Recursive TYPE '${t.name}' is not allowed (a record cannot contain itself directly or via arrays).`,
      span: t.fields[0]?.span ?? {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 0, line: 1, column: 1 },
      },
      help:
        'Use a pointer TYPE (TYPE P = ^Record) for self-referential structures; direct or array containment is forbidden.',
    });
    host.typeTable.set(key, errorType());
  }

  // Fixed-point rebind so forward-ref chains (A→B→C) resolve to final entries.
  rebindTypeTableFixedPoint(host.typeTable);

  for (const decl of accepted) {
    const key = identKey(decl.name.name);
    const complete = host.typeTable.get(key);
    if (!complete || complete.kind === 'error') continue;

    if (decl.kind === 'TypeDeclaration' && complete.kind === 'record') {
      host.defineSymbol(
        makeSymbol(decl.name.name, 'type', complete, decl.name.span, {
          containerName: 'global',
        }),
      );
      for (const field of complete.fields) {
        host.recordFieldSymbol(
          makeSymbol(field.name, 'field', field.type, field.span, {
            containerName: decl.name.name,
          }),
        );
      }
      continue;
    }

    if (
      complete.kind === 'enum' ||
      complete.kind === 'pointer' ||
      complete.kind === 'set'
    ) {
      host.defineSymbol(
        makeSymbol(decl.name.name, 'type', complete, decl.name.span, {
          containerName: 'global',
        }),
      );
    }

    if (decl.kind === 'EnumTypeDeclaration' && complete.kind === 'enum') {
      const seen = new Set<string>();
      for (const member of decl.members) {
        const mkey = identKey(member.name);
        if (seen.has(mkey)) {
          host.diag({
            code: 'C_DUP_CONSTANT',
            message: `Duplicate enum member '${member.name}' in TYPE '${decl.name.name}'.`,
            span: member.span,
            help: 'Enum member names are case-insensitive.',
          });
          continue;
        }
        seen.add(mkey);
        host.defineSymbol(
          makeSymbol(member.name, 'constant', complete, member.span, {
            containerName: 'global',
          }),
        );
      }
    }
  }
}

function placeholderFor(decl: UserTypeDecl): PpType {
  switch (decl.kind) {
    case 'TypeDeclaration':
      return recordType(decl.name.name, []);
    case 'EnumTypeDeclaration':
      return enumType(decl.name.name, []);
    case 'PointerTypeDeclaration':
      return pointerType(decl.name.name, errorType());
    case 'SetTypeDeclaration':
      return setType(decl.name.name, errorType());
  }
}

function bindRecordFields(
  host: RecordCheckHost,
  decl: TypeDeclaration,
): RecordFieldInfo[] {
  const fields: RecordFieldInfo[] = [];
  const seen = new Set<string>();

  for (const fieldDecl of decl.fields) {
    for (const id of fieldDecl.names) {
      const fkey = identKey(id.name);
      if (seen.has(fkey)) {
        host.diag({
          code: 'C_DUP_FIELD',
          message: `Duplicate field '${id.name}' in TYPE '${decl.name.name}'.`,
          span: id.span,
          help: 'Field names are case-insensitive.',
        });
        continue;
      }
      seen.add(fkey);
      fields.push({
        name: id.name,
        type: resolveFieldType(host, fieldDecl.typeRef),
        span: id.span,
      });
    }
  }

  return fields;
}

function resolveSimpleTypeRef(host: RecordCheckHost, t: SimpleType): PpType {
  if (t.kind === 'NamedType') {
    const key = identKey(t.name);
    if (!host.typeTable.has(key)) {
      host.diag({
        code: 'C_UNKNOWN_TYPE',
        message: `Unknown TYPE '${t.name}'.`,
        span: t.span,
        help: 'Declare the TYPE before using it as a pointer/set target.',
      });
      return errorType();
    }
  }
  return resolveSimpleType(t, host.typeTable);
}

function resolveFieldType(
  host: RecordCheckHost,
  typeRef: TypeReference,
): PpType {
  if (typeRef.kind === 'NamedType') {
    const key = identKey(typeRef.name);
    if (!host.typeTable.has(key)) {
      host.diag({
        code: 'C_UNKNOWN_TYPE',
        message: `Unknown TYPE '${typeRef.name}'.`,
        span: typeRef.span,
        help: 'Declare the TYPE … ENDTYPE before using it as a field type.',
      });
      return errorType();
    }
  }
  if (typeRef.kind === 'ArrayType' && typeRef.elementType.kind === 'NamedType') {
    const key = identKey(typeRef.elementType.name);
    if (!host.typeTable.has(key)) {
      host.diag({
        code: 'C_UNKNOWN_TYPE',
        message: `Unknown TYPE '${typeRef.elementType.name}'.`,
        span: typeRef.elementType.span,
      });
      return {
        kind: 'array',
        element: errorType(),
        dimensions: typeRef.dimensions.length,
      };
    }
  }
  return resolveTypeRef(typeRef, host.typeTable);
}

function findRecursiveTypeKeys(typeTable: TypeTable): Set<string> {
  const edges = new Map<string, Set<string>>();
  for (const [key, t] of typeTable) {
    edges.set(key, new Set());
    if (t.kind !== 'record') continue;
    for (const f of t.fields) addTypeEdges(f.type, edges.get(key)!);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cyclic = new Set<string>();

  function dfs(node: string): boolean {
    if (cyclic.has(node)) return true;
    if (visited.has(node)) return false;
    if (visiting.has(node)) {
      cyclic.add(node);
      return true;
    }
    visiting.add(node);
    let hit = false;
    for (const next of edges.get(node) ?? []) {
      if (dfs(next)) hit = true;
    }
    visiting.delete(node);
    visited.add(node);
    if (hit) cyclic.add(node);
    return hit;
  }

  for (const key of edges.keys()) dfs(key);
  return cyclic;
}

/**
 * Record containment edges only. Pointer targets do not create edges — so
 * `TYPE P = ^Node` + `TYPE Node` with a `P` field is not recursive.
 */
function addTypeEdges(t: PpType, out: Set<string>): void {
  if (t.kind === 'record') out.add(identKey(t.name));
  else if (t.kind === 'array') addTypeEdges(t.element, out);
}

function rebindType(t: PpType, table: TypeTable): PpType {
  if (t.kind === 'record' || t.kind === 'enum' || t.kind === 'set') {
    return table.get(identKey(t.name)) ?? t;
  }
  if (t.kind === 'pointer') {
    const named = t.name !== '' ? table.get(identKey(t.name)) : undefined;
    if (named && named.kind === 'pointer') return named;
    return {
      kind: 'pointer',
      name: t.name,
      target: rebindType(t.target, table),
    };
  }
  if (t.kind === 'array') {
    return {
      kind: 'array',
      dimensions: t.dimensions,
      element: rebindType(t.element, table),
      ...(t.bounds ? { bounds: t.bounds } : {}),
    };
  }
  return t;
}

/** Iterate until nested record/pointer refs point at the latest table entries. */
function rebindTypeTableFixedPoint(typeTable: Map<string, PpType>): void {
  const maxPasses = Math.max(2, typeTable.size + 2);
  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;
    for (const [key, entry] of [...typeTable.entries()]) {
      if (entry.kind === 'record') {
        const current: Extract<PpType, { kind: 'record' }> = entry;
        const fields = current.fields.map((f) => ({
          name: f.name,
          span: f.span,
          type: rebindType(f.type, typeTable),
        }));
        const next: Extract<PpType, { kind: 'record' }> = {
          kind: 'record',
          name: current.name,
          fields,
        };
        if (!recordFieldsSameRef(current, next)) {
          typeTable.set(key, next);
          changed = true;
        }
      } else if (entry.kind === 'pointer') {
        const nextTarget = rebindType(entry.target, typeTable);
        if (nextTarget !== entry.target) {
          typeTable.set(key, pointerType(entry.name, nextTarget));
          changed = true;
        }
      } else if (entry.kind === 'set') {
        const nextElement = rebindType(entry.element, typeTable);
        if (nextElement !== entry.element) {
          typeTable.set(key, setType(entry.name, nextElement));
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
}

function recordFieldsSameRef(
  a: Extract<PpType, { kind: 'record' }>,
  b: Extract<PpType, { kind: 'record' }>,
): boolean {
  if (a.fields.length !== b.fields.length) return false;
  for (let i = 0; i < a.fields.length; i++) {
    if (a.fields[i]!.type !== b.fields[i]!.type) return false;
  }
  return true;
}

export function resolveUserTypeRef(
  typeRef: TypeReference,
  typeTable: TypeTable,
  diag: RecordCheckHost['diag'],
): PpType {
  if (typeRef.kind === 'NamedType') {
    const key = identKey(typeRef.name);
    if (!typeTable.has(key)) {
      diag({
        code: 'C_UNKNOWN_TYPE',
        message: `Unknown TYPE '${typeRef.name}'.`,
        span: typeRef.span,
        help: 'Declare TYPE … ENDTYPE before using this name.',
      });
      return errorType();
    }
  }
  if (typeRef.kind === 'ArrayType' && typeRef.elementType.kind === 'NamedType') {
    const key = identKey(typeRef.elementType.name);
    if (!typeTable.has(key)) {
      diag({
        code: 'C_UNKNOWN_TYPE',
        message: `Unknown TYPE '${typeRef.elementType.name}'.`,
        span: typeRef.elementType.span,
      });
      return {
        kind: 'array',
        element: errorType(),
        dimensions: typeRef.dimensions.length,
      };
    }
  }
  return resolveTypeRef(typeRef, typeTable);
}

export { lookupRecordField };
