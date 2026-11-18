import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@kidzo/shared';
import { api, setOnAuthLost, tokenStore } from './api';

interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<User | null>(null);

  const reset = useCallback(async () => {
    await tokenStore.clear();
    setUser(null);
    setStatus('signedOut');
  }, []);

  useEffect(() => {
    setOnAuthLost(() => void reset());
    let cancelled = false;
    (async () => {
      if (!(await tokenStore.get())) {
        if (!cancelled) setStatus('signedOut');
        return;
      }
      try {
        const me = await api.me();
        if (cancelled) return;
        if (me.role !== 'admin') return void reset();
        setUser(me);
        setStatus('signedIn');
      } catch {
        if (!cancelled) void reset();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reset]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    if (res.user.role !== 'admin') {
      await api.logout(res.tokens.refreshToken).catch(() => undefined);
      throw new Error('This account does not have admin access.');
    }
    await tokenStore.set(res.tokens);
    setUser(res.user);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    const tokens = await tokenStore.get();
    if (tokens) await api.logout(tokens.refreshToken).catch(() => undefined);
    await reset();
  }, [reset]);

  const value = useMemo(() => ({ status, user, signIn, signOut }), [status, user, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
