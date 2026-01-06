module.exports = {
  extends: [
    'react-app',
    'react-app/jest',
    'prettier', // Disables formatting rules that conflict with Prettier
  ],
  rules: {
    // Warn on console.log (use proper error handling instead)
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    // React hooks best practices (already enforced by react-app)
    'react-hooks/exhaustive-deps': 'warn',

    // TypeScript
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',

    // General code quality
    'prefer-const': 'error',
    'no-var': 'error',
    'no-duplicate-imports': 'error',
  },
  ignorePatterns: [
    'node_modules/',
    'build/',
    'coverage/',
    '*.config.js',
    'public/',
  ],
};
