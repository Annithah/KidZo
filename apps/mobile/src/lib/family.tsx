import { useQuery } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Child } from '@kidzo/shared';
import { api } from './api';
import { readJson, writeJson } from './kv';
import { withOfflineCache } from './offline';
import { useSession } from './session';
import { appStore } from './storage';

const ACTIVE_KEY = 'kidzo.active-child.v1';

interface FamilyState {
  children: Child[];
  activeChild: Child | null;
  selectChild: (id: string | null) => void;
  familyMode: boolean;
  setFamilyMode: (on: boolean) => void;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

const FamilyContext = createContext<FamilyState | null>(null);

export const childrenQueryKey = ['children'] as const;

export function useChildrenQuery() {
  const { status } = useSession();
  return useQuery({
    queryKey: childrenQueryKey,
    queryFn: () => withOfflineCache('children', api.children),
    enabled: status === 'signedIn',
  });
}

export function FamilyProvider({ children: node }: { children: ReactNode }) {
  const query = useChildrenQuery();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [familyMode, setFamilyModeState] = useState(false);

  useEffect(() => {
    void readJson<{ id: string | null; familyMode: boolean }>(appStore, ACTIVE_KEY, { id: null, familyMode: false }).then(
      (saved) => {
        setActiveId(saved.id);
        setFamilyModeState(saved.familyMode);
      },
    );
  }, []);

  const persist = useCallback((id: string | null, mode: boolean) => {
    void writeJson(appStore, ACTIVE_KEY, { id, familyMode: mode });
  }, []);

  const selectChild = useCallback(
    (id: string | null) => {
      setActiveId(id);
      persist(id, familyMode);
    },
    [familyMode, persist],
  );

  const setFamilyMode = useCallback(
    (on: boolean) => {
      setFamilyModeState(on);
      persist(activeId, on);
    },
    [activeId, persist],
  );

  const list = useMemo(() => query.data ?? [], [query.data]);
  const activeChild = list.find((c) => c.id === activeId) ?? null;

  const value = useMemo<FamilyState>(
    () => ({
      children: list,
      activeChild,
      selectChild,
      familyMode,
      setFamilyMode,
      isLoading: query.isLoading,
      error: query.error,
      refetch: () => void query.refetch(),
    }),
    [list, activeChild, selectChild, familyMode, setFamilyMode, query],
  );
  return <FamilyContext.Provider value={value}>{node}</FamilyContext.Provider>;
}

export function useFamily(): FamilyState {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error('useFamily must be used inside FamilyProvider');
  return ctx;
}
