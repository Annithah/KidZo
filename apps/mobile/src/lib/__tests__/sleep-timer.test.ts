import { afterEach, describe, expect, it } from 'vitest';
import { CLIP_FADE_MS, SLEEP_FADE_MS, calmVolume, cancelSleepTimer, fadeVolume, getSleepTimerEnd, minutesLeft, startSleepTimer } from '../sleep-timer';

describe('sleep timer', () => {
  afterEach(() => cancelSleepTimer());

  it('keeps full volume until the fade starts, then fades to silence', () => {
    expect(fadeVolume(60_000, SLEEP_FADE_MS)).toBe(1);
    expect(fadeVolume(SLEEP_FADE_MS / 2, SLEEP_FADE_MS)).toBeCloseTo(0.5);
    expect(fadeVolume(0, SLEEP_FADE_MS)).toBe(0);
    expect(fadeVolume(-5, SLEEP_FADE_MS)).toBe(0);
    expect(fadeVolume(Number.NaN, SLEEP_FADE_MS)).toBe(1);
  });

  it('uses the quieter of the timer fade and the end-of-clip fade', () => {
    const now = 1_000_000;
    expect(calmVolume({ now, endsAt: null, clipRemainingMs: null })).toBe(1);
    expect(calmVolume({ now, endsAt: now + SLEEP_FADE_MS / 4, clipRemainingMs: 60_000 })).toBeCloseTo(0.25);
    expect(calmVolume({ now, endsAt: null, clipRemainingMs: CLIP_FADE_MS / 2 })).toBeCloseTo(0.5);
    expect(calmVolume({ now, endsAt: now - 1, clipRemainingMs: 60_000 })).toBe(0);
  });

  it('starts, reports and cancels the timer', () => {
    startSleepTimer(20, 0);
    expect(getSleepTimerEnd()).toBe(20 * 60_000);
    expect(minutesLeft(20 * 60_000, 60_001)).toBe(19);
    expect(minutesLeft(20 * 60_000, 30 * 60_000)).toBe(0);
    cancelSleepTimer();
    expect(getSleepTimerEnd()).toBeNull();
  });
});
