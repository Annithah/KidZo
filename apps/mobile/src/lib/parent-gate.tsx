import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { PARENT_UNLOCK_MS } from './config';

interface ParentGateState {
  unlocked: boolean;
  unlock: () => void;
  lock: () => void;
  /** Extends the unlock window while a grown-up is active in the parent area. */
  touch: () => void;
}

const ParentGateContext = createContext<ParentGateState | null>(null);

/**
 * Tracks whether a grown-up has passed the PIN gate. The unlock expires after a few minutes
 * of inactivity and immediately when the app goes to the background.
 */
export function ParentGateProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const expiresAt = useRef(0);

  const lock = useCallback(() => {
    expiresAt.current = 0;
    setUnlocked(false);
  }, []);

  const unlock = useCallback(() => {
    expiresAt.current = Date.now() + PARENT_UNLOCK_MS;
    setUnlocked(true);
  }, []);

  const touch = useCallback(() => {
    if (expiresAt.current > Date.now()) expiresAt.current = Date.now() + PARENT_UNLOCK_MS;
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    const timer = setInterval(() => {
      if (Date.now() > expiresAt.current) lock();
    }, 15_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') lock();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [unlocked, lock]);

  const value = useMemo(() => ({ unlocked, unlock, lock, touch }), [unlocked, unlock, lock, touch]);
  return <ParentGateContext.Provider value={value}>{children}</ParentGateContext.Provider>;
}

export function useParentGate(): ParentGateState {
  const ctx = useContext(ParentGateContext);
  if (!ctx) throw new Error('useParentGate must be used inside ParentGateProvider');
  return ctx;
}
