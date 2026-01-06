module.exports = {
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  extends: ['eslint:recommended', 'plugin:node/recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['node'],
  rules: {
    // Warn on console.log usage (should use structured logger)
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    // Error on unused variables
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

    // Require consistent returns
    'consistent-return': 'error',

    // Prefer const over let
    'prefer-const': 'error',

    // No var declarations
    'no-var': 'error',

    // Async/await best practices
    'require-await': 'warn',
    'no-return-await': 'error',

    // Node.js specific
    'node/no-unpublished-require': 'off',
    'node/no-missing-require': 'off',
    'node/no-unsupported-features/es-syntax': 'off',

    // Import best practices
    'no-duplicate-imports': 'error',
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'coverage/',
    '*.config.js',
    'python-scripts/',
  ],
};
