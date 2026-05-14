import { useState, useEffect, useCallback } from 'react';
import { SimulationCache } from '../db/SimulationCache';
import { SimulationGroup, SimulationGroupSetup, LoadedSetupResult } from '../types/results';
import { buildSimulationGroups } from '../utils/SimulationGroupUtils';
import { appEvents } from '../events/AppEvents';

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
}

/**
 * Encapsulates all state for the results panel: group listing, selection,
 * legend toggle, tab navigation, and lazy loading of full result data.
 *
 * Kept outside SimulationResultsPanel so the panel component stays focused
 * on rendering.
 *
 * Group construction is delegated to buildSimulationGroups, shared with the
 * settings sidebar cache management UI.
 *
 * The hook reloads its data in response to the simulationResultsChanged event
 * emitted via the application event bus (mitt). Any component that modifies
 * IndexedDB simulation results emits this event. The autoSelect payload
 * controls whether the first available group should be selected after reloading.
 */
export function useResultsPanel(): UseResultsPanelReturn {
  const [groups, setGroups] = useState<SimulationGroup[]>([]);
  const [selectedGroupKey, setSelectedGroupKeyState] = useState<string | null>(null);
  const [activeSetupIds, setActiveSetupIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<ResultsTab>('annual');
  const [loadedResults, setLoadedResults] = useState<LoadedSetupResult[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  const reloadGroups = useCallback((autoSelect: boolean) => {
    SimulationCache.listResults()
      .then(entries => {
        const grouped = buildSimulationGroups(entries);
        setGroups(grouped);
        if (grouped.length > 0 && (autoSelect || selectedGroupKey === null)) {
          setSelectedGroupKeyState(grouped[0].groupKey);
        } else if (grouped.length === 0) {
          setSelectedGroupKeyState(null);
        }
      })
      .catch(err => console.warn('useResultsPanel: failed to load cache', err));
  }, [selectedGroupKey]);

  // Load on mount.
  useEffect(() => {
    reloadGroups(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to the application event bus. Any part of the app that modifies
  // IndexedDB simulation results emits simulationResultsChanged so this hook
  // reloads without polling or artificial state dependencies.
  useEffect(() => {
    const handler = ({ autoSelect }: { autoSelect: boolean }) => {
      reloadGroups(autoSelect);
    };
    appEvents.on('simulationResultsChanged', handler);
    return () => appEvents.off('simulationResultsChanged', handler);
  }, [reloadGroups]);

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
  };
}