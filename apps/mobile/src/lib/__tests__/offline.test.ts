import { describe, expect, it, vi } from 'vitest';
import type { OfflineSession } from '@kidzo/shared';
import { memoryStore } from '../kv';
import { OfflineQueue } from '../offline-queue';
import { UsageLedger } from '../usage-ledger';

const session = (n: number): OfflineSession => ({
  clientSessionId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  childId: '11111111-1111-4111-8111-111111111111',
  contentId: '22222222-2222-4222-8222-222222222222',
  familyMode: false,
  startedAt: '2026-11-18T10:00:00.000Z',
  seconds: 120,
  completed: true,
  path: ['start', 'end'],
});

describe('OfflineQueue', () => {
  it('upserts by client session id', async () => {
    const q = new OfflineQueue(memoryStore());
    await q.upsert(session(1));
    await q.upsert({ ...session(1), seconds: 200 });
    await q.upsert(session(2));
    const items = await q.list();
    expect(items).toHaveLength(2);
    expect(items.find((s) => s.clientSessionId === session(1).clientSessionId)?.seconds).toBe(200);
  });

  it('removes synced sessions and keeps them on network failure', async () => {
    const q = new OfflineQueue(memoryStore());
    await q.upsert(session(1));
    await q.upsert(session(2));
    await expect(
      q.flush(async () => {
        throw new Error('offline');
      }),
    ).resolves.toEqual({ accepted: 0, duplicates: 0, rejected: [] });
    expect(await q.size()).toBe(2);

    const sync = vi.fn(async (s: OfflineSession[]) => ({ accepted: s.length, duplicates: 0, rejected: [] }));
    const result = await q.flush(sync);
    expect(result?.accepted).toBe(2);
    expect(await q.size()).toBe(0);
    expect(await q.flush(sync)).toBeNull();
  });

  it('ignores corrupt stored data', async () => {
    const q = new OfflineQueue(memoryStore({ 'kidzo.offline-sessions.v1': '[{"bad":true}]' }));
    expect(await q.list()).toEqual([]);
  });
});

describe('UsageLedger', () => {
  it('tracks seconds per child per day and resets on a new day', async () => {
    const ledger = new UsageLedger(memoryStore());
    await ledger.add('kid', '2026-11-18', 60);
    await ledger.add('kid', '2026-11-18', 30.4);
    expect(await ledger.secondsToday('kid', '2026-11-18')).toBe(90);
    expect(await ledger.secondsToday('kid', '2026-11-19')).toBe(0);
    await ledger.add('kid', '2026-11-19', 10);
    expect(await ledger.secondsToday('kid', '2026-11-19')).toBe(10);
  });

  it('never lowers local time when syncing from the server', async () => {
    const ledger = new UsageLedger(memoryStore());
    await ledger.add('kid', '2026-11-18', 300);
    expect(await ledger.syncFromServer('kid', '2026-11-18', 120)).toBe(300);
    expect(await ledger.syncFromServer('kid', '2026-11-18', 900)).toBe(900);
  });
});
