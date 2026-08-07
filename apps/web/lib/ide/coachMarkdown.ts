/**
 * Tiny markdown subset for AI Coach messages — no extra dependency.
 * Supports fenced code, inline code, bold, italic, and paragraphs.
 */

export type CoachMdNode =
  | { type: 'paragraph'; children: CoachMdInline[] }
  | { type: 'code'; lang: string | null; value: string };

export type CoachMdInline =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'em'; value: string };

const FENCE = /```([\w+-]*)\n?([\s\S]*?)```/g;

export function parseCoachMarkdown(source: string): CoachMdNode[] {
  const nodes: CoachMdNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(FENCE.source, 'g');
  while ((match = re.exec(source)) !== null) {
    if (match.index > last) {
      pushParagraphs(nodes, source.slice(last, match.index));
    }
    nodes.push({
      type: 'code',
      lang: match[1] || null,
      value: match[2].replace(/\n$/, ''),
    });
    last = match.index + match[0].length;
  }
  if (last < source.length) {
    pushParagraphs(nodes, source.slice(last));
  }
  return nodes.length > 0 ? nodes : [{ type: 'paragraph', children: [{ type: 'text', value: '' }] }];
}

function pushParagraphs(nodes: CoachMdNode[], chunk: string): void {
  const parts = chunk.split(/\n{2,}/);
  for (const part of parts) {
    const trimmed = part.replace(/^\n+|\n+$/g, '');
    if (!trimmed) continue;
    nodes.push({
      type: 'paragraph',
      children: parseInline(trimmed.replace(/\n/g, ' ')),
    });
  }
}

function parseInline(text: string): CoachMdInline[] {
  const out: CoachMdInline[] = [];
  // Order: code → strong → em
  const token =
    /(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = token.exec(text)) !== null) {
    if (m.index > last) {
      out.push({ type: 'text', value: text.slice(last, m.index) });
    }
    if (m[2] != null) out.push({ type: 'code', value: m[2] });
    else if (m[4] != null) out.push({ type: 'strong', value: m[4] });
    else if (m[6] != null) out.push({ type: 'em', value: m[6] });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    out.push({ type: 'text', value: text.slice(last) });
  }
  return out.length > 0 ? out : [{ type: 'text', value: text }];
}

export function formatConsoleTimestamp(ms: number, now = Date.now()): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  // Relative hint when older than a minute (keeps console scannable).
  if (now - ms > 60_000) {
    return `${hh}:${mm}:${ss}`;
  }
  return `${hh}:${mm}:${ss}`;
}
