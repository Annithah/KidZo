import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { api } from './api';
import { offlineQueue, useIsOnline } from './offline';
import { useSession } from './session';

/** Uploads offline sessions when the app is online and in the foreground. Renders nothing. */
export function SyncManager() {
  const online = useIsOnline();
  const { status } = useSession();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!online || status !== 'signedIn') return;
    const run = async () => {
      const result = await offlineQueue.flush(api.syncSessions).catch(() => null);
      if (result && result.accepted > 0) void queryClient.invalidateQueries();
    };
    void run();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void run();
    });
    return () => sub.remove();
  }, [online, status, queryClient]);

  return null;
}
