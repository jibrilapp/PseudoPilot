/**
 * Load Cambridge Regression Suite fixtures from `packages/conformance/corpus/`.
 *
 * Layout per entry:
 *   corpus/<category>/<id>/
 *     program.pp          — Pseudocode source
 *     meta.json           — title, tags, expectOutput, diagnostics, reverse policy
 *     expect.python       — optional gold Python translation
 *     expect.reverse.pp   — optional gold reverse Pseudocode
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CORPUS_CATEGORIES,
  type CorpusCategory,
  type CorpusEntry,
  type CorpusMetaFile,
} from './types.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Package root whether running from `src/corpus` or `dist/corpus`. */
export function corpusPackageRoot(): string {
  // src/corpus → ../.. ; dist/corpus → ../..
  return join(HERE, '../..');
}

export function corpusRoot(): string {
  return join(corpusPackageRoot(), 'corpus');
}

function isCategory(name: string): name is CorpusCategory {
  return (CORPUS_CATEGORIES as readonly string[]).includes(name);
}

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

function loadEntry(category: CorpusCategory, id: string, dir: string): CorpusEntry {
  const programPath = join(dir, 'program.pp');
  const metaPath = join(dir, 'meta.json');
  if (!existsSync(programPath) || !existsSync(metaPath)) {
    throw new Error(`Corpus entry ${category}/${id} missing program.pp or meta.json`);
  }

  const meta = JSON.parse(readText(metaPath)) as CorpusMetaFile;
  if (!meta.title || typeof meta.title !== 'string') {
    throw new Error(`Corpus entry ${category}/${id} meta.json requires string title`);
  }

  const expectPythonPath = join(dir, 'expect.python');
  const expectReversePath = join(dir, 'expect.reverse.pp');

  const expectClean = meta.expectClean !== false;
  const reverse: NonNullable<CorpusEntry['reverse']> =
    meta.reverse ??
    (meta.skipRoundTrip ? 'skip' : expectClean ? 'check' : 'skip');

  return {
    id,
    title: meta.title,
    category,
    source: normalizeNewlines(readText(programPath)),
    ...(meta.expectOutput ? { expectOutput: meta.expectOutput } : {}),
    ...(meta.inputs ? { inputs: meta.inputs } : {}),
    expectDiagnostics: meta.expectDiagnostics ?? [],
    ...(existsSync(expectPythonPath)
      ? { expectPython: normalizeNewlines(readText(expectPythonPath)) }
      : {}),
    ...(existsSync(expectReversePath)
      ? { expectReverse: normalizeNewlines(readText(expectReversePath)) }
      : {}),
    skipRun: meta.skipRun ?? !expectClean,
    expectClean,
    skipRoundTrip: reverse === 'skip' || meta.skipRoundTrip === true,
    reverse,
    ...(meta.reverseSkipReason
      ? { reverseSkipReason: meta.reverseSkipReason }
      : {}),
    tags: meta.tags ?? [category],
    ...(meta.notes ? { notes: meta.notes } : {}),
    fixtureDir: dir,
  };
}

/**
 * Discover and load every fixture under `corpus/`.
 * Categories without entries are allowed (empty) but preferred against.
 */
export function loadCorpusFromDisk(root: string = corpusRoot()): readonly CorpusEntry[] {
  if (!existsSync(root)) {
    throw new Error(`Corpus root missing: ${root}`);
  }

  const entries: CorpusEntry[] = [];
  const seen = new Set<string>();

  for (const categoryName of readdirSync(root, { withFileTypes: true })) {
    if (!categoryName.isDirectory()) continue;
    if (categoryName.name.startsWith('.')) continue;
    if (!isCategory(categoryName.name)) {
      throw new Error(
        `Unknown corpus category folder "${categoryName.name}". Expected one of: ${CORPUS_CATEGORIES.join(', ')}`,
      );
    }
    const category = categoryName.name;
    const catDir = join(root, category);
    for (const entryDir of readdirSync(catDir, { withFileTypes: true })) {
      if (!entryDir.isDirectory()) continue;
      if (entryDir.name.startsWith('.')) continue;
      const id = entryDir.name;
      if (seen.has(id)) {
        throw new Error(`Duplicate corpus id "${id}" (must be unique across categories)`);
      }
      seen.add(id);
      entries.push(loadEntry(category, id, join(catDir, id)));
    }
  }

  entries.sort((a, b) => {
    const ca = CORPUS_CATEGORIES.indexOf(a.category);
    const cb = CORPUS_CATEGORIES.indexOf(b.category);
    if (ca !== cb) return ca - cb;
    return a.id.localeCompare(b.id);
  });

  return entries;
}

export function corpusStats(entries: readonly CorpusEntry[]): {
  readonly total: number;
  readonly byCategory: Readonly<Record<CorpusCategory, number>>;
  readonly withPython: number;
  readonly withReverse: number;
  readonly reverseSkip: number;
  readonly diagnosticFixtures: number;
  readonly runnable: number;
} {
  const byCategory = Object.fromEntries(
    CORPUS_CATEGORIES.map((c) => [c, 0]),
  ) as Record<CorpusCategory, number>;
  let withPython = 0;
  let withReverse = 0;
  let reverseSkip = 0;
  let diagnosticFixtures = 0;
  let runnable = 0;

  for (const e of entries) {
    byCategory[e.category] += 1;
    if (e.expectPython) withPython += 1;
    if (e.expectReverse) withReverse += 1;
    if (e.reverse === 'skip') reverseSkip += 1;
    if (e.expectClean === false) diagnosticFixtures += 1;
    if (!e.skipRun && e.expectOutput) runnable += 1;
  }

  return {
    total: entries.length,
    byCategory,
    withPython,
    withReverse,
    reverseSkip,
    diagnosticFixtures,
    runnable,
  };
}
