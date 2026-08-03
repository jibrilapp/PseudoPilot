/**
 * Serialize interpreter frame state into compact wire variables.
 * Only called on pause / step complete / program finished — never every step.
 */

import {
  formatValue,
  type StackFrame,
  type VariableSnapshot,
  type FrameSnapshot,
} from '@pseudopilot/interpreter';
import type { WireVariable } from './protocol';

export function scopeOf(
  kind: string,
  fallback: 'global' | 'local',
): WireVariable['scope'] {
  if (kind === 'constant') return 'constant';
  if (kind === 'parameter') return 'parameter';
  return fallback;
}

/** Snapshot variables visible at a pause (current frame + globals). */
export function snapshotVariablesFromFrame(frame: StackFrame): WireVariable[] {
  const rows: WireVariable[] = [];
  if (frame.kind === 'global') {
    for (const b of frame.env.snapshot().values()) {
      rows.push({
        name: b.name,
        type: b.typeName,
        value: formatValue(b.value),
        kind: b.kind,
        scope: scopeOf(b.kind, 'global'),
      });
    }
    return rows;
  }

  const parent = frame.env.parent;
  if (parent) {
    for (const b of parent.snapshot().values()) {
      rows.push({
        name: b.name,
        type: b.typeName,
        value: formatValue(b.value),
        kind: b.kind,
        scope: scopeOf(b.kind, 'global'),
      });
    }
  }
  for (const b of frame.env.snapshot().values()) {
    rows.push({
      name: b.name,
      type: b.typeName,
      value: formatValue(b.value),
      kind: b.kind,
      scope: scopeOf(b.kind, 'local'),
    });
  }
  return rows;
}

export function snapshotFromRunResult(
  globals: readonly VariableSnapshot[],
  callStack: readonly FrameSnapshot[],
): { variables: WireVariable[]; frameName: string | null } {
  const rows: WireVariable[] = [];
  for (const g of globals) {
    rows.push({
      name: g.name,
      type: g.typeName,
      value: g.value,
      kind: g.kind,
      scope: scopeOf(g.kind, 'global'),
    });
  }
  const top = callStack[0];
  if (top && top.kind !== 'global') {
    for (const v of top.variables) {
      rows.push({
        name: v.name,
        type: v.typeName,
        value: v.value,
        kind: v.kind,
        scope: scopeOf(v.kind, 'local'),
      });
    }
    return { variables: rows, frameName: top.name };
  }
  return { variables: rows, frameName: null };
}

export type WorkerSnapshotSerializer = {
  fromFrame: typeof snapshotVariablesFromFrame;
  fromRunResult: typeof snapshotFromRunResult;
};

export const WorkerSnapshotSerializer: WorkerSnapshotSerializer = {
  fromFrame: snapshotVariablesFromFrame,
  fromRunResult: snapshotFromRunResult,
};
