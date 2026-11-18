import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  evaluatePlayPolicy,
  isLocked,
  localParts,
  type Insights,
  type TodayStatus,
} from '@kidzo/shared';
import type { Db } from '../db/client';
import { children, content, playSessions, users } from '../db/schema';
import { forbidden, notFound } from './errors';

export type ChildRow = typeof children.$inferSelect;

/** Loads a child only if it belongs to the parent, along with the parent's time zone. */
export async function getOwnedChild(db: Db, parentId: string, childId: string): Promise<{ child: ChildRow; timezone: string }> {
  const [row] = await db
    .select({ child: children, timezone: users.timezone })
    .from(children)
    .innerJoin(users, eq(users.id, children.parentId))
    .where(eq(children.id, childId))
    .limit(1);
  if (!row) throw notFound('Child');
  if (row.child.parentId !== parentId) throw forbidden();
  return row;
}

export async function secondsPlayedOn(db: Db, childId: string, localDate: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${playSessions.secondsPlayed}), 0)::int` })
    .from(playSessions)
    .where(and(eq(playSessions.childId, childId), eq(playSessions.localDate, localDate)));
  return Number(row?.total ?? 0);
}

export async function todayStatus(db: Db, child: ChildRow, timezone: string, now = new Date()): Promise<TodayStatus> {
  const { date } = localParts(now, timezone);
  const [agg] = await db
    .select({
      seconds: sql<number>`coalesce(sum(${playSessions.secondsPlayed}), 0)::int`,
      completed: sql<number>`count(*) filter (where ${playSessions.completed})::int`,
      stars: sql<number>`coalesce(sum(${playSessions.starsEarned}), 0)::int`,
    })
    .from(playSessions)
    .where(and(eq(playSessions.childId, child.id), eq(playSessions.localDate, date)));
  const secondsPlayed = Number(agg?.seconds ?? 0);
  const policy = evaluatePlayPolicy({
    settings: child.settings,
    secondsPlayedToday: secondsPlayed,
    now,
    timeZone: timezone,
    childAge: child.age,
  });
  return {
    date,
    secondsPlayed,
    dailyLimitMinutes: child.settings.dailyLimitMinutes,
    remainingSeconds: policy.remainingSeconds,
    bedtimeActive: policy.bedtimeActive,
    locked: isLocked(child.settings, now),
    lockedUntil: child.settings.lockedUntil,
    adventuresCompleted: Number(agg?.completed ?? 0),
    starsEarnedToday: Number(agg?.stars ?? 0),
  };
}

/** Local dates for the last `days` days ending today, oldest first. */
export function lastLocalDates(now: Date, timezone: string, days: number): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    dates.push(localParts(new Date(now.getTime() - i * 86_400_000), timezone).date);
  }
  return [...new Set(dates)];
}

export async function weeklyInsights(db: Db, child: ChildRow, timezone: string, now = new Date()): Promise<Insights> {
  const dates = lastLocalDates(now, timezone, 7);
  const rows = await db
    .select({
      localDate: playSessions.localDate,
      seconds: playSessions.secondsPlayed,
      completed: playSessions.completed,
      stars: playSessions.starsEarned,
      skills: content.skills,
    })
    .from(playSessions)
    .innerJoin(content, eq(content.id, playSessions.contentId))
    .where(and(eq(playSessions.childId, child.id), inArray(playSessions.localDate, dates)));

  const perDay = new Map(dates.map((d) => [d, 0]));
  const skillCounts = new Map<string, number>();
  let totalSeconds = 0;
  let sessionsCompleted = 0;
  let starsEarned = 0;
  for (const row of rows) {
    perDay.set(row.localDate, (perDay.get(row.localDate) ?? 0) + row.seconds);
    totalSeconds += row.seconds;
    starsEarned += row.stars;
    if (row.completed) {
      sessionsCompleted += 1;
      for (const skill of row.skills) skillCounts.set(skill, (skillCounts.get(skill) ?? 0) + 1);
    }
  }
  const topSkills = [...skillCounts.entries()]
    .map(([skill, count]) => ({ skill, count }))
    .sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill))
    .slice(0, 5);

  return {
    rangeStart: dates[0] ?? '',
    rangeEnd: dates[dates.length - 1] ?? '',
    totalSeconds,
    sessionsCompleted,
    starsEarned,
    dailyMinutes: dates.map((date) => ({ date, minutes: Math.round(((perDay.get(date) ?? 0) / 60) * 10) / 10 })),
    topSkills,
    highlight: topSkills[0] ?? null,
  };
}
