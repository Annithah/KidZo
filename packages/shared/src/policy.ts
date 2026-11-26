import { isCategoryAllowed } from './categories';
import type { ChildSettings } from './schemas/child';
import type { BlockReason } from './schemas/session';

const MINUTES_PER_DAY = 24 * 60;

export interface LocalParts {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Minutes since local midnight. */
  minuteOfDay: number;
}

/** Date and time of day for `now` in an IANA time zone. Falls back to UTC for unknown zones. */
export function localParts(now: Date, timeZone: string): LocalParts {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    return localParts(now, 'UTC');
  }
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minuteOfDay: hour * 60 + minute,
  };
}

/** Parses "HH:mm" into minutes since midnight. */
export function parseTimeOfDay(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid time of day: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** True when `minute` falls in [start, end). Windows may cross midnight. Equal bounds mean an empty window. */
export function isInWindow(minute: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start < end) return minute >= start && minute < end;
  return minute >= start || minute < end;
}

export function isBedtime(settings: Pick<ChildSettings, 'bedtimeEnabled' | 'bedtimeStart' | 'bedtimeEnd'>, now: Date, timeZone: string): boolean {
  if (!settings.bedtimeEnabled) return false;
  const { minuteOfDay } = localParts(now, timeZone);
  return isInWindow(minuteOfDay, parseTimeOfDay(settings.bedtimeStart), parseTimeOfDay(settings.bedtimeEnd));
}

/**
 * Next time the local clock reads `timeOfDay`, strictly after `now`.
 * Uses minute arithmetic, so it can be off by up to an hour across a DST change.
 */
export function nextOccurrence(timeOfDay: string, now: Date, timeZone: string): Date {
  const { minuteOfDay } = localParts(now, timeZone);
  let delta = (parseTimeOfDay(timeOfDay) - minuteOfDay + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  if (delta === 0) delta = MINUTES_PER_DAY;
  const base = new Date(now);
  base.setSeconds(0, 0);
  return new Date(base.getTime() + delta * 60_000);
}

export function isLocked(settings: Pick<ChildSettings, 'lockedUntil'>, now: Date): boolean {
  return settings.lockedUntil !== null && new Date(settings.lockedUntil).getTime() > now.getTime();
}

export interface PlayPolicyInput {
  settings: ChildSettings;
  secondsPlayedToday: number;
  now: Date;
  timeZone: string;
  childAge: number;
  /** Type and skills are needed to check parent category restrictions. */
  content?: { calm: boolean; ageMin: number; type?: string; skills?: readonly string[] };
}

export interface PlayPolicyResult {
  allowed: boolean;
  reason: BlockReason | null;
  bedtimeActive: boolean;
  /** Seconds left today, or null when there is no limit. */
  remainingSeconds: number | null;
  /** True when the gentle heads-up should show. */
  showWarning: boolean;
}

/**
 * Decides whether a child may play right now. Used by the API to enforce rules and by the
 * app to enforce them offline. Order matters: a parent lock wins, then age and blocked categories,
 * then bedtime, then limits.
 */
export function evaluatePlayPolicy(input: PlayPolicyInput): PlayPolicyResult {
  const { settings, secondsPlayedToday, now, timeZone, childAge, content } = input;
  const bedtimeActive = isBedtime(settings, now, timeZone);
  const remainingSeconds =
    settings.dailyLimitMinutes === null ? null : Math.max(0, settings.dailyLimitMinutes * 60 - secondsPlayedToday);
  const showWarning =
    remainingSeconds !== null && remainingSeconds > 0 && remainingSeconds <= settings.warningMinutes * 60;

  const result = (reason: BlockReason | null): PlayPolicyResult => ({
    allowed: reason === null,
    reason,
    bedtimeActive,
    remainingSeconds,
    showWarning,
  });

  if (isLocked(settings, now)) return result('locked');
  if (content && childAge < content.ageMin) return result('age');
  if (content?.type && !isCategoryAllowed(settings.blockedCategories, { type: content.type, calm: content.calm, skills: content.skills ?? [] })) return result('category');
  if (bedtimeActive && content && !content.calm) return result('bedtime');
  if (remainingSeconds !== null && remainingSeconds <= 0) return result('limit');
  return result(null);
}

/** Catalog visibility: content fits the child if they are old enough and not far past the range. */
export function isAgeAppropriate(childAge: number, ageMin: number, ageMax: number): boolean {
  return childAge >= ageMin && childAge <= ageMax + 2;
}
