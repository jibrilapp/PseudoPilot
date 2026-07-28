import type {
  FrameSnapshot,
  VariableSnapshot,
} from '@pseudopilot/interpreter';
import type { RuntimeVariableRow } from './types';

export function mapFrameVariables(
  globals: readonly VariableSnapshot[],
  callStack: readonly FrameSnapshot[],
): { rows: RuntimeVariableRow[]; frameName: string | null } {
  const top = callStack[0];
  const inRoutine = top && top.kind !== 'global';
  const frameName = inRoutine ? top.name : null;

  const rows: RuntimeVariableRow[] = [];

  for (const g of globals) {
    rows.push(toRow(g, scopeFromKind(g.kind, 'global')));
  }

  if (inRoutine) {
    for (const v of top.variables) {
      // Locals/params only (globals already listed from globals snapshot).
      if (v.kind === 'parameter' || v.kind === 'variable' || v.kind === 'constant') {
        // Avoid duplicating names that are only on the local env.
        const already = rows.some(
          (r) => r.name.toLowerCase() === v.name.toLowerCase() && r.scope === 'global',
        );
        // Shadow: show local row even if same name exists globally.
        rows.push(
          toRow(
            v,
            scopeFromKind(v.kind, 'local'),
          ),
        );
        void already;
      }
    }
  }

  return { rows, frameName };
}

function scopeFromKind(
  kind: string,
  fallback: 'global' | 'local',
): RuntimeVariableRow['scope'] {
  if (kind === 'constant') return 'constant';
  if (kind === 'parameter') return 'parameter';
  return fallback;
}

function toRow(
  v: VariableSnapshot,
  scope: RuntimeVariableRow['scope'],
): RuntimeVariableRow {
  return {
    name: v.name,
    type: v.typeName,
    value: v.value,
    kind: v.kind,
    scope,
  };
}
