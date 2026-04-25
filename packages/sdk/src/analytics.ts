// Analytics abstraction.
//
// Phase 0 has no real analytics provider — events go to `console.log`.
// Phase 1 swaps in `firebase/analytics` (or `@react-native-firebase/analytics`)
// behind the same interface. The app code never imports the provider
// directly; it only ever calls `analytics.emit(...)`.
//
// Why an interface, not just a function: the buffered flush behaviour in
// MVP-08 (idle-flush, ceiling-flush, app-background-flush) needs a
// stateful adapter, and the test seam is much cleaner if production code
// depends on a small interface rather than a free function.

import type {
  AnalyticsEvent,
  AnalyticsEventName,
  PackDownloadedParams,
  QuestionAnsweredParams,
  QuestionFlaggedParams,
  QuestionImpressionParams,
  QuestionSkippedParams,
} from './schemas/index';

/**
 * Map an event name to its params type. Lets `emit('question_answered', ...)`
 * autocomplete the params shape and reject typos.
 */
export type AnalyticsParams<N extends AnalyticsEventName> = Extract<
  AnalyticsEvent,
  { name: N }
>['params'];

/**
 * Adapter contract. The mobile app holds exactly one instance for the
 * lifetime of the process; pack-build / scripts construct their own.
 */
export interface AnalyticsAdapter {
  emit<N extends AnalyticsEventName>(name: N, params: AnalyticsParams<N>): void;
  /**
   * Force any buffered events out. Phase 0 console adapter is no-op
   * (events are flushed inline on emit). Phase 1 Firebase adapter will
   * push the buffer to native bridge here.
   */
  flush(): Promise<void>;
}

/**
 * Phase 0 implementation. Logs each event as a single line to make the
 * console output diff-friendly. Prefixed with `[analytics]` so it is
 * easy to grep for in the Expo log stream.
 */
export class ConsoleAnalyticsAdapter implements AnalyticsAdapter {
  emit<N extends AnalyticsEventName>(name: N, params: AnalyticsParams<N>): void {
    // JSON.stringify keeps the line single-row and copy-pasteable into a
    // BigQuery-style ingest tool when we get to Phase 1.
    console.log(`[analytics] ${name} ${JSON.stringify(params)}`);
  }
  async flush(): Promise<void> {
    // Nothing to flush — emit is synchronous and inline.
  }
}

/**
 * Process-wide singleton. Tests can swap it via `setAnalytics(...)`.
 *
 * Kept as a mutable module binding rather than a React context because
 * non-component callers (grading helpers, picker logic, scripts) need
 * to emit too, and threading a context through them all is friction
 * with no upside in Phase 0.
 */
let current: AnalyticsAdapter = new ConsoleAnalyticsAdapter();

export function getAnalytics(): AnalyticsAdapter {
  return current;
}

export function setAnalytics(adapter: AnalyticsAdapter): void {
  current = adapter;
}

/**
 * Convenience emit. Same signature as `AnalyticsAdapter.emit`. Most
 * call sites use this.
 */
export const analytics = {
  emit<N extends AnalyticsEventName>(name: N, params: AnalyticsParams<N>): void {
    current.emit(name, params);
  },
  flush(): Promise<void> {
    return current.flush();
  },
};

// Re-export the params types so callers can `import { QuestionAnsweredParams } from '@rcao-quiz/sdk/analytics'`.
export type {
  PackDownloadedParams,
  QuestionAnsweredParams,
  QuestionFlaggedParams,
  QuestionImpressionParams,
  QuestionSkippedParams,
};
