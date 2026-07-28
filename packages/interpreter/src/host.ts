/**
 * Pluggable I/O for the Cambridge interpreter.
 *
 * Web IDE, Vitest, and future CLI all implement this — never hardcode console.
 *
 * Host methods may return values synchronously or via Promise. The interpreter
 * awaits both. Browser INPUT should return a Promise that resolves when the
 * student submits a line in the Console.
 *
 * File I/O goes through {@link FileSystemHost} (virtual by default) — never the
 * real OS filesystem from the interpreter core.
 */
import { VirtualFileSystem, type FileSystemHost } from './files/VirtualFileSystem.js';
import { runtimeFail } from './value.js';

export type { FileSystemHost };

export interface RuntimeHost {
  /** Read one INPUT line (sync or async). */
  readInput(prompt?: string): string | Promise<string>;
  /** Write one OUTPUT line (values already joined by the interpreter). */
  writeOutput(line: string): void | Promise<void>;
  /**
   * Optional file backend. When omitted, the interpreter attaches an ephemeral
   * {@link VirtualFileSystem} for the run. IDE/cloud can inject a persistent host.
   */
  readonly files?: FileSystemHost;
}

/** Optional seedable RNG for RAND (tests / deterministic demos). */
export interface RandomSource {
  /** Pseudo-random REAL in [0, 1). */
  next(): number;
}

/** In-memory host for tests and headless runs (includes a VirtualFileSystem). */
export class MemoryHost implements RuntimeHost {
  readonly outputs: string[] = [];
  readonly files: VirtualFileSystem = new VirtualFileSystem();
  private inputIndex = 0;

  constructor(private readonly inputs: readonly string[] = []) {}

  readInput(prompt?: string): string {
    void prompt;
    if (this.inputIndex >= this.inputs.length) {
      throw runtimeFail(
        'R_INPUT',
        'No more INPUT values available in MemoryHost.',
      );
    }
    return this.inputs[this.inputIndex++]!;
  }

  writeOutput(line: string): void {
    this.outputs.push(line);
  }
}

/** Deterministic LCG for RAND in tests (not cryptographic). */
export class SeededRandom implements RandomSource {
  private state: number;

  constructor(seed = 1) {
    this.state = seed >>> 0 || 1;
  }

  next(): number {
    // Numerical Recipes LCG
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
}

/** Math.random()-backed RNG for interactive runs. */
export const defaultRandom: RandomSource = {
  next: () => Math.random(),
};
