/**
 * CLASS … ENDCLASS registration and member helpers for the semantic checker.
 * Mirrors the two-pass forward-reference pattern used by `records.ts`; CLASS
 * and TYPE names share one case-insensitive `typeTable`.
 */

import type {
  ClassDeclaration,
  ClassMember,
  Parameter,
  Program,
} from '@pseudopilot/language-core';
import { identKey } from './scope.js';
import {
  classType,
  errorType,
  typesEqual,
  type TypeTable,
} from './type-system.js';
import { resolveUserTypeRef } from './records.js';
import type {
  CheckerDiagnostic,
  ClassFieldInfo,
  ClassMethodInfo,
  PpType,
  SymbolInfo,
} from './types.js';

type ClassPpType = Extract<PpType, { kind: 'class' }>;

export type ClassCheckHost = {
  readonly typeTable: Map<string, PpType>;
  diag(partial: {
    severity?: CheckerDiagnostic['severity'];
    code: string;
    message: string;
    span: CheckerDiagnostic['span'];
    help?: string;
  }): void;
  /** CLASS names — participate in the global scope (collide with variables / TYPE / PROCEDURE …). */
  defineSymbol(symbol: SymbolInfo): boolean;
  /**
   * Field symbols for the language service only.
   * Must NOT enter the global Scope — fields are namespaced by their CLASS.
   */
  recordFieldSymbol(symbol: SymbolInfo): void;
  /** Method symbols for the language service only (same reasoning as fields). */
  classMethodSymbol(symbol: SymbolInfo): void;
};

/**
 * Pass 0/1: register all CLASS declarations into the (shared) type table and
 * symbol list. Supports forward references between classes (INHERITS a class
 * declared later in the file); rejects cyclic inheritance.
 */
export function registerClassDeclarations(
  host: ClassCheckHost,
  program: Program,
): void {
  const decls: ClassDeclaration[] = [];
  for (const stmt of program.body) {
    if (stmt.kind === 'ClassDeclaration') decls.push(stmt);
  }

  const accepted: ClassDeclaration[] = [];

  // Pass 0 — reserve a table slot per CLASS (placeholder, no members yet).
  for (const decl of decls) {
    const key = identKey(decl.name.name);
    const existing = host.typeTable.get(key);
    if (existing) {
      const code = existing.kind === 'class' ? 'C_DUP_CLASS' : 'C_DUP_TYPE';
      host.diag({
        code,
        message:
          existing.kind === 'class'
            ? `Duplicate CLASS '${decl.name.name}'.`
            : `CLASS '${decl.name.name}' collides with an existing TYPE of the same name.`,
        span: decl.name.span,
        help: 'CLASS and TYPE names share one namespace and are case-insensitive.',
      });
      continue;
    }
    host.typeTable.set(
      key,
      classType(decl.name.name, decl.inherits ? decl.inherits.name : null, [], []),
    );
    accepted.push(decl);
  }

  // Pass 0.5 — validate INHERITS targets exist and are CLASS (not TYPE).
  for (const decl of accepted) {
    if (!decl.inherits) continue;
    const key = identKey(decl.name.name);
    const parentKey = identKey(decl.inherits.name);
    const parent = host.typeTable.get(parentKey);
    if (!parent) {
      host.diag({
        code: 'C_UNKNOWN_CLASS',
        message: `Unknown CLASS '${decl.inherits.name}' in INHERITS clause.`,
        span: decl.inherits.span,
        help: 'Declare the parent CLASS … ENDCLASS before using it in INHERITS.',
      });
      clearInherits(host, key, decl.name.name);
      continue;
    }
    if (parent.kind !== 'class') {
      host.diag({
        code: 'C_INVALID_INHERITS',
        message: `'${decl.inherits.name}' is a TYPE, not a CLASS; INHERITS requires another CLASS.`,
        span: decl.inherits.span,
      });
      clearInherits(host, key, decl.name.name);
    }
  }

  // Detect cyclic inheritance (direct or transitive) and break the cycle so
  // later passes (field binding, method lookup) cannot loop forever.
  for (const decl of accepted) {
    const key = identKey(decl.name.name);
    const entry = host.typeTable.get(key);
    if (!entry || entry.kind !== 'class' || entry.inherits === null) continue;
    if (isInInheritanceCycle(key, host.typeTable)) {
      host.diag({
        code: 'C_CYCLIC_INHERITANCE',
        message: `CLASS '${decl.name.name}' has cyclic INHERITANCE.`,
        span: decl.inherits?.span ?? decl.name.span,
        help: 'A CLASS cannot inherit from itself, directly or indirectly.',
      });
      clearInherits(host, key, decl.name.name);
    }
  }

  // Pass 1 — bind own fields and methods now that every CLASS name (and its
  // validated, acyclic parent link) is known.
  for (const decl of accepted) {
    const key = identKey(decl.name.name);
    const placeholder = host.typeTable.get(key);
    if (!placeholder || placeholder.kind !== 'class') continue;
    const { fields, methods } = bindClassMembers(host, decl);
    host.typeTable.set(
      key,
      classType(decl.name.name, placeholder.inherits, fields, methods),
    );
  }

  // Fixed-point rebind so forward-ref chains between CLASSes (and CLASS →
  // TYPE) point at the latest, fully-bound table entries.
  rebindClassTableFixedPoint(host.typeTable);

  // Publish symbols for the language service + global-scope collision checks.
  for (const decl of accepted) {
    const key = identKey(decl.name.name);
    const complete = host.typeTable.get(key);
    if (!complete || complete.kind !== 'class') continue;

    host.defineSymbol({
      name: decl.name.name,
      kind: 'class',
      type: complete,
      span: decl.name.span,
      containerName: 'global',
    });
    for (const field of complete.fields) {
      host.recordFieldSymbol({
        name: field.name,
        kind: 'field',
        type: field.type,
        span: field.span,
        containerName: decl.name.name,
      });
    }
    for (const method of complete.methods) {
      host.classMethodSymbol({
        name: method.name,
        kind: 'method',
        type:
          method.kind === 'function'
            ? { kind: 'function', params: method.params, returns: method.returns ?? errorType() }
            : { kind: 'procedure', params: method.params },
        span: method.span,
        containerName: decl.name.name,
      });
    }
  }

  // Best-effort override consistency check (warning only).
  for (const decl of accepted) {
    checkOverrides(host, decl);
  }
}

function clearInherits(host: ClassCheckHost, key: string, name: string): void {
  const entry = host.typeTable.get(key);
  if (!entry || entry.kind !== 'class') return;
  host.typeTable.set(key, classType(name, null, entry.fields, entry.methods));
}

/** True when walking `key`'s parent chain revisits a class already seen. */
function isInInheritanceCycle(key: string, typeTable: TypeTable): boolean {
  const seen = new Set<string>([key]);
  let current = typeTable.get(key);
  while (current && current.kind === 'class' && current.inherits !== null) {
    const parentKey = identKey(current.inherits);
    if (seen.has(parentKey)) return true;
    seen.add(parentKey);
    current = typeTable.get(parentKey);
  }
  return false;
}

function bindClassMembers(
  host: ClassCheckHost,
  decl: ClassDeclaration,
): { fields: ClassFieldInfo[]; methods: ClassMethodInfo[] } {
  const fields: ClassFieldInfo[] = [];
  const methods: ClassMethodInfo[] = [];
  const seenFields = new Set<string>();
  const seenMethods = new Set<string>();

  for (const member of decl.members) {
    bindMember(host, decl, member, fields, methods, seenFields, seenMethods);
  }

  return { fields, methods };
}

function bindMember(
  host: ClassCheckHost,
  decl: ClassDeclaration,
  member: ClassMember,
  fields: ClassFieldInfo[],
  methods: ClassMethodInfo[],
  seenFields: Set<string>,
  seenMethods: Set<string>,
): void {
  const visibility = member.visibility ?? 'PUBLIC';

  if (member.kind === 'ClassPropertyDeclaration') {
    for (const id of member.names) {
      const fkey = identKey(id.name);
      if (seenFields.has(fkey)) {
        host.diag({
          code: 'C_DUP_MEMBER',
          message: `Duplicate property '${id.name}' in CLASS '${decl.name.name}'.`,
          span: id.span,
          help: 'Property names are case-insensitive.',
        });
        continue;
      }
      seenFields.add(fkey);
      fields.push({
        name: id.name,
        type: resolveUserTypeRef(member.typeRef, host.typeTable, host.diag),
        visibility,
        span: id.span,
      });
    }
    return;
  }

  // ClassProcedureDeclaration | ClassFunctionDeclaration
  const mkey = identKey(member.name.name);
  if (seenMethods.has(mkey)) {
    host.diag({
      code: 'C_DUP_METHOD',
      message: `Duplicate method '${member.name.name}' in CLASS '${decl.name.name}'.`,
      span: member.name.span,
      help: 'Method names are case-insensitive.',
    });
    return;
  }
  seenMethods.add(mkey);

  const params = member.parameters.map((p: Parameter) =>
    resolveUserTypeRef(p.typeName, host.typeTable, host.diag),
  );
  const isConstructor = mkey === 'new';
  const kind = member.kind === 'ClassFunctionDeclaration' ? 'function' : 'procedure';
  const returns =
    member.kind === 'ClassFunctionDeclaration'
      ? resolveUserTypeRef(member.returnType, host.typeTable, host.diag)
      : null;

  methods.push({
    name: member.name.name,
    kind,
    visibility,
    params,
    returns,
    span: member.name.span,
    isConstructor,
  });
}

function rebindTypeRefDeep(t: PpType, table: TypeTable): PpType {
  if (t.kind === 'record' || t.kind === 'class') {
    return table.get(identKey(t.name)) ?? t;
  }
  if (t.kind === 'array') {
    return {
      kind: 'array',
      dimensions: t.dimensions,
      element: rebindTypeRefDeep(t.element, table),
    };
  }
  return t;
}

/** Iterate until nested class/record refs point at the latest table entries. */
function rebindClassTableFixedPoint(typeTable: Map<string, PpType>): void {
  const maxPasses = Math.max(2, typeTable.size + 2);
  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;
    for (const [key, entry] of [...typeTable.entries()]) {
      if (entry.kind !== 'class') continue;
      const current: ClassPpType = entry;
      const fields = current.fields.map((f) => ({
        ...f,
        type: rebindTypeRefDeep(f.type, typeTable),
      }));
      const methods = current.methods.map((m) => ({
        ...m,
        params: m.params.map((p) => rebindTypeRefDeep(p, typeTable)),
        returns: m.returns ? rebindTypeRefDeep(m.returns, typeTable) : null,
      }));
      const next: ClassPpType = {
        kind: 'class',
        name: current.name,
        inherits: current.inherits,
        fields,
        methods,
      };
      if (!classMembersSameRef(current, next)) {
        typeTable.set(key, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
}

function classMembersSameRef(a: ClassPpType, b: ClassPpType): boolean {
  if (a.fields.length !== b.fields.length) return false;
  for (let i = 0; i < a.fields.length; i++) {
    if (a.fields[i]!.type !== b.fields[i]!.type) return false;
  }
  if (a.methods.length !== b.methods.length) return false;
  for (let i = 0; i < a.methods.length; i++) {
    const am = a.methods[i]!;
    const bm = b.methods[i]!;
    if (am.returns !== bm.returns) return false;
    if (am.params.length !== bm.params.length) return false;
    for (let j = 0; j < am.params.length; j++) {
      if (am.params[j] !== bm.params[j]) return false;
    }
  }
  return true;
}

/**
 * Best-effort override check: a method re-declared in a subclass should keep
 * the same kind (PROCEDURE/FUNCTION), arity, and return type as the parent's
 * method of the same name. Constructors (NEW) are exempt — each class defines
 * its own. Warning-severity; does not fail the check on its own.
 */
function checkOverrides(host: ClassCheckHost, decl: ClassDeclaration): void {
  const key = identKey(decl.name.name);
  const cls = host.typeTable.get(key);
  if (!cls || cls.kind !== 'class' || cls.inherits === null) return;
  const parent = host.typeTable.get(identKey(cls.inherits));
  if (!parent || parent.kind !== 'class') return;

  for (const m of cls.methods) {
    if (m.isConstructor) continue;
    const parentMethod = lookupClassMethod(parent, m.name, host.typeTable);
    if (!parentMethod) continue;
    const arityMismatch = parentMethod.params.length !== m.params.length;
    const kindMismatch = parentMethod.kind !== m.kind;
    const returnMismatch =
      !kindMismatch &&
      m.kind === 'function' &&
      parentMethod.returns !== null &&
      m.returns !== null &&
      !typesEqual(parentMethod.returns, m.returns);
    if (arityMismatch || kindMismatch || returnMismatch) {
      host.diag({
        severity: 'warning',
        code: 'C_OVERRIDE_MISMATCH',
        message: `Method '${m.name}' in CLASS '${cls.name}' overrides '${parent.name}.${m.name}' with a different signature.`,
        span: m.span,
        help: 'Match the parameter count and return type of the parent method.',
      });
    }
  }
}

/** Depth guard against pathological/undetected cycles in lookup helpers. */
const MAX_INHERITANCE_DEPTH = 64;

/**
 * Walk inheritance to find `fieldName` (own fields first, then ancestors),
 * also reporting which CLASS actually declares it — needed to check PRIVATE
 * access against the *defining* class, not the static type of the object.
 */
export function findClassFieldOwner(
  cls: ClassPpType,
  fieldName: string,
  typeTable: TypeTable,
  depth = 0,
): { readonly field: ClassFieldInfo; readonly owner: string } | undefined {
  const key = identKey(fieldName);
  const own = cls.fields.find((f) => identKey(f.name) === key);
  if (own) return { field: own, owner: cls.name };
  if (cls.inherits === null || depth >= MAX_INHERITANCE_DEPTH) return undefined;
  const parent = typeTable.get(identKey(cls.inherits));
  if (!parent || parent.kind !== 'class') return undefined;
  return findClassFieldOwner(parent, fieldName, typeTable, depth + 1);
}

/** Walk inheritance to find `methodName` — child overrides win. Reports the owning CLASS. */
export function findClassMethodOwner(
  cls: ClassPpType,
  methodName: string,
  typeTable: TypeTable,
  depth = 0,
): { readonly method: ClassMethodInfo; readonly owner: string } | undefined {
  const key = identKey(methodName);
  const own = cls.methods.find((m) => identKey(m.name) === key);
  if (own) return { method: own, owner: cls.name };
  if (cls.inherits === null || depth >= MAX_INHERITANCE_DEPTH) return undefined;
  const parent = typeTable.get(identKey(cls.inherits));
  if (!parent || parent.kind !== 'class') return undefined;
  return findClassMethodOwner(parent, methodName, typeTable, depth + 1);
}

/** Walk inheritance to find `fieldName` (own fields first, then ancestors). */
export function lookupClassField(
  cls: ClassPpType,
  fieldName: string,
  typeTable: TypeTable,
): ClassFieldInfo | undefined {
  return findClassFieldOwner(cls, fieldName, typeTable)?.field;
}

/** Walk inheritance to find `methodName` — child overrides win. */
export function lookupClassMethod(
  cls: ClassPpType,
  methodName: string,
  typeTable: TypeTable,
): ClassMethodInfo | undefined {
  return findClassMethodOwner(cls, methodName, typeTable)?.method;
}

/** All fields inherited from ancestors (root-first), excluding `cls`'s own fields. */
export function collectInheritedFields(
  cls: ClassPpType,
  typeTable: TypeTable,
  depth = 0,
): readonly ClassFieldInfo[] {
  if (cls.inherits === null || depth >= MAX_INHERITANCE_DEPTH) return [];
  const parent = typeTable.get(identKey(cls.inherits));
  if (!parent || parent.kind !== 'class') return [];
  return [...collectInheritedFields(parent, typeTable, depth + 1), ...parent.fields];
}

/**
 * PUBLIC members are always accessible. PRIVATE members are only accessible
 * from code whose `currentClass` is exactly `definingClass` (case-insensitive)
 * — subclasses do NOT get access to a parent's PRIVATE members.
 */
export function isAccessible(
  visibility: 'PUBLIC' | 'PRIVATE',
  definingClass: string,
  currentClass: string | null,
): boolean {
  if (visibility === 'PUBLIC') return true;
  if (currentClass === null) return false;
  return identKey(definingClass) === identKey(currentClass);
}
