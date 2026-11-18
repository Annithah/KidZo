/**
 * Local record of play time per child per day. The server is the source of truth when online;
 * this lets daily limits keep working offline and between heartbeats.
 */
import { readJson, writeJson, type KeyValueStore } from './kv';

const KEY = 'kidzo.usage-ledger.v1';

type Ledger = Record<string, { date: string; seconds: number }>;

export class UsageLedger {
  constructor(private readonly store: KeyValueStore) {}

  async secondsToday(childId: string, date: string): Promise<number> {
    const ledger = await readJson<Ledger>(this.store, KEY, {});
    const entry = ledger[childId];
    return entry && entry.date === date ? entry.seconds : 0;
  }

  async add(childId: string, date: string, seconds: number): Promise<number> {
    const ledger = await readJson<Ledger>(this.store, KEY, {});
    const current = ledger[childId]?.date === date ? (ledger[childId]?.seconds ?? 0) : 0;
    const next = current + Math.max(0, Math.round(seconds));
    ledger[childId] = { date, seconds: next };
    await writeJson(this.store, KEY, ledger);
    return next;
  }

  /** Adopts the server's count, but never lowers time recorded locally that may not be synced yet. */
  async syncFromServer(childId: string, date: string, serverSeconds: number): Promise<number> {
    const ledger = await readJson<Ledger>(this.store, KEY, {});
    const local = ledger[childId]?.date === date ? (ledger[childId]?.seconds ?? 0) : 0;
    const next = Math.max(local, serverSeconds);
    ledger[childId] = { date, seconds: next };
    await writeJson(this.store, KEY, ledger);
    return next;
  }
}
