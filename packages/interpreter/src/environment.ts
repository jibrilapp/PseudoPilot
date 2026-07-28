import { identKey } from '@pseudopilot/checker';
import type { TypeNameKind } from '@pseudopilot/language-core';
import type { Binding, BindingKind, RuntimeValue } from './value.js';
import { runtimeFail } from './value.js';

/**
 * Lexical environment / variable store (case-insensitive keys).
 * Parent chain: local → … → global.
 */
export class Environment {
  private readonly bindings = new Map<string, Binding>();

  constructor(readonly parent: Environment | null = null) {}

  define(
    name: string,
    kind: BindingKind,
    typeName: TypeNameKind | 'ARRAY',
    value: RuntimeValue,
  ): void {
    const key = identKey(name);
    if (this.bindings.has(key)) {
      throw runtimeFail(
        'R_DUP_BINDING',
        `Duplicate binding '${name}' in this scope.`,
      );
    }
    this.bindings.set(key, { name, kind, typeName, value });
  }

  /** Look up binding walking parents (Cambridge case-insensitive). */
  lookup(name: string): Binding | undefined {
    const key = identKey(name);
    const local = this.bindings.get(key);
    if (local) return local;
    return this.parent?.lookup(name);
  }

  /** Assign to an existing variable/parameter (not CONSTANT). */
  assign(name: string, value: RuntimeValue): void {
    const b = this.lookup(name);
    if (!b) {
      throw runtimeFail('R_UNDECL', `Undeclared identifier '${name}'.`);
    }
    if (b.kind === 'constant') {
      throw runtimeFail(
        'R_ASSIGN_CONSTANT',
        `Cannot assign to CONSTANT '${b.name}'.`,
      );
    }
    b.value = value;
  }

  /** Snapshot for debugger / variables panel (this frame only). */
  snapshot(): ReadonlyMap<string, Binding> {
    return new Map(this.bindings);
  }

  /** Flatten visible bindings (inner shadows outer). */
  visibleSnapshot(): Map<string, Binding> {
    const out = new Map<string, Binding>();
    this.collectVisible(out);
    return out;
  }

  private collectVisible(out: Map<string, Binding>): void {
    this.parent?.collectVisible(out);
    for (const [k, b] of this.bindings) {
      out.set(k, b);
    }
  }
}
