import type { Breakpoint } from './types';

let bpSeq = 0;

function nextId(): string {
  bpSeq += 1;
  return `bp-${bpSeq}`;
}

/**
 * Line-breakpoint store (1-based lines). React-free.
 * Future: conditional breakpoints attach a `condition` string without changing keys.
 */
export class BreakpointStore {
  private readonly byLine = new Map<number, Breakpoint>();
  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  list(): readonly Breakpoint[] {
    return [...this.byLine.values()].sort((a, b) => a.line - b.line);
  }

  get(line: number): Breakpoint | undefined {
    return this.byLine.get(line);
  }

  hasEnabled(line: number): boolean {
    const bp = this.byLine.get(line);
    return bp !== undefined && bp.enabled;
  }

  /** Toggle: none → enabled → disabled → removed. */
  toggle(line: number): Breakpoint | null {
    if (line < 1) return null;
    const existing = this.byLine.get(line);
    if (!existing) {
      const bp: Breakpoint = { id: nextId(), line, enabled: true };
      this.byLine.set(line, bp);
      this.emit();
      return bp;
    }
    if (existing.enabled) {
      const bp: Breakpoint = { ...existing, enabled: false };
      this.byLine.set(line, bp);
      this.emit();
      return bp;
    }
    this.byLine.delete(line);
    this.emit();
    return null;
  }

  setEnabled(line: number, enabled: boolean): void {
    const existing = this.byLine.get(line);
    if (!existing) return;
    if (existing.enabled === enabled) return;
    this.byLine.set(line, { ...existing, enabled });
    this.emit();
  }

  add(line: number, enabled = true): Breakpoint {
    const existing = this.byLine.get(line);
    if (existing) {
      const bp = { ...existing, enabled };
      this.byLine.set(line, bp);
      this.emit();
      return bp;
    }
    const bp: Breakpoint = { id: nextId(), line, enabled };
    this.byLine.set(line, bp);
    this.emit();
    return bp;
  }

  remove(line: number): void {
    if (!this.byLine.delete(line)) return;
    this.emit();
  }

  clear(): void {
    if (this.byLine.size === 0) return;
    this.byLine.clear();
    this.emit();
  }

  /** Fast path: no enabled breakpoints → debugger can skip line checks for Continue. */
  enabledCount(): number {
    let n = 0;
    for (const bp of this.byLine.values()) {
      if (bp.enabled) n += 1;
    }
    return n;
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}
