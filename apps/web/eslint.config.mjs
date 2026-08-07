import base from '../../packages/eslint-config/base.js';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...base,
  {
    ignores: [
      '.next/**',
      'next-env.d.ts',
      'postcss.config.js',
      'tailwind.config.js',
      'lib/docs/corpus.generated.ts',
    ],
  },
];
