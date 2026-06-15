import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'mnemos-dashboard-prefs';

export interface DashboardPrefs {
  pinnedRepoIds: string[];
  terminalOpen: boolean;
  terminalHeight: number;
  inspectorOpen: boolean;
  sortBy: 'name' | 'health' | 'updated';
}

const DEFAULT_PREFS: DashboardPrefs = {
  pinnedRepoIds: [],
  terminalOpen: false,
  terminalHeight: 280,
  inspectorOpen: true,
  sortBy: 'name',
};

function loadPrefs(): DashboardPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function useDashboardPrefs() {
  const [prefs, setPrefs] = useState<DashboardPrefs>(loadPrefs);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const togglePin = useCallback((repoId: string) => {
    setPrefs((p) => ({
      ...p,
      pinnedRepoIds: p.pinnedRepoIds.includes(repoId)
        ? p.pinnedRepoIds.filter((id) => id !== repoId)
        : [...p.pinnedRepoIds, repoId],
    }));
  }, []);

  const setSortBy = useCallback((sortBy: DashboardPrefs['sortBy']) => {
    setPrefs((p) => ({ ...p, sortBy }));
  }, []);

  const toggleTerminal = useCallback(() => {
    setPrefs((p) => ({ ...p, terminalOpen: !p.terminalOpen }));
  }, []);

  const setTerminalHeight = useCallback((terminalHeight: number) => {
    setPrefs((p) => ({ ...p, terminalHeight: Math.max(160, Math.min(600, terminalHeight)) }));
  }, []);

  const toggleInspector = useCallback(() => {
    setPrefs((p) => ({ ...p, inspectorOpen: !p.inspectorOpen }));
  }, []);

  return {
    prefs,
    togglePin,
    setSortBy,
    toggleTerminal,
    setTerminalHeight,
    toggleInspector,
  };
}
