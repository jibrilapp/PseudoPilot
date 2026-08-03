/**
 * Document dependency graph for future multi-file projects.
 *
 * Today Cambridge programs are single-file; edges are recorded so
 * invalidation can fan out when imports land without redesign.
 */

export type DocumentUri = string;

/**
 * Tracks `uri → documents it depends on` and reverse dependents.
 * When A changes, invalidate A then every document that depends on A.
 */
export class DependencyGraph {
  /** uri → set of uris this document imports / depends on */
  private readonly deps = new Map<DocumentUri, Set<DocumentUri>>();
  /** uri → set of uris that depend on this document */
  private readonly dependents = new Map<DocumentUri, Set<DocumentUri>>();

  /** Replace the dependency list for `uri`. */
  setDependencies(uri: DocumentUri, dependencies: readonly DocumentUri[]): void {
    const prev = this.deps.get(uri);
    if (prev) {
      for (const d of prev) {
        const set = this.dependents.get(d);
        if (!set) continue;
        set.delete(uri);
        if (set.size === 0) this.dependents.delete(d);
      }
    }
    const next = new Set(dependencies.filter((d) => d !== uri));
    if (next.size === 0) {
      this.deps.delete(uri);
    } else {
      this.deps.set(uri, next);
    }
    for (const d of next) {
      let set = this.dependents.get(d);
      if (!set) {
        set = new Set();
        this.dependents.set(d, set);
      }
      set.add(uri);
    }
  }

  getDependencies(uri: DocumentUri): readonly DocumentUri[] {
    return [...(this.deps.get(uri) ?? [])];
  }

  getDependents(uri: DocumentUri): readonly DocumentUri[] {
    return [...(this.dependents.get(uri) ?? [])];
  }

  /**
   * BFS of all transitive dependents of `uri` (not including `uri`).
   * Order is breadth-first — suitable for invalidation fan-out.
   */
  transitiveDependents(uri: DocumentUri): DocumentUri[] {
    const out: DocumentUri[] = [];
    const seen = new Set<DocumentUri>([uri]);
    const queue = [...this.getDependents(uri)];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      out.push(cur);
      queue.push(...this.getDependents(cur));
    }
    return out;
  }

  remove(uri: DocumentUri): void {
    // Drop outgoing edges (and prune empty reverse sets).
    this.setDependencies(uri, []);
    this.deps.delete(uri);
    // Drop incoming edges: others must no longer depend on removed uri.
    const incoming = this.dependents.get(uri);
    if (incoming) {
      for (const d of [...incoming]) {
        const deps = this.deps.get(d);
        if (!deps) continue;
        deps.delete(uri);
        if (deps.size === 0) this.deps.delete(d);
      }
      this.dependents.delete(uri);
    }
  }

  /** Test / diagnostics: true when no adjacency entries remain. */
  isEmpty(): boolean {
    return this.deps.size === 0 && this.dependents.size === 0;
  }

  clear(): void {
    this.deps.clear();
    this.dependents.clear();
  }
}
