import { useState, useEffect, useCallback } from 'react';
import { SimulationCache } from '../db/SimulationCache';
import { SimulationGroup, SimulationGroupSetup, LoadedSetupResult } from '../types/results';
import { buildSimulationGroups } from '../utils/SimulationGroupUtils';
import { appEvents } from '../events/AppEvents';
import { useAppStore } from '../store/AppStore';

export type ResultsTab = 'annual' | 'monthly' | 'daily';

interface UseResultsPanelReturn {
  groups: SimulationGroup[];
  selectedGroup: SimulationGroup | null;
  selectedGroupKey: string | null;
  setSelectedGroupKey: (key: string) => void;
  activeSetupIds: Set<string>;
  toggleSetup: (setupId: string) => void;
  activeTab: ResultsTab;
  setActiveTab: (tab: ResultsTab) => void;
  loadedResults: LoadedSetupResult[];
  isLoadingResults: boolean;
}

/**
 * Derives the set of setupIds that are valid for the current configuration.
 *
 * A setupId is the stable identifier derived from a setup's label and its
 * index within the config's setups array (see PanelSetupFactory.deriveSetupId).
 * Only simulation results whose setupId appears in this set belong to the
 * current configuration and should be shown in the results panel.
 *
 * The derivation mirrors PanelSetupFactory.deriveSetupId exactly so the
 * two stay in sync without importing the factory here.
 */
const deriveSetupId = (label: string, index: number): string => {
  const normalised = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  return `${normalised}-${index}`;
};

/**
 * Encapsulates all state for the results panel: group listing, selection,
 * legend toggle, tab navigation, and lazy loading of full result data.
 *
 * Only simulation results that belong to the current active configuration are
 * shown. A result belongs to the current config when its setupId matches one
 * of the setupIds derived from the config's setups array. This ensures that
 * results from a previous configuration — which may still be present in
 * IndexedDB — are not visible after the config changes, regardless of whether
 * the user chose to keep or delete them.
 *
 * The hook reloads its data in response to the simulationResultsChanged event
 * emitted via the application event bus. The autoSelect payload controls
 * whether the first available group should be selected after reloading.
 */
export function useResultsPanel(): UseResultsPanelReturn {
  const config = useAppStore(s => s.config);

  const [groups, setGroups] = useState<SimulationGroup[]>([]);
  const [selectedGroupKey, setSelectedGroupKeyState] = useState<string | null>(null);
  const [activeSetupIds, setActiveSetupIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<ResultsTab>('annual');
  const [loadedResults, setLoadedResults] = useState<LoadedSetupResult[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  const reloadGroups = useCallback((autoSelect: boolean) => {
    if (!config) return;

    // Re-derive inside the callback to capture the latest config at call time.
    const currentValidIds = new Set(
      config.setups.map((s, i) => deriveSetupId(s.label, i)),
    );

    SimulationCache.listResults()
      .then(entries => {
        // Keep only entries that belong to the current configuration.
        const filtered = entries.filter(e => currentValidIds.has(e.setupId));
        const grouped = buildSimulationGroups(filtered);
        setGroups(grouped);
        if (grouped.length > 0 && (autoSelect || selectedGroupKey === null)) {
          setSelectedGroupKeyState(grouped[0].groupKey);
        } else if (grouped.length === 0) {
          setSelectedGroupKeyState(null);
        }
      })
      .catch(err => console.warn('useResultsPanel: failed to load cache', err));
  // selectedGroupKey intentionally excluded: it must not cause a stale closure
  // inside the callback — we read it only as an initial-load hint.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Reload whenever config changes (different validSetupIds) or on mount.
  useEffect(() => {
    reloadGroups(false);
  }, [reloadGroups]);

  // Also reload in response to IndexedDB mutations from other parts of the app.
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