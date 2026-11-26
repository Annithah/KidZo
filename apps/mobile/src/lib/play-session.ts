/**
 * Runs one play session: start (online, or offline with local rule checks), count play time
 * while the app is in the foreground, report heartbeats, enforce the daily limit, and finish
 * with stars. Offline results are queued and synced later.
 */
import { useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  computeStars,
  evaluatePlayPolicy,
  localParts,
  type BlockReason,
  type Child,
  type ContentDetail,
  type Sticker,
} from '@kidzo/shared';
import { api } from './api';
import { ApiError } from '@kidzo/shared';
import { HEARTBEAT_SECONDS } from './config';
import { isNetworkError, offlineQueue, usageLedger } from './offline';

export type PlayPhase = 'starting' | 'playing' | 'blocked' | 'timesUp' | 'finished' | 'error';

export interface FinishResult {
  starsEarned: number;
  totalStars: number;
  stickerUnlocked: Sticker | null;
  savedOffline: boolean;
}

interface Options {
  child: Child;
  content: ContentDetail;
  familyMode: boolean;
  timezone: string;
}

const MAX_REPORT = 300;

export function usePlaySession({ child, content, familyMode, timezone }: Options) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<PlayPhase>('starting');
  const [blockReason, setBlockReason] = useState<BlockReason | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [warning, setWarning] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ids = useRef({ client: randomUUID(), server: null as string | null });
  const counters = useRef({ total: 0, unsent: 0, unledgered: 0, startedAt: new Date().toISOString() });
  const finished = useRef(false);
  const remainingRef = useRef<number | null>(null);

  const warningSeconds = child.settings.warningMinutes * 60;
  const setRemainingBoth = useCallback(
    (value: number | null) => {
      remainingRef.current = value;
      setRemaining(value);
      setWarning(value !== null && value > 0 && value <= warningSeconds);
    },
    [warningSeconds],
  );

  // Start
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const started = await api.startSession({
          childId: child.id,
          contentId: content.id,
          familyMode,
          clientSessionId: ids.current.client,
        });
        if (cancelled) return;
        ids.current.server = started.id;
        setRemainingBoth(started.remainingSeconds ?? null);
        setPhase('playing');
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.code === 'PLAY_BLOCKED') {
          const reason = (e.details as { reason?: BlockReason } | undefined)?.reason ?? 'limit';
          setBlockReason(reason);
          setPhase('blocked');
          return;
        }
        if (!isNetworkError(e)) {
          setError(e instanceof Error ? e.message : 'Could not start');
          setPhase('error');
          return;
        }
        // Offline: apply the same rules locally.
        const now = new Date();
        const today = localParts(now, timezone).date;
        const policy = evaluatePlayPolicy({
          settings: child.settings,
          secondsPlayedToday: await usageLedger.secondsToday(child.id, today),
          now,
          timeZone: timezone,
          childAge: child.age,
          content: { calm: content.calm, ageMin: content.ageMin, type: content.type, skills: content.skills },
        });
        if (cancelled) return;
        setOffline(true);
        if (!policy.allowed) {
          setBlockReason(policy.reason);
          setPhase('blocked');
          return;
        }
        setRemainingBoth(policy.remainingSeconds);
        setPhase('playing');
      }
    })();
    return () => {
      cancelled = true;
    };
    // Start once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flushLedger = useCallback(async () => {
    const seconds = counters.current.unledgered;
    if (seconds <= 0) return;
    counters.current.unledgered = 0;
    await usageLedger.add(child.id, localParts(new Date(), timezone).date, seconds);
  }, [child.id, timezone]);

  const sendHeartbeat = useCallback(async () => {
    const serverId = ids.current.server;
    const seconds = Math.min(counters.current.unsent, MAX_REPORT);
    if (!serverId || seconds <= 0) return;
    counters.current.unsent -= seconds;
    try {
      const res = await api.heartbeat(serverId, seconds);
      setOffline(false);
      if (res.remainingSeconds !== null) setRemainingBoth(res.remainingSeconds);
      if (res.blockedReason === 'locked') {
        setBlockReason('locked');
        setPhase('blocked');
      }
    } catch (e) {
      counters.current.unsent += seconds;
      if (isNetworkError(e)) setOffline(true);
    }
  }, [setRemainingBoth]);

  // Tick once a second while playing and in the foreground.
  useEffect(() => {
    if (phase !== 'playing') return;
    let active = AppState.currentState === 'active';
    const sub = AppState.addEventListener('change', (s) => {
      active = s === 'active';
      if (!active) void flushLedger();
    });
    const timer = setInterval(() => {
      if (!active) return;
      const c = counters.current;
      c.total += 1;
      c.unsent += 1;
      c.unledgered += 1;
      if (c.unledgered >= 10) void flushLedger();
      if (c.unsent >= HEARTBEAT_SECONDS) void sendHeartbeat();
      if (remainingRef.current !== null) {
        const next = remainingRef.current - 1;
        setRemainingBoth(next);
        if (next <= 0) setPhase('timesUp');
      }
    }, 1000);
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [phase, flushLedger, sendHeartbeat, setRemainingBoth]);

  const queueOffline = useCallback(
    async (completed: boolean, path: string[], answers?: Record<string, string>) => {
      await offlineQueue.upsert({
        clientSessionId: ids.current.client,
        childId: child.id,
        contentId: content.id,
        familyMode,
        startedAt: counters.current.startedAt,
        seconds: counters.current.total,
        completed,
        path,
        ...(answers ? { answers } : {}),
      });
    },
    [child.id, content.id, familyMode],
  );

  const finish = useCallback(
    async (path: string[], answers?: Record<string, string>): Promise<FinishResult> => {
      finished.current = true;
      setPhase('finished');
      await flushLedger();
      const serverId = ids.current.server;
      if (serverId) {
        try {
          const res = await api.completeSession(serverId, {
            seconds: Math.min(counters.current.unsent, MAX_REPORT),
            path,
            ...(answers ? { answers } : {}),
          });
          counters.current.unsent = 0;
          void queryClient.invalidateQueries();
          return {
            starsEarned: res.starsEarned,
            totalStars: res.totalStars,
            stickerUnlocked: res.stickerUnlocked,
            savedOffline: false,
          };
        } catch (e) {
          if (!isNetworkError(e)) throw e;
        }
      }
      const { stars } = computeStars(content.body, content.rewardStars, path, answers);
      await queueOffline(true, path, answers);
      return { starsEarned: stars, totalStars: child.stars + stars, stickerUnlocked: null, savedOffline: true };
    },
    [child.stars, content.body, content.rewardStars, flushLedger, queryClient, queueOffline],
  );

  // Leaving early still records play time. The ref objects are mutated in place, never replaced.
  useEffect(() => {
    const c = counters.current;
    const sessionIds = ids.current;
    const done = finished;
    return () => {
      if (done.current) return;
      void flushLedger();
      if (sessionIds.server && c.unsent > 0) {
        void sendHeartbeat().then(() => {
          if (c.unsent > 0) void queueOffline(false, []);
        });
      } else if (!sessionIds.server && c.total > 0) {
        void queueOffline(false, []);
      }
    };
  }, [flushLedger, sendHeartbeat, queueOffline]);

  return { phase, blockReason, remaining, warning, offline, error, finish };
}
