import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ageGroupFor, isBedtime, isForAgeGroup, localParts, type Child, type ContentDetail } from '@kidzo/shared';
import { api } from './api';
import { readLocalContent } from './downloads';
import { isNetworkError, usageLedger, withOfflineCache } from './offline';
import { useSession } from './session';

export const deviceTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

/** Family time zone: the parent's account setting, falling back to the device. */
export function useTimezone(): string {
  const { user } = useSession();
  return user?.timezone && user.timezone !== 'UTC' ? user.timezone : deviceTimezone();
}

export function useCatalog(childId: string | undefined) {
  return useQuery({
    queryKey: ['catalog', childId ?? 'all'],
    queryFn: () => withOfflineCache(`catalog.${childId ?? 'all'}`, () => api.catalog(childId ? { childId } : {})),
  });
}

/** Items this child started recently and has not finished. */
export function useContinueWatching(childId: string | undefined) {
  return useQuery({
    queryKey: ['continue', childId],
    enabled: !!childId,
    queryFn: () => withOfflineCache(`continue.${childId}`, () => api.continueWatching(childId ?? '')),
  });
}

/** "Picked for you" content for a child. Cached for offline use like the catalog. */
export function useRecommendations(childId: string | undefined) {
  return useQuery({
    queryKey: ['recommendations', childId],
    enabled: !!childId,
    queryFn: () => withOfflineCache(`recommendations.${childId}`, () => api.recommendations(childId ?? '')),
  });
}

/** Today's usage. Also feeds the local ledger so offline limits stay accurate. */
export function useToday(child: Child | null) {
  const timezone = useTimezone();
  return useQuery({
    queryKey: ['today', child?.id],
    enabled: !!child,
    queryFn: async () => {
      if (!child) throw new Error('No child');
      const date = localParts(new Date(), timezone).date;
      try {
        const status = await api.today(child.id);
        const seconds = await usageLedger.syncFromServer(child.id, status.date, status.secondsPlayed);
        return { ...status, secondsPlayed: seconds, offline: false };
      } catch (error) {
        if (!isNetworkError(error)) throw error;
        const seconds = await usageLedger.secondsToday(child.id, date);
        const limit = child.settings.dailyLimitMinutes;
        return {
          date,
          secondsPlayed: seconds,
          dailyLimitMinutes: limit,
          remainingSeconds: limit === null ? null : Math.max(0, limit * 60 - seconds),
          bedtimeActive: isBedtime(child.settings, new Date(), timezone),
          locked: false,
          lockedUntil: child.settings.lockedUntil,
          adventuresCompleted: 0,
          starsEarnedToday: 0,
          offline: true,
        };
      }
    },
    refetchInterval: 60_000,
  });
}

export function useInsights(childId: string | undefined) {
  return useQuery({
    queryKey: ['insights', childId],
    enabled: !!childId,
    queryFn: () => withOfflineCache(`insights.${childId}`, () => api.insights(childId as string)),
  });
}

/**
 * Content package for a child: network first (the server checks the child's age group), falling
 * back to a downloaded copy only when offline, and only if it fits the child's age group.
 */
export function useContentDetail(id: string | undefined, child: Child | null) {
  return useQuery({
    queryKey: ['content', id, child?.id],
    enabled: !!id && !!child,
    queryFn: async (): Promise<ContentDetail & { fromDownload: boolean }> => {
      if (!id || !child) throw new Error('No content id');
      try {
        return { ...(await api.content(id, child.id)), fromDownload: false };
      } catch (error) {
        if (!isNetworkError(error)) throw error;
        const local = await readLocalContent(id);
        if (local && isForAgeGroup(ageGroupFor(child.age), { ageGroups: local.ageGroups, videoSeconds: local.body.kind === 'video' ? local.body.durationSeconds : null })) {
          return { ...local, fromDownload: true };
        }
        throw error;
      }
    },
  });
}

export function useStickers(childId: string | undefined) {
  const all = useQuery({ queryKey: ['stickers'], queryFn: () => withOfflineCache('stickers', api.stickers) });
  const owned = useQuery({
    queryKey: ['child-stickers', childId],
    enabled: !!childId,
    queryFn: () => withOfflineCache(`child-stickers.${childId}`, () => api.childStickers(childId as string)),
  });
  return { all, owned };
}

/** Re-evaluates bedtime every minute so the theme switches on time. */
export function useBedtime(child: Child | null): boolean {
  const timezone = useTimezone();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return child ? isBedtime(child.settings, now, timezone) : false;
}

/** Current time in ms, refreshed on an interval. Keeps render functions pure. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
