/**
 * Build a compact AST outline for AIContext — kinds + lines only.
 * Does not expose full AST node objects to the model.
 */

export type AstLike = {
  readonly kind: string;
  readonly span?: { readonly start: { readonly line: number } };
  readonly body?: readonly AstLike[];
  readonly names?: readonly { readonly name: string }[];
  readonly members?: readonly ({ readonly name?: string } | string | AstLike)[];
  readonly name?: { readonly name: string } | string;
  readonly type?: { readonly kind?: string; readonly name?: string };
  readonly targetType?: { readonly kind?: string; readonly name?: string };
  readonly elementType?: { readonly kind?: string; readonly name?: string };
  readonly thenBranch?: readonly AstLike[];
  readonly elseBranch?: readonly AstLike[];
  readonly elseIfs?: readonly { readonly thenBranch?: readonly AstLike[] }[];
  readonly arms?: readonly { readonly body?: readonly AstLike[] }[];
};

export type AstSummaryItem = {
  readonly kind: string;
  readonly line?: number;
  readonly detail?: string;
};

export function summariseAst(
  program: AstLike | null | undefined,
  maxNodes = 80,
): AstSummaryItem[] {
  if (!program || program.kind !== 'Program') return [];
  const out: AstSummaryItem[] = [];

  const walk = (node: AstLike | undefined | null): void => {
    if (!node || out.length >= maxNodes) return;
    const line = node.span?.start.line;
    const detail = detailFor(node);
    out.push({
      kind: node.kind,
      ...(line != null ? { line } : {}),
      ...(detail ? { detail } : {}),
    });

    if (Array.isArray(node.body)) {
      for (const child of node.body) walk(child);
    }
    if (Array.isArray(node.thenBranch)) {
      for (const child of node.thenBranch) walk(child);
    }
    if (Array.isArray(node.elseBranch)) {
      for (const child of node.elseBranch) walk(child);
    }
    if (Array.isArray(node.elseIfs)) {
      for (const clause of node.elseIfs) {
        if (Array.isArray(clause.thenBranch)) {
          for (const child of clause.thenBranch) walk(child);
        }
      }
    }
    if (Array.isArray(node.arms)) {
      for (const arm of node.arms) {
        if (Array.isArray(arm.body)) {
          for (const child of arm.body) walk(child);
        }
      }
    }
    if (Array.isArray(node.members)) {
      for (const m of node.members) {
        if (m && typeof m === 'object' && 'kind' in m) {
          walk(m as AstLike);
        }
      }
    }
  };

  if (Array.isArray(program.body)) {
    for (const stmt of program.body) walk(stmt);
  }
  return out;
}

function detailFor(node: AstLike): string | undefined {
  if (node.kind === 'DeclareStatement' && Array.isArray(node.names)) {
    const names = node.names.map((n) => n.name).join(', ');
    const t =
      node.type && 'name' in node.type && typeof node.type.name === 'string'
        ? node.type.name
        : node.type?.kind;
    return t ? `${names} : ${t}` : names;
  }
  if (node.kind === 'EnumTypeDeclaration' && Array.isArray(node.members)) {
    const name = typeof node.name === 'string' ? node.name : node.name?.name;
    const members = node.members
      .map((member) =>
        typeof member === 'string'
          ? member
          : typeof member?.name === 'string'
            ? member.name
            : '',
      )
      .filter(Boolean)
      .join(', ');
    return name ? `${name} = (${members})` : members || undefined;
  }
  if (node.kind === 'PointerTypeDeclaration') {
    const name = typeof node.name === 'string' ? node.name : node.name?.name;
    const target =
      node.targetType &&
      'name' in node.targetType &&
      typeof node.targetType.name === 'string'
        ? node.targetType.name
        : node.targetType?.kind;
    return name && target ? `${name} = ^${target}` : name ?? target;
  }
  if (node.kind === 'SetTypeDeclaration') {
    const name = typeof node.name === 'string' ? node.name : node.name?.name;
    const element =
      node.elementType &&
      'name' in node.elementType &&
      typeof node.elementType.name === 'string'
        ? node.elementType.name
        : node.elementType?.kind;
    return name && element ? `${name} = SET OF ${element}` : name ?? element;
  }
  if (node.kind === 'DefineStatement' && node.name) {
    return typeof node.name === 'string' ? node.name : node.name.name;
  }
  if (
    (node.kind === 'ProcedureDeclaration' ||
      node.kind === 'FunctionDeclaration' ||
      node.kind === 'TypeDeclaration' ||
      node.kind === 'ClassDeclaration') &&
    node.name
  ) {
    return typeof node.name === 'string' ? node.name : node.name.name;
  }
  return undefined;
}
