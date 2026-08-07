import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.bench.ts'],
    // Default; stress.bench.ts overrides per-case (up to 180s).
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
