/**
 * Device storage. App data (queues, caches, preferences) lives in JSON files in the document
 * directory; secrets (tokens) live in the OS keychain via SecureStore. On web, localStorage is
 * used for both since there is no keychain (development preview only).
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { authTokensSchema, type AuthTokens, type TokenStore } from '@kidzo/shared';
import type { KeyValueStore } from './kv';

const isWeb = Platform.OS === 'web';

function webStore(prefix: string): KeyValueStore {
  return {
    getItem: async (k) => globalThis.localStorage?.getItem(prefix + k) ?? null,
    setItem: async (k, v) => globalThis.localStorage?.setItem(prefix + k, v),
    removeItem: async (k) => globalThis.localStorage?.removeItem(prefix + k),
  };
}

function fileStore(): KeyValueStore {
  const dir = new Directory(Paths.document, 'kidzo-data');
  const fileFor = (key: string) => {
    if (!dir.exists) dir.create({ idempotent: true, intermediates: true });
    return new File(dir, `${key.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`);
  };
  return {
    getItem: async (key) => {
      const file = fileFor(key);
      return file.exists ? file.text() : null;
    },
    setItem: async (key, value) => {
      const file = fileFor(key);
      if (!file.exists) file.create();
      file.write(value);
    },
    removeItem: async (key) => {
      const file = fileFor(key);
      if (file.exists) file.delete();
    },
  };
}

export const appStore: KeyValueStore = isWeb ? webStore('kidzo:') : fileStore();

const TOKEN_KEY = 'kidzo.auth.tokens';

export const tokenStore: TokenStore = {
  async get(): Promise<AuthTokens | null> {
    try {
      const raw = isWeb ? globalThis.localStorage?.getItem(TOKEN_KEY) : await SecureStore.getItemAsync(TOKEN_KEY);
      if (!raw) return null;
      const parsed = authTokensSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  },
  async set(tokens) {
    const raw = JSON.stringify(tokens);
    if (isWeb) globalThis.localStorage?.setItem(TOKEN_KEY, raw);
    else await SecureStore.setItemAsync(TOKEN_KEY, raw, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
  },
  async clear() {
    if (isWeb) globalThis.localStorage?.removeItem(TOKEN_KEY);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};
