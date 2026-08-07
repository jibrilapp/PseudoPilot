import { describe, expect, it, vi } from 'vitest';
import {
  downloadPseudocode,
  downloadPython,
  downloadTextFile,
  ensureExtension,
  sanitizeDownloadBasename,
} from './workspaceDownload';

describe('workspaceDownload', () => {
  it('sanitizes unsafe path characters', () => {
    expect(sanitizeDownloadBasename('a/b:c*.pp', 'Untitled.pp')).toBe(
      'a_b_c_.pp',
    );
    expect(sanitizeDownloadBasename('   ', 'Untitled.pp')).toBe('Untitled.pp');
  });

  it('ensures the requested extension', () => {
    expect(ensureExtension('Untitled.pp', '.pp')).toBe('Untitled.pp');
    expect(ensureExtension('Untitled.pp', '.py')).toBe('Untitled.py');
    expect(ensureExtension('homework', '.pp')).toBe('homework.pp');
  });

  it('creates an anchor download for text content', () => {
    const clicked: string[] = [];
    const removed: unknown[] = [];
    const fakeA = {
      href: '',
      download: '',
      rel: '',
      style: { display: '' },
      click() {
        clicked.push(this.download);
      },
      remove() {
        removed.push(this);
      },
    };
    const fakeDoc = {
      createElement: (tag: string) => {
        expect(tag).toBe('a');
        return fakeA;
      },
      body: {
        appendChild: vi.fn(),
      },
    } as unknown as Document;

    const ok = downloadTextFile('demo.pp', 'OUTPUT 1', undefined, fakeDoc);
    expect(ok).toBe(true);
    expect(clicked).toEqual(['demo.pp']);
    expect(fakeDoc.body.appendChild).toHaveBeenCalled();
    expect(removed).toHaveLength(1);
  });

  it('maps program title to .pp / .py downloads', () => {
    const fakeA = {
      href: '',
      download: '',
      rel: '',
      style: { display: '' },
      click: vi.fn(),
      remove: vi.fn(),
    };
    const fakeDoc = {
      createElement: () => fakeA,
      body: { appendChild: vi.fn() },
    } as unknown as Document;

    downloadPseudocode('OUTPUT 1', 'Task1.pp', fakeDoc);
    expect(fakeA.download).toBe('Task1.pp');

    downloadPython('print(1)', 'Task1.pp', fakeDoc);
    expect(fakeA.download).toBe('Task1.py');
  });
});
