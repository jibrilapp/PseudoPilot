import {
  formatType,
  type ClassFieldInfo,
  type ClassMethodInfo,
  type SymbolInfo,
  type PpType,
} from '@pseudopilot/checker';
import {
  CORE_BUILTINS,
  lookupBuiltin,
  type BuiltinSpec,
  type Expression,
  type Parameter,
  type Program,
  type Statement,
} from '@pseudopilot/language-core';
import type { DocumentAnalysis } from './analyze.js';
import type { Occurrence } from './index/occurrences.js';
import {
  positionInSpan,
  spanToRange,
  type LsLocation,
  type LsPosition,
  type LsRange,
} from './protocol.js';
import { isKeyword, CAMBRIDGE_KEYWORDS } from './keywords.js';

export type HoverInfo = {
  readonly range: LsRange;
  readonly contents: string;
  readonly symbol: SymbolInfo | null;
};

export type DocumentSymbol = {
  readonly name: string;
  readonly kind: SymbolInfo['kind'] | 'builtin';
  readonly detail: string;
  readonly range: LsRange;
  readonly selectionRange: LsRange;
  readonly containerName: string;
};

export type CompletionItem = {
  readonly label: string;
  readonly kind:
    | 'variable'
    | 'constant'
    | 'function'
    | 'procedure'
    | 'keyword'
    | 'type'
    | 'parameter';
  readonly detail?: string;
  readonly insertText?: string;
  readonly documentation?: string;
};

export type SignatureParameter = {
  readonly label: string;
  readonly documentation?: string;
};

export type SignatureHelp = {
  readonly label: string;
  readonly documentation?: string;
  readonly parameters: readonly SignatureParameter[];
  readonly activeParameter: number;
};

export type TextEdit = {
  readonly uri: string;
  readonly edits: readonly { readonly range: LsRange; readonly newText: string }[];
};

export type RenameResult =
  | { readonly ok: true; readonly edit: TextEdit }
  | { readonly ok: false; readonly message: string };

export type PrepareRenameResult =
  | { readonly ok: true; readonly range: LsRange; readonly placeholder: string }
  | { readonly ok: false; readonly message: string };

/** Find the innermost occurrence covering a position. */
export function occurrenceAt(
  analysis: DocumentAnalysis,
  position: LsPosition,
): Occurrence | null {
  let best: Occurrence | null = null;
  for (const occ of analysis.occurrences.byOffset) {
    if (!positionInSpan(position, occ.span)) continue;
    if (
      !best ||
      occ.span.end.offset - occ.span.start.offset <=
        best.span.end.offset - best.span.start.offset
    ) {
      best = occ;
    }
  }
  return best;
}

/** Static hover text for keywords that never appear as occurrences (no declaration site of their own). */
const KEYWORD_HOVER: Readonly<Record<string, string>> = {
  NEW: [
    '**(keyword)** `NEW`',
    '`NEW ClassName(args)` instantiates CLASS `ClassName`: allocates its fields (own + inherited, default-initialised) and — if the class declares a `NEW` constructor method — calls it with `args`.',
    'Objects are **reference types**: assigning or passing the result aliases the same instance (unlike `TYPE` records, which copy by value).',
  ].join('\n\n'),
};

/** Word (identifier/keyword) touching `position`, with its source range. */
function wordTokenAt(
  source: string,
  position: LsPosition,
): { readonly word: string; readonly range: LsRange } | null {
  const lines = source.split('\n');
  const line = lines[position.line] ?? '';
  const left = line.slice(0, position.character);
  const right = line.slice(position.character);
  const leftPart = /[A-Za-z_][A-Za-z0-9_]*$/.exec(left)?.[0] ?? '';
  const rightPart = /^[A-Za-z0-9_]*/.exec(right)?.[0] ?? '';
  const word = leftPart + rightPart;
  if (!word) return null;
  return {
    word,
    range: {
      start: { line: position.line, character: position.character - leftPart.length },
      end: { line: position.line, character: position.character + rightPart.length },
    },
  };
}

export function hover(
  analysis: DocumentAnalysis,
  position: LsPosition,
): HoverInfo | null {
  const occ = occurrenceAt(analysis, position);
  if (!occ) {
    // Keywords with no occurrence of their own (e.g. `NEW` in `NEW ClassName(...)`
    // — only the class name is indexed) still deserve a hover.
    const token = wordTokenAt(analysis.source, position);
    const keywordDoc = token ? KEYWORD_HOVER[token.word.toUpperCase()] : undefined;
    if (token && keywordDoc) {
      return { range: token.range, contents: keywordDoc, symbol: null };
    }
    return null;
  }
  const symbol = occ.symbol;
  const range = spanToRange(occ.span);
  if (!symbol) {
    return {
      range,
      contents: `*(undeclared)* \`${occ.name}\``,
      symbol: null,
    };
  }
  return {
    range,
    contents: formatHover(analysis, symbol),
    symbol,
  };
}

function formatHover(analysis: DocumentAnalysis, symbol: SymbolInfo): string {
  const lines: string[] = [];
  if (symbol.builtin) {
    const b = lookupBuiltin(symbol.name);
    lines.push(`**(builtin)** \`${symbol.name}\``);
    if (b) {
      lines.push(formatBuiltinSig(b));
      lines.push(b.summary);
    }
    return lines.join('\n\n');
  }

  const kindLabel = symbol.kind.toUpperCase();
  lines.push(`**${kindLabel}** \`${symbol.name}\``);
  lines.push(`Type: \`${formatType(symbol.type)}\``);

  if (symbol.type.kind === 'array') {
    const bounds = arrayBoundsHint(analysis, symbol);
    lines.push(
      bounds
        ? `Array: ${bounds}`
        : `Array: ${symbol.type.dimensions} dimension(s) of \`${formatType(symbol.type.element)}\``,
    );
  }
  if (symbol.type.kind === 'record') {
    const fields = symbol.type.fields
      .map((f) => `${f.name}: ${formatType(f.type)}`)
      .join(', ');
    lines.push(fields ? `Fields: \`${fields}\`` : '_Empty record_');
  }
  if (symbol.type.kind === 'enum') {
    lines.push(
      symbol.type.members.length > 0
        ? `Members: \`${symbol.type.members.join(', ')}\``
        : '_Empty enum_',
    );
  }
  if (symbol.type.kind === 'pointer') {
    lines.push(`Points to: \`${formatType(symbol.type.target)}\``);
  }
  if (symbol.type.kind === 'set') {
    lines.push(`Element type: \`${formatType(symbol.type.element)}\``);
  }
  if (symbol.type.kind === 'class') {
    const cls = symbol.type;
    if (cls.inherits) {
      lines.push(`Inherits: \`${cls.inherits}\``);
    }
    const fields = cls.fields.map((f) => formatClassFieldSig(f)).join(', ');
    lines.push(fields ? `Own fields: \`${fields}\`` : '_No own fields_');
    const methods = cls.methods.map((m) => formatClassMethodSig(m)).join(', ');
    lines.push(methods ? `Own methods: \`${methods}\`` : '_No own methods_');
  }
  if (symbol.type.kind === 'procedure' || symbol.type.kind === 'function') {
    const params =
      symbol.kind === 'method'
        ? findClassMethodParams(analysis, symbol.containerName ?? '', symbol.name)
        : callableParams(analysis, symbol.name);
    lines.push(formatCallable(symbol.name, symbol.type, params));
  }
  if (symbol.kind === 'field' || symbol.kind === 'method') {
    const visibility = findClassMemberVisibility(
      analysis,
      symbol.containerName ?? '',
      symbol.name,
      symbol.kind,
    );
    if (visibility) lines.push(`Visibility: \`${visibility}\``);
  }
  if (symbol.kind === 'constant') {
    const value = constantLiteralText(analysis, symbol);
    lines.push(
      value
        ? `Value: \`${value}\` _(immutable)_`
        : '_Constant (immutable)_',
    );
  }
  if (symbol.implicit) {
    lines.push('_Implicit FOR variable_');
  }
  if (symbol.containerName && symbol.containerName !== 'global') {
    lines.push(`Scope: \`${symbol.containerName}\``);
  } else {
    lines.push('Scope: `global`');
  }
  lines.push(
    `Declared at line ${symbol.span.start.line}, column ${symbol.span.start.column}`,
  );
  return lines.join('\n\n');
}

function formatCallable(
  name: string,
  type: PpType,
  namedParams?: readonly Parameter[] | null,
): string {
  const labels = (params: readonly PpType[]): string =>
    params
      .map((p, i) => {
        const n = namedParams?.[i]?.name.name ?? `p${i + 1}`;
        const mode = namedParams?.[i]?.mode;
        const prefix =
          mode === 'BYREF' ? 'BYREF ' : mode === 'BYVAL' ? '' : '';
        return `${prefix}${n}: ${formatType(p)}`;
      })
      .join(', ');
  if (type.kind === 'procedure') {
    return `\`PROCEDURE ${name}(${labels(type.params)})\``;
  }
  if (type.kind === 'function') {
    return `\`FUNCTION ${name}(${labels(type.params)}) RETURNS ${formatType(type.returns)}\``;
  }
  return formatType(type);
}

function formatClassFieldSig(f: ClassFieldInfo): string {
  const mark = f.visibility === 'PRIVATE' ? '-' : '+';
  return `${mark}${f.name}: ${formatType(f.type)}`;
}

function formatClassMethodSig(m: ClassMethodInfo): string {
  const mark = m.visibility === 'PRIVATE' ? '-' : '+';
  const params = m.params.map(formatType).join(', ');
  if (m.kind === 'procedure') return `${mark}${m.name}(${params})`;
  const returns = m.returns ? formatType(m.returns) : '?';
  return `${mark}${m.name}(${params}) → ${returns}`;
}

/** Own-declared visibility of a field/method on CLASS `className` (best-effort). */
function findClassMemberVisibility(
  analysis: DocumentAnalysis,
  className: string,
  memberName: string,
  kind: 'field' | 'method',
): 'PUBLIC' | 'PRIVATE' | null {
  const clsSymbol = analysis.symbols.find(
    (s) => s.kind === 'class' && s.name.toLowerCase() === className.toLowerCase(),
  );
  if (!clsSymbol || clsSymbol.type.kind !== 'class') return null;
  const key = memberName.toLowerCase();
  if (kind === 'field') {
    return clsSymbol.type.fields.find((f) => f.name.toLowerCase() === key)?.visibility ?? null;
  }
  return clsSymbol.type.methods.find((m) => m.name.toLowerCase() === key)?.visibility ?? null;
}

/** Named parameters of a CLASS method declared directly on `className` (not inherited). */
function findClassMethodParams(
  analysis: DocumentAnalysis,
  className: string,
  methodName: string,
): readonly Parameter[] | null {
  if (!analysis.ast) return null;
  for (const stmt of analysis.ast.body) {
    if (stmt.kind !== 'ClassDeclaration') continue;
    if (stmt.name.name.toLowerCase() !== className.toLowerCase()) continue;
    for (const member of stmt.members) {
      if (member.kind === 'ClassPropertyDeclaration') continue;
      if (member.name.name.toLowerCase() === methodName.toLowerCase()) {
        return member.parameters;
      }
    }
  }
  return null;
}

function constantLiteralText(
  analysis: DocumentAnalysis,
  symbol: SymbolInfo,
): string | null {
  if (!analysis.ast) return null;
  const stmt = findConstant(analysis.ast, symbol.name, symbol.span.start.offset);
  if (!stmt) return null;
  return expressionPreview(stmt.value, analysis.source);
}

function arrayBoundsHint(
  analysis: DocumentAnalysis,
  symbol: SymbolInfo,
): string | null {
  if (!analysis.ast || symbol.type.kind !== 'array') return null;
  const decl = findDeclareTypeText(analysis, symbol);
  return decl;
}

function findDeclareTypeText(
  analysis: DocumentAnalysis,
  symbol: SymbolInfo,
): string | null {
  // Prefer source slice of the DECLARE type clause when available.
  const line = analysis.source.split('\n')[symbol.span.start.line - 1] ?? '';
  const m = /:\s*(ARRAY\[[^\]]+\](?:\s*OF\s+\w+)?)/i.exec(line);
  if (m) return m[1]!.trim();
  if (symbol.type.kind !== 'array') return null;
  return `${symbol.type.dimensions}D OF ${formatType(symbol.type.element)}`;
}

function callableParams(
  analysis: DocumentAnalysis,
  name: string,
): readonly Parameter[] | null {
  if (!analysis.ast) return null;
  for (const stmt of walkTopLevelAndNested(analysis.ast)) {
    if (
      (stmt.kind === 'ProcedureDeclaration' ||
        stmt.kind === 'FunctionDeclaration') &&
      stmt.name.name.toLowerCase() === name.toLowerCase()
    ) {
      return stmt.parameters;
    }
  }
  return null;
}

function findConstant(
  program: Program,
  name: string,
  offsetHint: number,
): { value: Expression } | null {
  let best: { value: Expression; dist: number } | null = null;
  for (const stmt of walkTopLevelAndNested(program)) {
    if (stmt.kind !== 'ConstantStatement') continue;
    if (stmt.name.name.toLowerCase() !== name.toLowerCase()) continue;
    const dist = Math.abs(stmt.name.span.start.offset - offsetHint);
    if (!best || dist < best.dist) best = { value: stmt.value, dist };
  }
  return best ? { value: best.value } : null;
}

function* walkTopLevelAndNested(program: Program): Generator<Statement> {
  function* walk(stmts: readonly Statement[]): Generator<Statement> {
    for (const s of stmts) {
      yield s;
      switch (s.kind) {
        case 'ProcedureDeclaration':
        case 'FunctionDeclaration':
          yield* walk(s.body);
          break;
        case 'IfStatement':
          yield* walk(s.consequent);
          for (const c of s.elseIfClauses) yield* walk(c.consequent);
          if (s.alternate) yield* walk(s.alternate);
          break;
        case 'WhileStatement':
        case 'RepeatStatement':
        case 'ForStatement':
          yield* walk(s.body);
          break;
        case 'CaseStatement':
          for (const a of s.arms) yield* walk(a.body);
          if (s.otherwise) yield* walk(s.otherwise);
          break;
        default:
          break;
      }
    }
  }
  yield* walk(program.body);
}

function expressionPreview(expr: Expression, source: string): string {
  const slice = source.slice(expr.span.start.offset, expr.span.end.offset).trim();
  if (slice.length > 0 && slice.length < 80) return slice;
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
    default:
      return slice || '?';
  }
}

function formatBuiltinSig(b: BuiltinSpec): string {
  const params = b.params
    .map((p) => `${p.name}: ${p.accept.join('|')}`)
    .join(', ');
  const ret = b.returns === 'same-as-arg0' ? 'STRING' : b.returns;
  return `\`${b.name}(${params}) → ${ret}\``;
}

export function definition(
  analysis: DocumentAnalysis,
  position: LsPosition,
): LsLocation | null {
  const occ = occurrenceAt(analysis, position);
  if (!occ?.symbol || occ.symbol.builtin) return null;
  return {
    uri: analysis.uri,
    range: spanToRange(occ.symbol.span),
  };
}

export function references(
  analysis: DocumentAnalysis,
  position: LsPosition,
  options?: { readonly includeDeclaration?: boolean },
): LsLocation[] {
  const occ = occurrenceAt(analysis, position);
  if (!occ) return [];
  const includeDecl = options?.includeDeclaration !== false;
  const list = analysis.occurrences.bySymbolKey.get(occ.symbolKey) ?? [];
  const out: LsLocation[] = [];
  for (const o of list) {
    if (!includeDecl && o.kind === 'declaration') continue;
    if (o.symbol?.builtin) continue;
    out.push({ uri: analysis.uri, range: spanToRange(o.span) });
  }
  return out;
}

export function documentSymbols(analysis: DocumentAnalysis): DocumentSymbol[] {
  const out: DocumentSymbol[] = [];
  for (const s of analysis.symbols) {
    if (s.builtin) continue;
    const range = spanToRange(s.span);
    out.push({
      name: s.name,
      kind: s.kind,
      detail: formatType(s.type),
      range,
      selectionRange: range,
      containerName: s.containerName ?? 'global',
    });
  }
  return out;
}

export function workspaceSymbols(
  analyses: readonly DocumentAnalysis[],
  query: string,
): DocumentSymbol[] {
  const q = query.trim().toLowerCase();
  const out: DocumentSymbol[] = [];
  for (const a of analyses) {
    for (const sym of documentSymbols(a)) {
      if (!q || sym.name.toLowerCase().includes(q)) {
        out.push(sym);
      }
    }
  }
  return out;
}

export function prepareRename(
  analysis: DocumentAnalysis,
  position: LsPosition,
): PrepareRenameResult {
  const occ = occurrenceAt(analysis, position);
  if (!occ) {
    return { ok: false, message: 'No identifier at this position.' };
  }
  if (isKeyword(occ.name)) {
    return { ok: false, message: 'Cannot rename a keyword.' };
  }
  if (occ.symbol?.builtin || lookupBuiltin(occ.name)) {
    return { ok: false, message: 'Cannot rename a builtin.' };
  }
  if (!occ.symbol) {
    return { ok: false, message: 'Cannot rename an undeclared identifier.' };
  }
  return {
    ok: true,
    range: spanToRange(occ.span),
    placeholder: occ.symbol.name,
  };
}

export function rename(
  analysis: DocumentAnalysis,
  position: LsPosition,
  newName: string,
): RenameResult {
  const prepared = prepareRename(analysis, position);
  if (!prepared.ok) return prepared;

  const trimmed = newName.trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
    return {
      ok: false,
      message: 'New name must be a Cambridge identifier.',
    };
  }
  if (isKeyword(trimmed)) {
    return { ok: false, message: 'New name collides with a keyword.' };
  }
  if (lookupBuiltin(trimmed)) {
    return { ok: false, message: 'New name collides with a builtin.' };
  }

  const occ = occurrenceAt(analysis, position)!;
  const symbol = occ.symbol!;
  const newKey = trimmed.toLowerCase();

  // Duplicate in same container?
  for (const s of analysis.symbols) {
    if (s === symbol) continue;
    if (s.builtin) continue;
    if ((s.containerName ?? 'global') !== (symbol.containerName ?? 'global')) {
      continue;
    }
    if (s.name.toLowerCase() === newKey) {
      return {
        ok: false,
        message: `Name '${trimmed}' already exists in this scope.`,
      };
    }
  }

  const list = analysis.occurrences.bySymbolKey.get(occ.symbolKey) ?? [];
  const edits = list
    .filter((o) => !o.symbol?.builtin)
    .map((o) => ({ range: spanToRange(o.span), newText: trimmed }));

  // Deduplicate identical ranges
  const seen = new Set<string>();
  const unique = edits.filter((e) => {
    const k = `${e.range.start.line}:${e.range.start.character}:${e.range.end.line}:${e.range.end.character}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    ok: true,
    edit: { uri: analysis.uri, edits: unique },
  };
}

export function completion(
  analysis: DocumentAnalysis,
  position: LsPosition,
): CompletionItem[] {
  const items: CompletionItem[] = [];
  const seen = new Set<string>();
  const enumContextType = expectedEnumAssignmentType(analysis, position);

  const add = (item: CompletionItem): void => {
    const key = `${item.kind}:${item.label.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  // Member completion first — must not mix in globals/builtins.
  const rawPrefix = linePrefixAt(analysis.source, position);
  if (/\.\s*$/.test(rawPrefix)) {
    const host = memberHostBeforeDot(analysis, position);
    if (host?.kind === 'record') {
      for (const f of host.fields) {
        add({
          label: f.name,
          kind: 'variable',
          detail: formatType(f.type),
          documentation: `Field of ${host.name}`,
        });
      }
      return items;
    }
    if (host?.kind === 'class') {
      const { fields, methods } = collectClassMembers(analysis, host);
      for (const f of fields) {
        add({
          label: f.name,
          kind: 'variable',
          detail: formatType(f.type),
          documentation:
            f.owner === host.name
              ? `Field of ${host.name}${f.visibility === 'PRIVATE' ? ' (PRIVATE)' : ''}`
              : `Field inherited from ${f.owner}${f.visibility === 'PRIVATE' ? ' (PRIVATE)' : ''}`,
        });
      }
      for (const m of methods) {
        const named = findClassMethodParams(analysis, m.owner, m.name);
        add({
          label: m.name,
          kind: m.kind === 'function' ? 'function' : 'procedure',
          detail: formatCallable(
            m.name,
            m.kind === 'function'
              ? { kind: 'function', params: m.params, returns: m.returns ?? { kind: 'error' } }
              : { kind: 'procedure', params: m.params },
            named,
          ),
          documentation:
            m.owner === host.name
              ? `Method of ${host.name}${m.visibility === 'PRIVATE' ? ' (PRIVATE)' : ''}`
              : `Method inherited from ${m.owner}${m.visibility === 'PRIVATE' ? ' (PRIVATE)' : ''}`,
        });
      }
      return items;
    }
  }

  // In-scope symbols (prefer locals / globals from checker).
  for (const s of analysis.symbols) {
    if (s.builtin) continue;
    if (s.kind === 'field' || s.kind === 'method') continue; // offered after `.` only
    if (
      enumContextType &&
      s.kind === 'constant' &&
      s.type.kind === 'enum' &&
      s.type.name.toLowerCase() === enumContextType.name.toLowerCase()
    ) {
      add({
        label: s.name,
        kind: 'constant',
        detail: formatType(s.type),
        documentation: `Member of enum ${enumContextType.name}`,
      });
      continue;
    }
    add({
      label: s.name,
      kind:
        s.kind === 'function'
          ? 'function'
          : s.kind === 'procedure'
            ? 'procedure'
            : s.kind === 'constant'
              ? 'constant'
              : s.kind === 'parameter'
                ? 'parameter'
                : s.kind === 'type' || s.kind === 'class'
                  ? 'type'
                  : 'variable',
      detail: formatType(s.type),
    });
  }

  for (const b of CORE_BUILTINS) {
    add({
      label: b.name,
      kind: 'function',
      detail: formatBuiltinSig(b),
      documentation: b.summary,
    });
  }

  // Context keywords (lightweight prefix-agnostic set).
  const linePrefix = rawPrefix.toUpperCase();

  if (/\bCALL\s+$/i.test(linePrefix) || /\bCALL$/i.test(linePrefix.trimEnd())) {
    for (const s of analysis.symbols) {
      if (s.kind === 'procedure') {
        add({
          label: s.name,
          kind: 'procedure',
          detail: formatType(s.type),
        });
      }
    }
  } else if (/\bDECLARE\b/i.test(linePrefix) || /\bRETURNS\b/i.test(linePrefix)) {
    for (const t of [
      'INTEGER',
      'REAL',
      'STRING',
      'BOOLEAN',
      'CHAR',
      'DATE',
      'ARRAY',
    ]) {
      add({ label: t, kind: 'type' });
    }
    for (const s of analysis.symbols) {
      if (s.kind === 'type') {
        add({ label: s.name, kind: 'type', detail: 'TYPE' });
      } else if (s.kind === 'class') {
        add({ label: s.name, kind: 'type', detail: 'CLASS' });
      }
    }
  } else {
    for (const kw of [
      'IF',
      'THEN',
      'ELSE',
      'ENDIF',
      'WHILE',
      'ENDWHILE',
      'FOR',
      'TO',
      'NEXT',
      'REPEAT',
      'UNTIL',
      'CASE',
      'OF',
      'OTHERWISE',
      'ENDCASE',
      'DECLARE',
      'CONSTANT',
      'TYPE',
      'ENDTYPE',
      'PROCEDURE',
      'FUNCTION',
      'CALL',
      'RETURN',
      'OUTPUT',
      'INPUT',
      'SET',
      'DEFINE',
      'AND',
      'OR',
      'NOT',
      'TRUE',
      'FALSE',
      'CLASS',
      'ENDCLASS',
      'PUBLIC',
      'PRIVATE',
      'INHERITS',
      'SUPER',
      'NEW',
    ]) {
      add({ label: kw, kind: 'keyword' });
    }
  }

  void CAMBRIDGE_KEYWORDS;
  void position;
  return items;
}

function linePrefixAt(source: string, position: LsPosition): string {
  const lines = source.split('\n');
  const line = lines[position.line] ?? '';
  return line.slice(0, position.character);
}

function expectedEnumAssignmentType(
  analysis: DocumentAnalysis,
  position: LsPosition,
): Extract<PpType, { kind: 'enum' }> | null {
  const prefix = linePrefixAt(analysis.source, position);
  const match =
    /(?:^|[^A-Za-z0-9_])([A-Za-z_][\w]*(?:\s*(?:\.\s*[A-Za-z_][\w]*|\[[^\]]*\]|\^))*)\s*(?:←|<-)\s*$/u.exec(
      prefix,
    );
  if (!match) return null;
  const type = resolveAssignableTypeText(
    analysis,
    match[1]!.replace(/\s+/g, ''),
  );
  return type?.kind === 'enum' ? type : null;
}

function resolveAssignableTypeText(
  analysis: DocumentAnalysis,
  text: string,
): PpType | null {
  const root = /^([A-Za-z_][\w]*)/.exec(text);
  if (!root) return null;
  const rootSym = analysis.symbols.find(
    (s) =>
      s.name.toLowerCase() === root[1]!.toLowerCase() &&
      (s.kind === 'variable' || s.kind === 'parameter' || s.kind === 'constant'),
  );
  const rootType = rootSym?.type;
  if (!rootType) return null;
  let current: PpType = rootType;

  const segments = text.slice(root[1]!.length);
  const segmentRe = /(\[[^\]]*\])|(\.)\s*([A-Za-z_][\w]*)|(\^)/g;
  let seg: RegExpExecArray | null;
  while ((seg = segmentRe.exec(segments)) !== null) {
    if (seg[1]) {
      if (current.kind !== 'array') return null;
      current = current.element;
      continue;
    }
    if (seg[2]) {
      const fieldName = seg[3]!;
      if (current.kind === 'record') {
        const field = current.fields.find(
          (f) => f.name.toLowerCase() === fieldName.toLowerCase(),
        );
        if (!field) return null;
        current = field.type;
        continue;
      }
      if (current.kind === 'class') {
        const field = findClassFieldInChain(analysis, current, fieldName);
        if (!field) return null;
        current = field.type;
        continue;
      }
      return null;
    }
    if (seg[4]) {
      if (current.kind !== 'pointer') return null;
      current = current.target;
    }
  }

  return current;
}

type MemberHost =
  | Extract<PpType, { kind: 'record' }>
  | Extract<PpType, { kind: 'class' }>;

/** Look up a CLASS `PpType` by display name via the document's global symbols. */
function findClassByName(
  analysis: DocumentAnalysis,
  name: string,
): Extract<PpType, { kind: 'class' }> | undefined {
  const sym = analysis.symbols.find(
    (s) => s.kind === 'class' && s.name.toLowerCase() === name.toLowerCase(),
  );
  return sym && sym.type.kind === 'class' ? sym.type : undefined;
}

/** Walk a CLASS's inheritance chain (self first) guarding against cycles. */
function classChain(
  analysis: DocumentAnalysis,
  cls: Extract<PpType, { kind: 'class' }>,
): readonly Extract<PpType, { kind: 'class' }>[] {
  const chain: Extract<PpType, { kind: 'class' }>[] = [cls];
  const seen = new Set<string>([cls.name.toLowerCase()]);
  let current = cls;
  while (current.inherits && !seen.has(current.inherits.toLowerCase())) {
    seen.add(current.inherits.toLowerCase());
    const parent = findClassByName(analysis, current.inherits);
    if (!parent) break;
    chain.push(parent);
    current = parent;
  }
  return chain;
}

/** Find `fieldName` on `cls` or an ancestor (own fields first). */
function findClassFieldInChain(
  analysis: DocumentAnalysis,
  cls: Extract<PpType, { kind: 'class' }>,
  fieldName: string,
): ClassFieldInfo | undefined {
  const key = fieldName.toLowerCase();
  for (const c of classChain(analysis, cls)) {
    const found = c.fields.find((f) => f.name.toLowerCase() === key);
    if (found) return found;
  }
  return undefined;
}

/** All fields + methods visible on `cls`, own members first, with the declaring CLASS name. */
function collectClassMembers(
  analysis: DocumentAnalysis,
  cls: Extract<PpType, { kind: 'class' }>,
): {
  readonly fields: readonly (ClassFieldInfo & { readonly owner: string })[];
  readonly methods: readonly (ClassMethodInfo & { readonly owner: string })[];
} {
  const fields = new Map<string, ClassFieldInfo & { owner: string }>();
  const methods = new Map<string, ClassMethodInfo & { owner: string }>();
  // Reverse (ancestor → self) so a child's own field/method overrides its parent's.
  const chain = [...classChain(analysis, cls)].reverse();
  for (const c of chain) {
    for (const f of c.fields) fields.set(f.name.toLowerCase(), { ...f, owner: c.name });
    for (const m of c.methods) methods.set(m.name.toLowerCase(), { ...m, owner: c.name });
  }
  return { fields: [...fields.values()], methods: [...methods.values()] };
}

/**
 * Resolve the record/class type of the expression immediately before a
 * trailing `.` so completion can offer fields/methods (e.g. `S.`, `S.Home.`,
 * `Obj.Field.`, `Class[1].`).
 */
function memberHostBeforeDot(
  analysis: DocumentAnalysis,
  position: LsPosition,
): MemberHost | null {
  const prefix = linePrefixAt(analysis.source, position);
  const m =
    /(?:^|[^A-Za-z0-9_])([A-Za-z_][\w]*)((?:\s*(?:\.\s*[A-Za-z_][\w]*|\[[^\]]*\]))*)\s*\.\s*$/.exec(
      prefix,
    );
  if (!m) return null;

  const rootName = m[1]!;
  const chain = m[2] ?? '';

  const rootSym = analysis.symbols.find(
    (s) =>
      s.name.toLowerCase() === rootName.toLowerCase() &&
      (s.kind === 'variable' ||
        s.kind === 'parameter' ||
        s.kind === 'constant'),
  );
  let type: PpType | null = rootSym?.type ?? null;
  if (!type) return null;

  let current: PpType = type;

  const segmentRe = /\.\s*([A-Za-z_][\w]*)|\[/g;
  let seg: RegExpExecArray | null;
  while ((seg = segmentRe.exec(chain)) !== null) {
    if (seg[0]!.startsWith('[')) {
      if (current.kind !== 'array') return null;
      current = current.element;
      continue;
    }
    const fieldName = seg[1]!;
    if (current.kind === 'record') {
      const field = current.fields.find(
        (f) => f.name.toLowerCase() === fieldName.toLowerCase(),
      );
      if (!field) return null;
      current = field.type;
    } else if (current.kind === 'class') {
      const field = findClassFieldInChain(analysis, current, fieldName);
      if (!field) return null;
      current = field.type;
    } else {
      return null;
    }
  }

  return current.kind === 'record' || current.kind === 'class' ? current : null;
}

export function signatureHelp(
  analysis: DocumentAnalysis,
  position: LsPosition,
): SignatureHelp | null {
  if (!analysis.ast) return null;
  const call = findEnclosingCall(analysis, position);
  if (!call) return null;

  const symbol =
    analysis.symbols.find(
      (s) =>
        (s.kind === 'function' || s.kind === 'procedure') &&
        s.name.toLowerCase() === call.callee.toLowerCase() &&
        (s.containerName ?? 'global') === 'global',
    ) ?? null;

  const builtin = lookupBuiltin(call.callee);
  if (builtin) {
    const parameters = builtin.params.map((p) => ({
      label: `${p.name}: ${p.accept.join('|')}`,
    }));
    return {
      label: formatBuiltinSig(builtin),
      documentation: builtin.summary,
      parameters,
      activeParameter: Math.min(
        call.argIndex,
        Math.max(0, parameters.length - 1),
      ),
    };
  }

  if (!symbol || (symbol.type.kind !== 'function' && symbol.type.kind !== 'procedure')) {
    return null;
  }

  const named = callableParams(analysis, symbol.name);
  const params = symbol.type.params;
  const parameters = params.map((p, i) => {
    const mode = named?.[i]?.mode;
    const prefix = mode === 'BYREF' ? 'BYREF ' : '';
    return {
      label: `${prefix}${named?.[i]?.name.name ?? `p${i + 1}`}: ${formatType(p)}`,
    };
  });
  const label = formatCallable(symbol.name, symbol.type, named);
  return {
    label,
    parameters,
    activeParameter: Math.min(call.argIndex, Math.max(0, parameters.length - 1)),
  };
}

function findEnclosingCall(
  analysis: DocumentAnalysis,
  position: LsPosition,
): { callee: string; argIndex: number } | null {
  // Heuristic from source text: walk left for "Name(" and count commas outside nesting.
  const offset = (() => {
    const lines = analysis.source.split('\n');
    let o = 0;
    for (let i = 0; i < position.line && i < lines.length; i += 1) {
      o += lines[i]!.length + 1;
    }
    return o + Math.min(position.character, (lines[position.line] ?? '').length);
  })();

  const before = analysis.source.slice(0, offset);
  let depth = 0;
  let argIndex = 0;
  for (let i = before.length - 1; i >= 0; i -= 1) {
    const ch = before[i]!;
    if (ch === ')') depth += 1;
    else if (ch === '(') {
      if (depth === 0) {
        const nameMatch = /([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(before.slice(0, i));
        if (!nameMatch) return null;
        return { callee: nameMatch[1]!, argIndex };
      }
      depth -= 1;
    } else if (ch === ',' && depth === 0) {
      argIndex += 1;
    } else if (ch === '\n' && depth === 0) {
      // stop at statement boundary for Cambridge line-oriented calls
      break;
    }
  }
  return null;
}
