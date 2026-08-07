import { describe, expect, it } from 'vitest';
import { formatConsoleTimestamp, parseCoachMarkdown } from './coachMarkdown';

describe('parseCoachMarkdown', () => {
  it('parses paragraphs and inline emphasis', () => {
    const nodes = parseCoachMarkdown(
      'Hello **world** and `x` with *care*.',
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ type: 'paragraph' });
    if (nodes[0].type !== 'paragraph') throw new Error('expected paragraph');
    expect(nodes[0].children).toEqual([
      { type: 'text', value: 'Hello ' },
      { type: 'strong', value: 'world' },
      { type: 'text', value: ' and ' },
      { type: 'code', value: 'x' },
      { type: 'text', value: ' with ' },
      { type: 'em', value: 'care' },
      { type: 'text', value: '.' },
    ]);
  });

  it('extracts fenced code blocks with language', () => {
    const nodes = parseCoachMarkdown(
      'Before\n\n```pseudocode\nDECLARE X : INTEGER\n```\n\nAfter',
    );
    expect(nodes.map((n) => n.type)).toEqual([
      'paragraph',
      'code',
      'paragraph',
    ]);
    expect(nodes[1]).toEqual({
      type: 'code',
      lang: 'pseudocode',
      value: 'DECLARE X : INTEGER',
    });
  });
});

describe('formatConsoleTimestamp', () => {
  it('formats HH:MM:SS', () => {
    const ms = Date.UTC(2026, 0, 1, 14, 5, 9);
    // Local timezone dependent — assert shape only via fixed local construction.
    const local = new Date(2026, 5, 1, 9, 8, 7).getTime();
    expect(formatConsoleTimestamp(local)).toBe('09:08:07');
    expect(formatConsoleTimestamp(ms).length).toBe(8);
  });
});
