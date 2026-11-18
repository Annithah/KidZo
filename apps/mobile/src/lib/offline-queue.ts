/**
 * Sessions played while offline wait here until they can be synced. Persisted so they
 * survive app restarts. Sync is idempotent on the server (clientSessionId).
 */
import { offlineSessionSchema, type OfflineSession, type SyncResult } from '@kidzo/shared';
import { readJson, writeJson, type KeyValueStore } from './kv';

const KEY = 'kidzo.offline-sessions.v1';
const MAX_QUEUE = 500;

export class OfflineQueue {
  private flushing: Promise<SyncResult | null> | null = null;

  constructor(private readonly store: KeyValueStore) {}

  async list(): Promise<OfflineSession[]> {
    const raw = await readJson<unknown[]>(this.store, KEY, []);
    return raw.flatMap((item) => {
      const parsed = offlineSessionSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  }

  /** Adds or replaces (by clientSessionId) a session. */
  async upsert(session: OfflineSession): Promise<void> {
    const items = (await this.list()).filter((s) => s.clientSessionId !== session.clientSessionId);
    items.push(offlineSessionSchema.parse(session));
    await writeJson(this.store, KEY, items.slice(-MAX_QUEUE));
  }

  async size(): Promise<number> {
    return (await this.list()).length;
  }

  /**
   * Sends queued sessions in batches. Accepted, duplicate and permanently rejected sessions
   * are removed; network failures keep everything for the next attempt.
   */
  flush(sync: (sessions: OfflineSession[]) => Promise<SyncResult>): Promise<SyncResult | null> {
    this.flushing ??= this.doFlush(sync).finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async doFlush(sync: (sessions: OfflineSession[]) => Promise<SyncResult>): Promise<SyncResult | null> {
    const items = await this.list();
    if (items.length === 0) return null;
    const total: SyncResult = { accepted: 0, duplicates: 0, rejected: [] };
    const done = new Set<string>();
    for (let i = 0; i < items.length; i += 100) {
      const batch = items.slice(i, i + 100);
      try {
        const result = await sync(batch);
        total.accepted += result.accepted;
        total.duplicates += result.duplicates;
        total.rejected.push(...result.rejected);
        for (const s of batch) done.add(s.clientSessionId);
      } catch {
        break;
      }
    }
    const remaining = (await this.list()).filter((s) => !done.has(s.clientSessionId));
    await writeJson(this.store, KEY, remaining);
    return total;
  }
}
