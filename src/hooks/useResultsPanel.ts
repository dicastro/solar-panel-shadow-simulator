import { useState, useEffect, useCallback, useMemo } from 'react';
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

const deriveSetupId = (label: string, index: number): string => {
  const normalised = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  return `${normalised}-${index}`;
};

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

    const currentValidIds = new Set(
      config.setups.map((s, i) => deriveSetupId(s.label, i)),
    );

    SimulationCache.listResults()
      .then(entries => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    reloadGroups(false);
  }, [reloadGroups]);

  useEffect(() => {
    const handler = ({ autoSelect }: { autoSelect: boolean }) => {
      reloadGroups(autoSelect);
    };
    appEvents.on('simulationResultsChanged', handler);
    return () => appEvents.off('simulationResultsChanged', handler);
  }, [reloadGroups]);

  const selectedGroup = groups.find(g => g.groupKey === selectedGroupKey) ?? null;

  /**
   * Stable signature of the selected group's setup list. Changing when setups
   * are added or removed from the group (e.g. after a cache deletion) even
   * though the groupKey itself stays the same. Used as a dependency for the
   * full-data loading effect so charts refresh without requiring a page reload.
   */
  const selectedGroupSignature = useMemo(
    () => selectedGroup?.setups.map(s => s.cacheKey).join('|') ?? null,
    [selectedGroup],
  );

  useEffect(() => {
    if (!selectedGroup || selectedGroupSignature === null) {
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
    // selectedGroupSignature captures the content of the group; selectedGroupKey
    // captures which group is selected. Both are needed: key for group switches,
    // signature for in-place mutations (setup deletion within the same group).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupKey, selectedGroupSignature]);

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