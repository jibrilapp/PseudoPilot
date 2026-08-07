import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

const DOCS_ROOT = path.resolve(process.cwd(), '../../docs');

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
};

/**
 * Serve static assets referenced from documentation markdown
 * (e.g. screenshots under docs/ide/screenshots/).
 */
export async function GET(req: NextRequest) {
  const rel = req.nextUrl.searchParams.get('path');
  if (!rel || rel.includes('\0')) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 });
  }
  const normalized = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
  const abs = path.resolve(DOCS_ROOT, normalized);
  if (!abs.startsWith(DOCS_ROOT + path.sep) && abs !== DOCS_ROOT) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const ext = path.extname(abs).toLowerCase();
  const type = MIME[ext] ?? 'application/octet-stream';
  const buf = fs.readFileSync(abs);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
