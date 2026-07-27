import { describe, expect, it } from 'vitest';
import { CORE_BUILTINS, allBuiltinNames } from '@pseudopilot/language-core';
import { tryPrintBuiltinPython } from './emit.js';
import type { IrExpression } from '../ir/nodes.js';

describe('builtin Python emit coverage', () => {
  it('has an emit strategy for every CORE_BUILTIN', () => {
    const printExpr = (e: IrExpression) =>
      e.kind === 'IrIdentifier' ? e.name : '?';
    for (const name of allBuiltinNames()) {
      const spec = CORE_BUILTINS.find((b) => b.name === name)!;
      const args: IrExpression[] = spec.params.map((_, i) => ({
        kind: 'IrIdentifier',
        name: `a${i}`,
      }));
      const out = tryPrintBuiltinPython(name, args, printExpr);
      expect(out, `missing Python emit for ${name}`).not.toBeNull();
    }
  });
});
