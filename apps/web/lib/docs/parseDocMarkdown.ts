/**
 * Documentation markdown parser — richer than CoachMarkdown.
 * Supports headings, paragraphs, lists, tables, fences, blockquotes/callouts,
 * links, images, and inline emphasis. No external deps.
 */

import { slugifyHeading } from './discover';

export type DocMdInline =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'strong'; children: DocMdInline[] }
  | { type: 'em'; children: DocMdInline[] }
  | { type: 'link'; href: string; children: DocMdInline[] }
  | { type: 'image'; src: string; alt: string };

export type DocMdBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; id: string; children: DocMdInline[] }
  | { type: 'paragraph'; children: DocMdInline[] }
  | { type: 'code'; lang: string | null; value: string }
  | { type: 'blockquote'; callout: string | null; children: DocMdBlock[] }
  | { type: 'ul'; items: DocMdInline[][] }
  | { type: 'ol'; items: DocMdInline[][] }
  | { type: 'table'; header: DocMdInline[][]; rows: DocMdInline[][][] }
  | { type: 'hr' };

export function parseDocMarkdown(source: string): DocMdBlock[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: DocMdBlock[] = [];
  let i = 0;
  const seenIds = new Map<string, number>();

  const allocId = (text: string): string => {
    const id = slugifyHeading(stripInlineToText(parseInline(text))) || 'section';
    const n = seenIds.get(id) ?? 0;
    seenIds.set(id, n + 1);
    return n > 0 ? `${id}-${n}` : id;
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code
    const fence = /^```([\w+-]*)\s*$/.exec(line);
    if (fence) {
      const lang = fence[1] || null;
      i += 1;
      const body: string[] = [];
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence
      blocks.push({ type: 'code', lang, value: body.join('\n') });
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    // Heading
    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      const level = heading[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      const raw = heading[2];
      blocks.push({
        type: 'heading',
        level,
        id: allocId(raw),
        children: parseInline(raw),
      });
      i += 1;
      continue;
    }

    // Table (header | --- | rows)
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      /^\s*\|?[\s-:|]+\|?\s*$/.test(lines[i + 1])
    ) {
      const header = splitTableRow(line).map(parseInline);
      i += 2;
      const rows: DocMdInline[][][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitTableRow(lines[i]).map(parseInline));
        i += 1;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    // Blockquote / callout
    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      const inner = parseDocMarkdown(quoteLines.join('\n'));
      const callout = detectCallout(quoteLines.join('\n'));
      blocks.push({ type: 'blockquote', callout, children: inner });
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: DocMdInline[][] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(parseInline(lines[i].replace(/^\s*[-*+]\s+/, '')));
        i += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: DocMdInline[][] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(parseInline(lines[i].replace(/^\s*\d+\.\s+/, '')));
        i += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Blank
    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Paragraph (consume until blank / block start)
    const para: string[] = [];
    while (i < lines.length && lines[i].trim()) {
      if (
        /^```/.test(lines[i]) ||
        /^#{1,6}\s/.test(lines[i]) ||
        /^>\s?/.test(lines[i]) ||
        /^\s*[-*+]\s+/.test(lines[i]) ||
        /^\s*\d+\.\s+/.test(lines[i]) ||
        /^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])
      ) {
        break;
      }
      // Don't swallow table start mid-paragraph awkwardly
      if (
        lines[i].includes('|') &&
        i + 1 < lines.length &&
        /^\s*\|?[\s-:|]+\|?\s*$/.test(lines[i + 1])
      ) {
        break;
      }
      para.push(lines[i]);
      i += 1;
    }
    if (para.length > 0) {
      blocks.push({
        type: 'paragraph',
        children: parseInline(para.join(' ').replace(/\s+/g, ' ').trim()),
      });
    }
  }

  return blocks;
}

function detectCallout(text: string): string | null {
  const m = /^\s*\*\*(Note|Warning|Tip|Important|Caution)\*\*/i.exec(text);
  return m ? m[1].toLowerCase() : null;
}

function splitTableRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

export function parseInline(text: string): DocMdInline[] {
  const out: DocMdInline[] = [];
  // image | link | code | strong | em
  const token =
    /(!\[([^\]]*)\]\(([^)]+)\))|(\[([^\]]+)\]\(([^)]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = token.exec(text)) !== null) {
    if (m.index > last) {
      out.push({ type: 'text', value: text.slice(last, m.index) });
    }
    if (m[1]) {
      out.push({ type: 'image', alt: m[2], src: m[3] });
    } else if (m[4]) {
      out.push({
        type: 'link',
        href: m[6],
        children: parseInlineSimple(m[5]),
      });
    } else if (m[7]) {
      out.push({ type: 'code', value: m[8] });
    } else if (m[9]) {
      out.push({ type: 'strong', children: parseInlineSimple(m[10]) });
    } else if (m[11]) {
      out.push({ type: 'em', children: parseInlineSimple(m[12]) });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) });
  return out.length > 0 ? out : [{ type: 'text', value: text }];
}

/** Nested emphasis without re-entering links/images (keeps recursion shallow). */
function parseInlineSimple(text: string): DocMdInline[] {
  const out: DocMdInline[] = [];
  const token = /(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = token.exec(text)) !== null) {
    if (m.index > last) {
      out.push({ type: 'text', value: text.slice(last, m.index) });
    }
    if (m[2] != null) out.push({ type: 'code', value: m[2] });
    else if (m[4] != null) out.push({ type: 'text', value: m[4] }); // flatten nested strong
    else if (m[6] != null) out.push({ type: 'text', value: m[6] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) });
  return out.length > 0 ? out : [{ type: 'text', value: text }];
}

export function stripInlineToText(nodes: DocMdInline[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case 'text':
        case 'code':
          return n.value;
        case 'image':
          return n.alt;
        case 'strong':
        case 'em':
        case 'link':
          return stripInlineToText(n.children);
        default:
          return '';
      }
    })
    .join('');
}
