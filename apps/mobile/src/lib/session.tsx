import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LoginInput, RegisterInput, User } from '@kidzo/shared';
import { setAppLocale } from '../i18n';
import { api, onAuthLost } from './api';
import { ApiError } from '@kidzo/shared';
import { appStore, tokenStore } from './storage';
import { readJson, writeJson } from './kv';

const CACHED_USER_KEY = 'kidzo.user.v1';

interface SessionState {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: User | null;
  signIn: (input: LoginInput) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User) => void;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SessionState['status']>('loading');
  const [user, setUserState] = useState<User | null>(null);

  const setUser = useCallback((next: User) => {
    setUserState(next);
    setAppLocale(next.locale);
    void writeJson(appStore, CACHED_USER_KEY, next);
  }, []);

  const clearLocal = useCallback(async () => {
    await tokenStore.clear();
    await appStore.removeItem(CACHED_USER_KEY);
    queryClient.clear();
    setUserState(null);
    setStatus('signedOut');
  }, [queryClient]);

  // Restore: tokens present means signed in. Use the cached user offline.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tokens = await tokenStore.get();
      if (!tokens) {
        if (!cancelled) setStatus('signedOut');
        return;
      }
      const cached = await readJson<User | null>(appStore, CACHED_USER_KEY, null);
      if (cached && !cancelled) {
        setUser(cached);
        setStatus('signedIn');
      }
      try {
        const fresh = await api.me();
        if (!cancelled) {
          setUser(fresh);
          setStatus('signedIn');
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) await clearLocal();
        else if (!cached) setStatus('signedOut');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearLocal, setUser]);

  useEffect(() => onAuthLost(() => void clearLocal()), [clearLocal]);

  const signIn = useCallback(
    async (input: LoginInput) => {
      const res = await api.login(input);
      await tokenStore.set(res.tokens);
      setUser(res.user);
      setStatus('signedIn');
    },
    [setUser],
  );

  const signUp = useCallback(
    async (input: RegisterInput) => {
      const res = await api.register(input);
      await tokenStore.set(res.tokens);
      setUser(res.user);
      setStatus('signedIn');
    },
    [setUser],
  );

  const signOut = useCallback(async () => {
    const tokens = await tokenStore.get();
    if (tokens) await api.logout(tokens.refreshToken).catch(() => undefined);
    await clearLocal();
  }, [clearLocal]);

  const value = useMemo(
    () => ({ status, user, signIn, signUp, signOut, setUser }),
    [status, user, signIn, signUp, signOut, setUser],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
