/**
 * Download helpers for the single-program IDE (no project/VFS).
 */

export function sanitizeDownloadBasename(name: string, fallback: string): string {
  const trimmed = name.trim().replace(/[/\\?%*:|"<>]/g, '_');
  if (!trimmed) return fallback;
  return trimmed.slice(0, 120);
}

export function ensureExtension(basename: string, ext: string): string {
  const lower = basename.toLowerCase();
  const needle = ext.toLowerCase();
  if (lower.endsWith(needle)) return basename;
  // Strip a conflicting trailing extension so Untitled.pp → Untitled.py works.
  const withoutExt = basename.replace(/\.[A-Za-z0-9]+$/, '');
  return `${withoutExt || basename}${ext}`;
}

/**
 * Trigger a browser download of a UTF-8 text file.
 * Injectable `document` for unit tests.
 */
export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = 'text/plain;charset=utf-8',
  doc: Document | null | undefined = typeof document !== 'undefined'
    ? document
    : null,
): boolean {
  if (!doc) return false;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  doc.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on next tick so the download can start.
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}

export function downloadPseudocode(
  source: string,
  title = 'Untitled.pp',
  doc?: Document | null,
): boolean {
  const name = ensureExtension(
    sanitizeDownloadBasename(title, 'Untitled.pp'),
    '.pp',
  );
  return downloadTextFile(name, source, 'text/plain;charset=utf-8', doc);
}

export function downloadPython(
  source: string,
  title = 'Untitled.pp',
  doc?: Document | null,
): boolean {
  const name = ensureExtension(
    sanitizeDownloadBasename(title, 'Untitled.py'),
    '.py',
  );
  return downloadTextFile(name, source, 'text/x-python;charset=utf-8', doc);
}
