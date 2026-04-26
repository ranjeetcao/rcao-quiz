import { defineConfig } from 'vitest/config';

// Vitest config for @rcao-quiz/sdk.
//
// Tests cover the pure-logic surface (schemas, grading, pickTemplate).
// We deliberately exclude the components/ folder here — RN components
// need a JSDOM/RN-test renderer, which we'll add in MVP-05 alongside
// the feed itself. For MVP-03 the exit criterion is "Jest tests for
// gradeAnswer and pickTemplate pass"; this config covers that.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.tsx.test.ts', 'src/components/**'],
    environment: 'node',
  },
});
