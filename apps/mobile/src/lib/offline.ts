import { useNetworkState } from 'expo-network';
import { readJson, writeJson } from './kv';
import { OfflineQueue } from './offline-queue';
import { appStore } from './storage';
import { UsageLedger } from './usage-ledger';
import { ApiError } from '@kidzo/shared';

export const offlineQueue = new OfflineQueue(appStore);
export const usageLedger = new UsageLedger(appStore);

/** True unless the device reports it is offline. Unknown counts as online so requests are tried. */
export function useIsOnline(): boolean {
  const state = useNetworkState();
  return state.isConnected !== false && state.isInternetReachable !== false;
}

export const isNetworkError = (error: unknown): boolean => error instanceof ApiError && error.isNetwork;

/**
 * Runs a request and caches the result. When the network is unavailable the last cached value
 * is returned instead, so screens keep working offline.
 */
export async function withOfflineCache<T>(cacheKey: string, fetcher: () => Promise<T>): Promise<T> {
  const key = `kidzo.cache.${cacheKey}`;
  try {
    const fresh = await fetcher();
    void writeJson(appStore, key, fresh);
    return fresh;
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    const cached = await readJson<T | null>(appStore, key, null);
    if (cached === null) throw error;
    return cached;
  }
}
