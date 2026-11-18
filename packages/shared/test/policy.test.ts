import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CHILD_SETTINGS,
  evaluatePlayPolicy,
  isAgeAppropriate,
  isInWindow,
  localParts,
  nextOccurrence,
  parseTimeOfDay,
  type ChildSettings,
} from '../src';

const settings = (overrides: Partial<ChildSettings> = {}): ChildSettings => ({
  ...DEFAULT_CHILD_SETTINGS,
  ...overrides,
});

// 2026-03-10 12:00 UTC is 14:00 in Kigali (UTC+2).
const noonUtc = new Date('2026-03-10T12:00:00Z');
const lateUtc = new Date('2026-03-10T19:00:00Z'); // 21:00 Kigali

describe('time helpers', () => {
  it('reads local parts in a time zone', () => {
    expect(localParts(noonUtc, 'Africa/Kigali')).toEqual({ date: '2026-03-10', minuteOfDay: 14 * 60 });
    expect(localParts(new Date('2026-03-10T23:30:00Z'), 'Africa/Kigali').date).toBe('2026-03-11');
  });

  it('falls back to UTC for unknown zones', () => {
    expect(localParts(noonUtc, 'Not/AZone').minuteOfDay).toBe(12 * 60);
  });

  it('handles same-day and overnight windows', () => {
    expect(isInWindow(600, 540, 660)).toBe(true);
    expect(isInWindow(700, 540, 660)).toBe(false);
    const start = parseTimeOfDay('19:30');
    const end = parseTimeOfDay('07:00');
    expect(isInWindow(parseTimeOfDay('22:00'), start, end)).toBe(true);
    expect(isInWindow(parseTimeOfDay('03:00'), start, end)).toBe(true);
    expect(isInWindow(parseTimeOfDay('07:00'), start, end)).toBe(false);
    expect(isInWindow(parseTimeOfDay('12:00'), start, end)).toBe(false);
    expect(isInWindow(100, 300, 300)).toBe(false);
  });

  it('finds the next occurrence of a time of day', () => {
    const next = nextOccurrence('07:00', lateUtc, 'Africa/Kigali');
    expect(next.toISOString()).toBe('2026-03-11T05:00:00.000Z');
  });
});

describe('evaluatePlayPolicy', () => {
  const base = { now: noonUtc, timeZone: 'Africa/Kigali', childAge: 6, secondsPlayedToday: 0 };

  it('allows play in the afternoon with time left', () => {
    const r = evaluatePlayPolicy({ ...base, settings: settings(), content: { calm: false, ageMin: 5 } });
    expect(r).toMatchObject({ allowed: true, reason: null, bedtimeActive: false, remainingSeconds: 3600 });
  });

  it('blocks when the daily limit is used up', () => {
    const r = evaluatePlayPolicy({ ...base, secondsPlayedToday: 3600, settings: settings() });
    expect(r.reason).toBe('limit');
    expect(r.remainingSeconds).toBe(0);
  });

  it('shows a warning near the limit', () => {
    const r = evaluatePlayPolicy({ ...base, secondsPlayedToday: 3600 - 120, settings: settings() });
    expect(r.allowed).toBe(true);
    expect(r.showWarning).toBe(true);
  });

  it('treats a null limit as unlimited', () => {
    const r = evaluatePlayPolicy({ ...base, secondsPlayedToday: 99_999, settings: settings({ dailyLimitMinutes: null }) });
    expect(r.allowed).toBe(true);
    expect(r.remainingSeconds).toBeNull();
  });

  it('only allows calm content at bedtime', () => {
    const night = { ...base, now: lateUtc, settings: settings() };
    expect(evaluatePlayPolicy({ ...night, content: { calm: false, ageMin: 3 } }).reason).toBe('bedtime');
    const calm = evaluatePlayPolicy({ ...night, content: { calm: true, ageMin: 3 } });
    expect(calm.allowed).toBe(true);
    expect(calm.bedtimeActive).toBe(true);
  });

  it('ignores bedtime when disabled', () => {
    const r = evaluatePlayPolicy({ ...base, now: lateUtc, settings: settings({ bedtimeEnabled: false }), content: { calm: false, ageMin: 3 } });
    expect(r.allowed).toBe(true);
  });

  it('a parent lock wins over everything', () => {
    const lockedUntil = new Date(noonUtc.getTime() + 60_000).toISOString();
    const r = evaluatePlayPolicy({ ...base, settings: settings({ lockedUntil }), content: { calm: true, ageMin: 2 } });
    expect(r.reason).toBe('locked');
  });

  it('an expired lock does not block', () => {
    const lockedUntil = new Date(noonUtc.getTime() - 60_000).toISOString();
    expect(evaluatePlayPolicy({ ...base, settings: settings({ lockedUntil }) }).allowed).toBe(true);
  });

  it('blocks content for older children', () => {
    expect(evaluatePlayPolicy({ ...base, childAge: 3, settings: settings(), content: { calm: false, ageMin: 5 } }).reason).toBe('age');
  });

  it('age appropriateness allows slightly younger content', () => {
    expect(isAgeAppropriate(6, 5, 8)).toBe(true);
    expect(isAgeAppropriate(10, 5, 8)).toBe(true);
    expect(isAgeAppropriate(11, 5, 8)).toBe(false);
    expect(isAgeAppropriate(4, 5, 8)).toBe(false);
  });
});
