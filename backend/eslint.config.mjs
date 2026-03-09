import eslint from '@eslint/js'
import globals from 'globals'

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

  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      'no-console': 'off',
      'no-debugger': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-constant-binary-expression': 'warn',
    },
  },
]
