/**
 * TYPE … ENDTYPE registration and field helpers for the semantic checker.
 */

import type {
  Program,
  TypeDeclaration,
  TypeReference,
} from '@pseudopilot/language-core';
import { identKey, makeSymbol } from './scope.js';
import {
  errorType,
  lookupRecordField,
  recordType,
  resolveTypeRef,
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

/**
 * Pass 0: register all TYPE declarations into the type table and symbol list.
 * Supports forward references between record types; rejects recursive types.
 */
export function registerTypeDeclarations(
  host: RecordCheckHost,
  program: Program,
): void {
  const decls: TypeDeclaration[] = [];
  for (const stmt of program.body) {
    if (stmt.kind === 'TypeDeclaration') decls.push(stmt);
  }

  /** Decls that successfully reserved a TYPE table key (first wins). */
  const accepted: TypeDeclaration[] = [];

  for (const decl of decls) {
    const key = identKey(decl.name.name);
    if (host.typeTable.has(key)) {
      host.diag({
        code: 'C_DUP_TYPE',
        message: `Duplicate TYPE '${decl.name.name}'.`,
        span: decl.name.span,
        help: 'TYPE names are case-insensitive.',
      });
      continue;
    }
    host.typeTable.set(key, recordType(decl.name.name, []));
    accepted.push(decl);
  }

  for (const decl of accepted) {
    const key = identKey(decl.name.name);
    const fields = bindRecordFields(host, decl);
    host.typeTable.set(key, recordType(decl.name.name, fields));
  }

  const cyclic = findRecursiveTypeKeys(host.typeTable);
  for (const key of cyclic) {
    const t = host.typeTable.get(key);
    if (!t || t.kind !== 'record') continue;
    host.diag({
      code: 'C_RECURSIVE_TYPE',
      message: `Recursive TYPE '${t.name}' is not allowed (use pointers in a later milestone).`,
      span: t.fields[0]?.span ?? {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 0, line: 1, column: 1 },
      },
      help: 'Cambridge record types cannot contain themselves directly or indirectly.',
    });
    host.typeTable.set(key, errorType());
  }

  // Fixed-point rebind so forward-ref chains (A→B→C) resolve to final records.
  rebindTypeTableFixedPoint(host.typeTable);

  for (const decl of accepted) {
    const key = identKey(decl.name.name);
    const complete = host.typeTable.get(key);
    if (!complete || complete.kind !== 'record') continue;

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

function addTypeEdges(t: PpType, out: Set<string>): void {
  if (t.kind === 'record') out.add(identKey(t.name));
  else if (t.kind === 'array') addTypeEdges(t.element, out);
}

function rebindType(t: PpType, table: TypeTable): PpType {
  if (t.kind === 'record') {
    return table.get(identKey(t.name)) ?? t;
  }
  if (t.kind === 'array') {
    return {
      kind: 'array',
      dimensions: t.dimensions,
      element: rebindType(t.element, table),
    };
  }
  return t;
}

/** Iterate until nested record refs point at the latest table entries. */
function rebindTypeTableFixedPoint(typeTable: Map<string, PpType>): void {
  const maxPasses = Math.max(2, typeTable.size + 2);
  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;
    for (const [key, entry] of [...typeTable.entries()]) {
      if (entry.kind !== 'record') continue;
      // Local copy avoids TS invalidating narrowing when typeTable is mutated.
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
