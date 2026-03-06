import eslint from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
  // Global ignores (migrated from .eslintignore)
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'uploads/**',
      '**/*.test.js',
      '**/*.spec.js',
      '**/test/**',
      'data_migration/**',
      'seed/**',
      'migrations/**',
    ],
  },

  eslint.configs.recommended,
  prettierConfig,

  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: {
      prettier,
    },
    rules: {
      'prettier/prettier': 'warn',
      'no-console': 'off',
      'no-debugger': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-constant-binary-expression': 'warn',
    },
  },
];

