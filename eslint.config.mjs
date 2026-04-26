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
    // in the bundle, so the ESM-default rules don't apply. Glob covers .js,
    // .mjs, and .cjs config files anywhere in the workspace.
    files: ['**/*.config.{js,mjs,cjs}', '**/babel.config.{js,mjs,cjs}', '**/metro.config.{js,mjs,cjs}'],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'commonjs',
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // SDK purity guardrail. The `@rcao-quiz/sdk` package must remain
    // importable from non-RN consumers (the future pack-build script,
    // vitest in node, downstream tooling). The rule is convention-only
    // until enforced here — a stray `import 'expo-router'` in a new
    // component would slip through review otherwise.
    files: ['packages/sdk/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'expo-router', message: 'SDK must be router-agnostic; let the consumer wire navigation.' },
            { name: 'expo-haptics', message: 'SDK must be haptics-free; let the consumer fire haptics in onPress callbacks.' },
            { name: 'nativewind', message: 'SDK uses StyleSheet only — NativeWind requires the consumer’s babel pipeline.' },
            { name: 'react-native-mmkv', message: 'Storage belongs in the app, not the SDK (MVP-06).' },
            { name: 'expo-secure-store', message: 'Storage belongs in the app, not the SDK (MVP-06).' },
            { name: 'expo-sqlite', message: 'Storage belongs in the app, not the SDK (MVP-06).' },
          ],
        },
      ],
    },
  },
);
