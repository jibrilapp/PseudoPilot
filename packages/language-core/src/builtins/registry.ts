/**
 * Cambridge 9618 Core builtin registry (language truth).
 *
 * Soft-reserved: names parse as Identifiers / CallExpressions.
 * Checker injects signatures; translator owns Python emission separately
 * (`@pseudopilot/translator` builtins/emit.ts) so language-core stays
 * language-neutral.
 *
 * Exam-insert packs can extend later without changing walker logic.
 */

import type { TypeNameKind } from '../ast/nodes.js';

/** Accepted scalar type(s) for one parameter. */
export type BuiltinParamSpec = {
  readonly name: string;
  readonly accept: readonly TypeNameKind[];
};

export type BuiltinSpec = {
  readonly name: string;
  readonly params: readonly BuiltinParamSpec[];
  /**
   * Fixed return type, or `same-as-arg0` for LCASE/UCASE
   * (CHAR→CHAR, STRING→STRING).
   */
  readonly returns: TypeNameKind | 'same-as-arg0';
  /** Short help for diagnostics / docs. */
  readonly summary: string;
};

/**
 * Fixed Core builtins.
 * LEFT is PseudoPilot Core (common exam insert; not in teacher-guide index).
 * RAND returns REAL per Cambridge guide (`[0, x)`).
 *
 * Soft extensions vs teacher guide (documented in SEMANTICS.md):
 * - LENGTH / LEFT / RIGHT / MID accept CHAR as well as STRING
 * - LCASE / UCASE accept STRING as well as CHAR
 */
export const CORE_BUILTINS: readonly BuiltinSpec[] = [
  {
    name: 'LENGTH',
    params: [{ name: 'ThisString', accept: ['STRING', 'CHAR'] }],
    returns: 'INTEGER',
    summary: 'Character count of a string.',
  },
  {
    name: 'LEFT',
    params: [
      { name: 'ThisString', accept: ['STRING', 'CHAR'] },
      { name: 'x', accept: ['INTEGER'] },
    ],
    returns: 'STRING',
    summary: 'Leftmost x characters (PseudoPilot Core / common exam insert).',
  },
  {
    name: 'RIGHT',
    params: [
      { name: 'ThisString', accept: ['STRING', 'CHAR'] },
      { name: 'x', accept: ['INTEGER'] },
    ],
    returns: 'STRING',
    summary: 'Rightmost x characters.',
  },
  {
    name: 'MID',
    params: [
      { name: 'ThisString', accept: ['STRING', 'CHAR'] },
      { name: 'x', accept: ['INTEGER'] },
      { name: 'y', accept: ['INTEGER'] },
    ],
    returns: 'STRING',
    summary: 'Substring of length y from 1-based position x.',
  },
  {
    name: 'LCASE',
    params: [{ name: 'ThisChar', accept: ['CHAR', 'STRING'] }],
    returns: 'same-as-arg0',
    summary: 'Lower-case (CHAR→CHAR or STRING→STRING).',
  },
  {
    name: 'UCASE',
    params: [{ name: 'ThisChar', accept: ['CHAR', 'STRING'] }],
    returns: 'same-as-arg0',
    summary: 'Upper-case (CHAR→CHAR or STRING→STRING).',
  },
  {
    name: 'INT',
    params: [{ name: 'x', accept: ['REAL', 'INTEGER'] }],
    returns: 'INTEGER',
    summary: 'Truncate toward zero (integer part).',
  },
  {
    name: 'RAND',
    params: [{ name: 'x', accept: ['INTEGER'] }],
    returns: 'REAL',
    summary: 'Pseudo-random REAL in [0, x).',
  },
  // Cambridge Paper 2 insert — DATE helpers (dd/mm/yyyy).
  {
    name: 'DAY',
    params: [{ name: 'ThisDate', accept: ['DATE'] }],
    returns: 'INTEGER',
    summary: 'Day number from a DATE.',
  },
  {
    name: 'MONTH',
    params: [{ name: 'ThisDate', accept: ['DATE'] }],
    returns: 'INTEGER',
    summary: 'Month number from a DATE.',
  },
  {
    name: 'YEAR',
    params: [{ name: 'ThisDate', accept: ['DATE'] }],
    returns: 'INTEGER',
    summary: 'Year number from a DATE.',
  },
  {
    name: 'DAYINDEX',
    params: [{ name: 'ThisDate', accept: ['DATE'] }],
    returns: 'INTEGER',
    summary: 'Weekday index from a DATE (Sunday = 1 … Saturday = 7).',
  },
  {
    name: 'SETDATE',
    params: [
      { name: 'Day', accept: ['INTEGER'] },
      { name: 'Month', accept: ['INTEGER'] },
      { name: 'Year', accept: ['INTEGER'] },
    ],
    returns: 'DATE',
    summary: 'Construct a DATE from day, month, year.',
  },
  {
    name: 'TODAY',
    params: [],
    returns: 'DATE',
    summary: 'Current calendar DATE.',
  },
] as const;

const BY_KEY: ReadonlyMap<string, BuiltinSpec> = new Map(
  CORE_BUILTINS.map((b) => [b.name.toLowerCase(), b]),
);

export function lookupBuiltin(name: string): BuiltinSpec | undefined {
  return BY_KEY.get(name.toLowerCase());
}

export function isBuiltinName(name: string): boolean {
  return BY_KEY.has(name.toLowerCase());
}

export function allBuiltinNames(): readonly string[] {
  return CORE_BUILTINS.map((b) => b.name);
}
