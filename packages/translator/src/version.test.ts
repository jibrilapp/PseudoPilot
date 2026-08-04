import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PACKAGE_NAME,
  PACKAGE_VERSION,
  TRANSLATOR_SUBSET,
} from './index.js';

const pkg = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'),
    'utf8',
  ),
) as { name: string; version: string };

describe('package version identity', () => {
  it('PACKAGE_VERSION matches package.json', () => {
    expect(PACKAGE_VERSION).toBe(pkg.version);
  });

  it('PACKAGE_NAME matches package.json', () => {
    expect(PACKAGE_NAME).toBe(pkg.name);
  });

  it('TRANSLATOR_SUBSET tags the V14 TYPE+CLASS dialect', () => {
    expect(TRANSLATOR_SUBSET).toBe(
      'v14-assign-io-expr-control-procedure-function-declare-check-builtins-files-type-class',
    );
  });
});
