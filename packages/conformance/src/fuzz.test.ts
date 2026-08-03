import { describe, expect, it } from 'vitest';
import { parse } from '@pseudopilot/language-core';
import { check } from '@pseudopilot/checker';
import {
  translatePseudocodeToPython,
  translatePythonToPseudocode,
} from '@pseudopilot/translator';
import { runPseudocode, MemoryHost } from '@pseudopilot/interpreter';
import { IncrementalCompiler } from '@pseudopilot/compiler-service';
import { LanguageService } from '@pseudopilot/language-service';

/**
 * Lightweight fuzzing: random valid-ish and invalid programs must not crash
 * the pipeline or hang (bounded by maxSteps).
 */

const KEYWORDS = [
  'DECLARE',
  'CONSTANT',
  'IF',
  'THEN',
  'ELSE',
  'ENDIF',
  'WHILE',
  'ENDWHILE',
  'FOR',
  'TO',
  'NEXT',
  'REPEAT',
  'UNTIL',
  'CASE',
  'OF',
  'OTHERWISE',
  'ENDCASE',
  'PROCEDURE',
  'ENDPROCEDURE',
  'FUNCTION',
  'ENDFUNCTION',
  'RETURNS',
  'RETURN',
  'CALL',
  'OUTPUT',
  'INPUT',
  'INTEGER',
  'STRING',
  'BOOLEAN',
  'TRUE',
  'FALSE',
] as const;

const IDENTS = ['A', 'B', 'X', 'Y', 'N', 'Count', 'Flag', 'Temp'] as const;

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function randomJunk(rng: () => number, lines: number): string {
  const out: string[] = [];
  for (let i = 0; i < lines; i += 1) {
    const roll = rng();
    if (roll < 0.25) {
      out.push(`${pick(rng, KEYWORDS)} ${pick(rng, IDENTS)}`);
    } else if (roll < 0.5) {
      out.push(`OUTPUT ${Math.floor(rng() * 100)}`);
    } else if (roll < 0.75) {
      out.push(`${pick(rng, IDENTS)} ← ${Math.floor(rng() * 10)}`);
    } else {
      out.push(pick(rng, KEYWORDS));
    }
  }
  return out.join('\n') + '\n';
}

function randomValidish(rng: () => number): string {
  const n = pick(rng, IDENTS);
  const v = Math.floor(rng() * 20);
  const templates = [
    `DECLARE ${n} : INTEGER\n${n} ← ${v}\nOUTPUT ${n}\n`,
    `CONSTANT K = ${v}\nOUTPUT K\n`,
    `DECLARE ${n} : INTEGER\nIF ${v} > 0 THEN\n  OUTPUT ${v}\nENDIF\n`,
    `DECLARE I : INTEGER\nFOR I ← 1 TO ${1 + (v % 5)}\n  OUTPUT I\nNEXT I\n`,
    `OUTPUT LENGTH("fuzz")\n`,
  ];
  return pick(rng, templates);
}

describe('conformance / fuzz', () => {
  it('junk programs: parse/check/translate never throw', () => {
    const rng = mulberry32(0xc0ffee);
    for (let i = 0; i < 40; i += 1) {
      const src = randomJunk(rng, 3 + Math.floor(rng() * 6));
      expect(() => parse(src)).not.toThrow();
      const parsed = parse(src);
      expect(() => check(parsed.ast)).not.toThrow();
      expect(() => translatePseudocodeToPython(src)).not.toThrow();
      expect(() => translatePythonToPseudocode(src)).not.toThrow();
    }
  });

  it('valid-ish programs: run with step limit never hangs', async () => {
    const rng = mulberry32(0xbad5eed);
    for (let i = 0; i < 25; i += 1) {
      const src = randomValidish(rng);
      const host = new MemoryHost(['1', '2', '3']);
      const result = await runPseudocode(src, { host, maxSteps: 50_000 });
      // ok or soft failure — but must terminate
      expect(result.steps).toBeLessThanOrEqual(50_000);
      expect(Array.isArray(result.diagnostics)).toBe(true);
    }
  });

  it('compiler + language service tolerate junk edits', () => {
    const rng = mulberry32(42);
    const c = new IncrementalCompiler();
    const ls = new LanguageService({ compiler: c });
    const uri = 'file:///fuzz.pseudo';
    ls.openDocument(uri, 'OUTPUT 1\n', 1);
    for (let v = 2; v <= 30; v += 1) {
      const src = rng() < 0.5 ? randomValidish(rng) : randomJunk(rng, 4);
      expect(() => ls.updateDocument(uri, src, v)).not.toThrow();
      expect(() => ls.diagnostics(uri)).not.toThrow();
      expect(() => ls.completion(uri, { line: 0, character: 0 })).not.toThrow();
    }
    ls.closeDocument(uri);
  });

  it('diagnostics are stable for identical junk', () => {
    const src = randomJunk(mulberry32(7), 5);
    const a = check(parse(src).ast).diagnostics.map((d) => d.code);
    const b = check(parse(src).ast).diagnostics.map((d) => d.code);
    expect(a).toEqual(b);
  });
});
