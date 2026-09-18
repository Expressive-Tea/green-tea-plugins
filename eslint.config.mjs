import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { '@stylistic': stylistic },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: 'multiline-block-like', next: '*' },
        { blankLine: 'always', prev: '*', next: 'multiline-block-like' },
      ],
    },
  },
  {
    // Rule 8 of the convention. A value import of core makes the published plugin need core at
    // runtime, and no semver range accepts next month's CalVer beta — not even `*` — so every
    // install would warn. Tests are exempt: they drive the real createApp on purpose.
    files: ['packages/*/src/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@green-tea/core',
              message: 'Plugins import core as types only: `import type { … } from "@green-tea/core"`.',
              allowTypeImports: true,
            },
          ],
        },
      ],
      'no-console': 'error',
    },
  },
);
