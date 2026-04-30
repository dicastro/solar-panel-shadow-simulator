import { useState, useEffect, useRef, useCallback } from 'react';
import { SimulationCache } from '../db/SimulationCache';
import { SimulationGroup, SimulationGroupSetup, LoadedSetupResult } from '../types/results';

/**
 * Groups flat per-setup cache entries into logical simulation runs.
 * Entries sharing all parameters (year, interval, irradiance, density,
 * threshold) form one group. Within a group, setups are ordered by
 * annualTotalKwh descending so the ranking is already applied. Groups
 * are ordered by computedAt descending (most recent first).
 */
const buildGroups = (
  entries: Awaited<ReturnType<typeof SimulationCache.listResults>>,
): SimulationGroup[] => {
  const map = new Map<string, SimulationGroup & { setups: SimulationGroupSetup[] }>();

  for (const entry of entries) {
    const groupKey = [
      entry.year,
      entry.intervalMinutes,
      entry.irradianceSource,
      entry.density,
      entry.threshold,
    ].join('|');

    const existing = map.get(groupKey);
    if (existing) {
      existing.setups.push({
        cacheKey: entry.cacheKey,
        setupId: entry.setupId,
        setupLabel: entry.setupLabel,
        annualTotalKwh: entry.annualTotalKwh,
        colourIndex: existing.setups.length,
      });
      if (entry.computedAt > existing.computedAt) {
        (existing as { computedAt: number }).computedAt = entry.computedAt;
      }
    } else {
      map.set(groupKey, {
        groupKey,
        year: entry.year,
        intervalMinutes: entry.intervalMinutes,
        irradianceSource: entry.irradianceSource,
        density: entry.density,
        threshold: entry.threshold,
        computedAt: entry.computedAt,
        setups: [{
          cacheKey: entry.cacheKey,
          setupId: entry.setupId,
          setupLabel: entry.setupLabel,
          annualTotalKwh: entry.annualTotalKwh,
          colourIndex: 0,
        }],
      });
    }
  }

  const groups = Array.from(map.values());
  groups.forEach(g => {
    g.setups.sort((a, b) => b.annualTotalKwh - a.annualTotalKwh);
    // Re-assign colour indices after sorting so the best setup is always colour 0.
    g.setups.forEach((s, i) => {
      (s as { colourIndex: number }).colourIndex = i;
    });
  });
  groups.sort((a, b) => b.computedAt - a.computedAt);
  return groups;
};

export type ResultsTab = 'annual' | 'monthly' | 'daily';

interface UseResultsPanelReturn {
  groups: SimulationGroup[];
  selectedGroup: SimulationGroup | null;
  selectedGroupKey: string | null;
  setSelectedGroupKey: (key: string) => void;

  /** IDs of setups whose series are currently visible in charts. */
  activeSetupIds: Set<string>;
  toggleSetup: (setupId: string) => void;

  activeTab: ResultsTab;
  setActiveTab: (tab: ResultsTab) => void;

  /** Full result data loaded from IndexedDB for the selected group. */
  loadedResults: LoadedSetupResult[];
  isLoadingResults: boolean;

  /** Reload groups from IndexedDB and optionally auto-select the newest. */
  reloadGroups: (autoSelect: boolean) => void;
}

/**
 * Encapsulates all state for the results panel: group listing, selection,
 * legend toggle, tab navigation, and lazy loading of full result data.
 *
 * Kept outside SimulationResultsPanel so the panel component stays focused
 * on rendering. The hook is also easier to test in isolation.
 */
export function useResultsPanel(isRunning: boolean): UseResultsPanelReturn {
  const [groups, setGroups] = useState<SimulationGroup[]>([]);
  const [selectedGroupKey, setSelectedGroupKeyState] = useState<string | null>(null);
  const [activeSetupIds, setActiveSetupIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<ResultsTab>('annual');
  const [loadedResults, setLoadedResults] = useState<LoadedSetupResult[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  const prevIsRunning = useRef(isRunning);

  const reloadGroups = useCallback((autoSelect: boolean) => {
    SimulationCache.listResults()
      .then(entries => {
        const grouped = buildGroups(entries);
        setGroups(grouped);
        if (grouped.length > 0 && (autoSelect || selectedGroupKey === null)) {
          setSelectedGroupKeyState(grouped[0].groupKey);
        }
      })
      .catch(err => console.warn('useResultsPanel: failed to load cache', err));
  }, [selectedGroupKey]);

  // Load on mount.
  useEffect(() => {
    reloadGroups(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload and auto-select when a simulation run completes.
  useEffect(() => {
    if (prevIsRunning.current && !isRunning) {
      reloadGroups(true);
    }
    prevIsRunning.current = isRunning;
  }, [isRunning, reloadGroups]);

  const selectedGroup = groups.find(g => g.groupKey === selectedGroupKey) ?? null;

  // When the selected group changes, activate all its setups and load full data.
  useEffect(() => {
    if (!selectedGroup) {
      setLoadedResults([]);
      setActiveSetupIds(new Set());
      return;
    }

    // Activate all setups by default.
    setActiveSetupIds(new Set(selectedGroup.setups.map(s => s.setupId)));

    // Lazy-load full result data from IndexedDB.
    setIsLoadingResults(true);
    setLoadedResults([]);

    Promise.all(
      selectedGroup.setups.map(setup =>
        SimulationCache.getResult(setup.cacheKey).then(result => ({ setup, result })),
      ),
    )
      .then(results => {
        const loaded: LoadedSetupResult[] = results
          .filter((r): r is { setup: SimulationGroupSetup; result: NonNullable<typeof r.result> } =>
            r.result !== null,
          )
          .map(({ setup, result }) => ({
            setupId: setup.setupId,
            result,
            colourIndex: setup.colourIndex,
          }));
        setLoadedResults(loaded);
      })
      .catch(err => console.warn('useResultsPanel: failed to load full results', err))
      .finally(() => setIsLoadingResults(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupKey]);

  const setSelectedGroupKey = useCallback((key: string) => {
    setSelectedGroupKeyState(key);
  }, []);

  const toggleSetup = useCallback((setupId: string) => {
    setActiveSetupIds(prev => {
      const next = new Set(prev);
      if (next.has(setupId)) {
        // Never deactivate the last active setup — at least one must remain.
        if (next.size <= 1) return prev;
        next.delete(setupId);
      } else {
        next.add(setupId);
      }
      return next;
    });
  }, []);

  return {
    groups,
    selectedGroup,
    selectedGroupKey,
    setSelectedGroupKey,
    activeSetupIds,
    toggleSetup,
    activeTab,
    setActiveTab,
    loadedResults,
    isLoadingResults,
    reloadGroups,
  };
}