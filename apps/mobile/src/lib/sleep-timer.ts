import { useSyncExternalStore } from 'react';

/** Bedtime sleep timer choices, in minutes. */
export const SLEEP_TIMER_MINUTES = [10, 20, 30] as const;
/** Volume fades to silence over this long before the timer ends. */
export const SLEEP_FADE_MS = 30_000;
/** Calm videos also fade out over their last few seconds. */
export const CLIP_FADE_MS = 8_000;

/** 1 while far from the end, then a straight fade down to 0 at the end. */
export function fadeVolume(remainingMs: number, fadeMs: number): number {
  if (!Number.isFinite(remainingMs) || remainingMs >= fadeMs) return 1;
  if (remainingMs <= 0) return 0;
  return remainingMs / fadeMs;
}

/** Volume for a calm video: the quieter of the sleep timer fade and the end-of-clip fade. */
export function calmVolume(input: { now: number; endsAt: number | null; clipRemainingMs: number | null }): number {
  const timer = input.endsAt === null ? 1 : fadeVolume(input.endsAt - input.now, SLEEP_FADE_MS);
  const clip = input.clipRemainingMs === null ? 1 : fadeVolume(input.clipRemainingMs, CLIP_FADE_MS);
  return Math.min(timer, clip);
}

/** Minutes left on the timer, rounded up; 0 once it has run out. */
export function minutesLeft(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 60_000));
}

// The timer lives in memory only: it is for tonight, so it is gone when the app restarts.
let endsAt: number | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function startSleepTimer(minutes: number, now = Date.now()): void {
  endsAt = now + minutes * 60_000;
  emit();
}

export function cancelSleepTimer(): void {
  endsAt = null;
  emit();
}

export function getSleepTimerEnd(): number | null {
  return endsAt;
}

/** When the sleep timer ends (epoch ms), or null when none is set. */
export function useSleepTimer(): number | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getSleepTimerEnd,
    getSleepTimerEnd,
  );
}
