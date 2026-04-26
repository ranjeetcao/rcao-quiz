// Guards the analytics fail-soft contract that MVP-15 (Firebase) will
// inherit. The mapped-type signature on `ANALYTICS_PARAM_SCHEMAS` already
// enforces compile-time completeness, but the runtime checks below catch
// drift from JS callers, `as any` escape hatches, and any future code
// path that constructs the map differently.

import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  ANALYTICS_PARAM_SCHEMAS,
  ConsoleAnalyticsAdapter,
} from './analytics';

const EXPECTED_EVENT_NAMES = [
  'question_impression',
  'question_answered',
  'question_skipped',
  'question_flagged',
  'pack_downloaded',
] as const;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ANALYTICS_PARAM_SCHEMAS', () => {
  it('has a schema for every expected event name', () => {
    for (const name of EXPECTED_EVENT_NAMES) {
      expect(ANALYTICS_PARAM_SCHEMAS[name]).toBeDefined();
    }
  });

  it('has no extra entries beyond the expected event names', () => {
    expect(Object.keys(ANALYTICS_PARAM_SCHEMAS).sort()).toEqual(
      [...EXPECTED_EVENT_NAMES].sort(),
    );
  });
});

describe('ConsoleAnalyticsAdapter.emit', () => {
  it('drops unknown event names without throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const adapter = new ConsoleAnalyticsAdapter();

    // Cast through unknown — simulates a JS caller or `as any` escape.
    expect(() =>
      (adapter.emit as (name: string, params: unknown) => void)(
        'not_a_real_event',
        {},
      ),
    ).not.toThrow();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(
      /dropped not_a_real_event: unknown event name/,
    );
  });

  it('drops payloads that fail schema validation without throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const adapter = new ConsoleAnalyticsAdapter();

    expect(() =>
      (adapter.emit as (name: string, params: unknown) => void)(
        'question_answered',
        // missing required fields — should fail schema validation, not throw
        { question_id: 'not-a-ulid' },
      ),
    ).not.toThrow();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/^\[analytics\] dropped question_answered:/);
  });
});
