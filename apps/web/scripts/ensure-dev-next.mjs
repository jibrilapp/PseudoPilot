#!/usr/bin/env node
/**
 * Drop a production `next build` output before `next dev`.
 *
 * If dev runs against a stale production `.next`, the page references
 * `/_next/static/css/app/layout.css` while only hashed production CSS exists,
 * so the browser renders unstyled HTML.
 */
/* global console */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nextDir = path.join(webRoot, '.next');
const buildIdPath = path.join(nextDir, 'BUILD_ID');

if (fs.existsSync(buildIdPath)) {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log('Removed production .next output before starting the dev server.');
}
