module.exports = {
  env: {
    node: true,
    es6: true,
  },
  extends: [
    'eslint:recommended',
    'prettier',
  ],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    'prettier/prettier': 'error',
    'no-console': 'off',
  },
  plugins: ['prettier'],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'coverage/',
    '**/*.spec.js',
  ],
}
