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
            { name: 'expo-constants', message: 'SDK must not read app/build config; pass values in via props.' },
            { name: 'expo-file-system', message: 'Filesystem access belongs in the app/scripts, not the SDK.' },
            { name: 'expo-asset', message: 'Asset bundling belongs in the consumer, not the SDK.' },
            { name: 'expo-image', message: 'Image rendering will arrive in Phase 3 as a consumer-injected prop, not a direct SDK dep.' },
            { name: 'react-native-reanimated', message: 'Animation belongs at the consumer level (feed in MVP-05); SDK stays declarative.' },
            { name: 'react-native-gesture-handler', message: 'Gestures belong in the consumer; SDK exposes onPress/onAnswer callbacks.' },
            { name: '@react-native-async-storage/async-storage', message: 'Storage belongs in the app, not the SDK (MVP-06).' },
          ],
          // Subpath ban: bare-spec `paths` only catches `import 'expo-router'`,
          // not `import 'expo-router/build/...'`. The pattern below closes
          // that gap for the same package list with one rule.
          patterns: [
            {
              group: [
                'expo-router/*',
                'expo-haptics/*',
                'nativewind/*',
                'react-native-mmkv/*',
                'expo-secure-store/*',
                'expo-sqlite/*',
                'expo-constants/*',
                'expo-file-system/*',
                'expo-asset/*',
                'expo-image/*',
                'react-native-reanimated/*',
                'react-native-gesture-handler/*',
                '@react-native-async-storage/async-storage/*',
              ],
              message: 'SDK purity: subpath import of an app-only dependency. See the bare-spec ban list above for the per-package reason.',
            },
          ],
        },
      ],
    },
  },
);
