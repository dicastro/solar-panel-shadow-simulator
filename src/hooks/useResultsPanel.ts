import { useState, useEffect, useRef, useCallback } from 'react';
import { SimulationCache } from '../db/SimulationCache';
import { SimulationGroup, SimulationGroupSetup, LoadedSetupResult } from '../types/results';
import { buildSimulationGroups } from '../utils/SimulationGroupUtils';

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
 *
 * Group construction is delegated to buildSimulationGroups, shared with the
 * settings sidebar cache management UI.
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
        const grouped = buildSimulationGroups(entries);
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

    setActiveSetupIds(new Set(selectedGroup.setups.map(s => s.setupId)));

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