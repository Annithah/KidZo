import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface GuestState {
  age: number | null;
  setAge: (age: number | null) => void;
}

const GuestContext = createContext<GuestState | null>(null);

export function GuestProvider({ children }: { children: ReactNode }) {
  const [age, setAgeState] = useState<number | null>(null);
  const setAge = useCallback((value: number | null) => setAgeState(value), []);
  const value = useMemo(() => ({ age, setAge }), [age, setAge]);
  return <GuestContext.Provider value={value}>{children}</GuestContext.Provider>;
}

export function useGuest(): GuestState {
  const guest = useContext(GuestContext);
  if (!guest) throw new Error('useGuest must be used inside GuestProvider');
  return guest;
}
