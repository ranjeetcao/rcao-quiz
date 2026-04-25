import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.expo/**',
      '**/dist/**',
      '**/build/**',
      '**/web-build/**',
      '**/.next/**',
      '**/.turbo/**',
      'packs/**',
      'ios/**',
      'android/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  {
    // Node-style CommonJS config files (Expo's babel/metro/tailwind configs).
    // They use `module.exports = ...` and `require(...)` and run in Node, not
    // in the bundle, so the ESM-default rules don't apply.
    files: ['**/*.config.js', '**/babel.config.js', '**/metro.config.js'],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'commonjs',
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
