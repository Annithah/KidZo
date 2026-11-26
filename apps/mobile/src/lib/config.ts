import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * API base URL. Set EXPO_PUBLIC_API_URL for builds and when using an Expo tunnel; the tunnel
 * host serves Metro, not the API. On a local network, development uses the Metro host on port 4000.
 */
function resolveApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:4000`;
  if (Platform.OS === 'android') return 'http://10.0.2.2:4000';
  return 'http://localhost:4000';
}

/**
 * Standalone builds set EXPO_PUBLIC_LOCAL_BACKEND=1. The app then answers every API call from
 * an on-device database with the demo family and full catalog, so it works with no server.
 */
export const LOCAL_BACKEND = process.env.EXPO_PUBLIC_LOCAL_BACKEND === '1';

export const API_URL = resolveApiUrl();

/** Parent area unlock lasts this long without activity. */
export const PARENT_UNLOCK_MS = 5 * 60_000;

/** How often play time is reported while playing. */
export const HEARTBEAT_SECONDS = 30;
