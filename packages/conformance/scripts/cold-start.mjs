#!/usr/bin/env node
/**
 * Cold-start timing: spawn a fresh Node process per package import.
 * Writes JSON to stdout for PERFORMANCE_AND_STABILITY.md capture.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function distEntry(pkgDir) {
  return pathToFileURL(path.join(root, 'packages', pkgDir, 'dist', 'index.js')).href;
}

const packages = [
  ['@pseudopilot/language-core', 'language-core'],
  ['@pseudopilot/checker', 'checker'],
  ['@pseudopilot/translator', 'translator'],
  ['@pseudopilot/interpreter', 'interpreter'],
  ['@pseudopilot/compiler-service', 'compiler-service'],
];

const results = [];

for (const [pkg, dir] of packages) {
  const entry = distEntry(dir);
  const script = `
    const t0 = performance.now();
    await import(${JSON.stringify(entry)});
    const ms = performance.now() - t0;
    console.log(JSON.stringify({ pkg: ${JSON.stringify(pkg)}, coldImportMs: +ms.toFixed(3) }));
  `;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8',
    cwd: root,
    env: process.env,
  });
  if (r.status !== 0) {
    results.push({
      pkg,
      pass: false,
      error: (r.stderr || r.stdout || 'spawn failed').slice(0, 800),
    });
    continue;
  }
  const line = r.stdout.trim().split('\n').filter(Boolean).pop();
  try {
    results.push({ ...JSON.parse(line), pass: true });
  } catch {
    results.push({ pkg, pass: false, error: r.stdout });
  }
}

const lc = distEntry('language-core');
const ch = distEntry('checker');
const tr = distEntry('translator');
const ir = distEntry('interpreter');

const pipelineScript = `
  const t0 = performance.now();
  const { parse } = await import(${JSON.stringify(lc)});
  const { check } = await import(${JSON.stringify(ch)});
  const { translatePseudocodeToPython } = await import(${JSON.stringify(tr)});
  const { runPseudocode, MemoryHost } = await import(${JSON.stringify(ir)});
  const src = 'OUTPUT 1';
  const p = parse(src);
  check(p.ast);
  translatePseudocodeToPython(src);
  await runPseudocode(src, { host: new MemoryHost() });
  console.log(JSON.stringify({ scenario: 'cold-hello-pipeline', ms: +(performance.now() - t0).toFixed(3), pass: true }));
`;

const pipe = spawnSync(process.execPath, ['--input-type=module', '-e', pipelineScript], {
  encoding: 'utf8',
  cwd: root,
  env: process.env,
});

let pipeline;
if (pipe.status === 0) {
  try {
    pipeline = JSON.parse(pipe.stdout.trim().split('\n').filter(Boolean).pop());
  } catch {
    pipeline = { pass: false, error: pipe.stdout };
  }
} else {
  pipeline = { pass: false, error: (pipe.stderr || pipe.stdout || '').slice(0, 800) };
}

console.log(
  JSON.stringify(
    {
      kind: 'cold-start',
      node: process.version,
      platform: `${process.platform}/${process.arch}`,
      packages: results,
      pipeline,
    },
    null,
    2,
  ),
);
