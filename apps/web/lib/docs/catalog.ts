/**
 * Loaded documentation catalog — single entry point for the IDE docs module.
 */

import { DOC_CORPUS } from './corpus.generated';
import { buildNavTree, defaultDocSlug } from './discover';
import type { DocNavTree } from './types';

let cached: DocNavTree | null = null;

export function getDocTree(): DocNavTree {
  if (!cached) {
    cached = buildNavTree(DOC_CORPUS);
  }
  return cached;
}

export function getDefaultDocSlug(): string {
  return defaultDocSlug(getDocTree());
}

/** Reset cache — test helper. */
export function resetDocTreeCache(): void {
  cached = null;
}

export { DOC_CORPUS };
