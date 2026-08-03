import {
  formatType,
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

export function hover(
  analysis: DocumentAnalysis,
  position: LsPosition,
): HoverInfo | null {
  const occ = occurrenceAt(analysis, position);
  if (!occ) return null;
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
  if (symbol.type.kind === 'procedure' || symbol.type.kind === 'function') {
    const params = callableParams(analysis, symbol.name);
    lines.push(formatCallable(symbol.name, symbol.type, params));
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
        return `${n}: ${formatType(p)}`;
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

  const add = (item: CompletionItem): void => {
    const key = `${item.kind}:${item.label.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  // Member completion first — must not mix in globals/builtins.
  const rawPrefix = linePrefixAt(analysis.source, position);
  if (/\.\s*$/.test(rawPrefix)) {
    const recordType = recordTypeBeforeDot(analysis, position);
    if (recordType) {
      for (const f of recordType.fields) {
        add({
          label: f.name,
          kind: 'variable',
          detail: formatType(f.type),
          documentation: `Field of ${recordType.name}`,
        });
      }
      return items;
    }
  }

  // In-scope symbols (prefer locals / globals from checker).
  for (const s of analysis.symbols) {
    if (s.builtin) continue;
    if (s.kind === 'field') continue; // offered after `.` only
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
                : s.kind === 'type'
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
    for (const t of ['INTEGER', 'REAL', 'STRING', 'BOOLEAN', 'CHAR', 'ARRAY']) {
      add({ label: t, kind: 'type' });
    }
    for (const s of analysis.symbols) {
      if (s.kind === 'type') {
        add({ label: s.name, kind: 'type', detail: 'TYPE' });
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
      'AND',
      'OR',
      'NOT',
      'TRUE',
      'FALSE',
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

/**
 * Resolve the record type of the expression immediately before a trailing `.`
 * so completion can offer fields (e.g. `S.`, `S.Home.`, `Class[1].`).
 */
function recordTypeBeforeDot(
  analysis: DocumentAnalysis,
  position: LsPosition,
): Extract<PpType, { kind: 'record' }> | null {
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
    if (current.kind !== 'record') return null;
    const field = current.fields.find(
      (f) => f.name.toLowerCase() === fieldName.toLowerCase(),
    );
    if (!field) return null;
    current = field.type;
  }

  return current.kind === 'record' ? current : null;
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
  const parameters = params.map((p, i) => ({
    label: `${named?.[i]?.name.name ?? `p${i + 1}`}: ${formatType(p)}`,
  }));
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
