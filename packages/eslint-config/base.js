import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

/** Shared ESLint baseline — TypeScript-aware, no framework-specific rules yet. */
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['**/dist/**', '**/.next/**', '**/.next-prod/**', '**/coverage/**', '**/node_modules/**'],
  },
);
