import { useState, useEffect, useCallback, useMemo } from 'react';
import { SimulationCache } from '../db/SimulationCache';
import { SimulationGroup, LoadedSetupResult } from '../types/results';
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
  /**
   * True when the selected group's simulationInputHash differs from the
   * current configuration's hash — meaning the stored result was computed
   * against a different configuration than the one currently active.
   */
  isSelectedGroupOutdated: boolean;
}

export function useResultsPanel(): UseResultsPanelReturn {
  const currentSimulationInputHash = useAppStore(s => s.currentSimulationInputHash);

  const [groups, setGroups] = useState<SimulationGroup[]>([]);
  const [selectedGroupKey, setSelectedGroupKeyState] = useState<string | null>(null);
  const [activeSetupIds, setActiveSetupIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<ResultsTab>('annual');
  const [loadedResults, setLoadedResults] = useState<LoadedSetupResult[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  const reloadGroups = useCallback((autoSelect: boolean) => {
    SimulationCache.listResults()
      .then(summaries => {
        const grouped = buildSimulationGroups(summaries);
        setGroups(grouped);
        if (grouped.length > 0 && (autoSelect || selectedGroupKey === null)) {
          setSelectedGroupKeyState(grouped[0].cacheKey);
        } else if (grouped.length === 0) {
          setSelectedGroupKeyState(null);
        }
      })
      .catch(err => console.warn('useResultsPanel: failed to load cache', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const selectedGroup = groups.find(g => g.cacheKey === selectedGroupKey) ?? null;

  useEffect(() => {
    if (!selectedGroup) {
      setLoadedResults([]);
      setActiveSetupIds(new Set());
      return;
    }

    setActiveSetupIds(new Set(selectedGroup.setups.map(s => s.setupId)));
    setIsLoadingResults(true);
    setLoadedResults([]);

    SimulationCache.getResult(selectedGroup.cacheKey)
      .then(runResult => {
        if (!runResult) return;
        // Map each setup result to a LoadedSetupResult, preserving the colour
        // index assigned during group building (by annualTotalKwh ranking).
        const colourBySetupId = new Map(
          selectedGroup.setups.map(s => [s.setupId, s.colourIndex]),
        );
        const loaded: LoadedSetupResult[] = runResult.setups.map(setupResult => ({
          setupId: setupResult.setupId,
          result: setupResult,
          colourIndex: colourBySetupId.get(setupResult.setupId) ?? 0,
        }));
        // Sort by colour index so charts always render in ranked order.
        loaded.sort((a, b) => a.colourIndex - b.colourIndex);
        setLoadedResults(loaded);
      })
      .catch(err => console.warn('useResultsPanel: failed to load full result', err))
      .finally(() => setIsLoadingResults(false));
  }, [selectedGroupKey]); // eslint-disable-line react-hooks/exhaustive-deps

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

  /**
   * The selected group is outdated when the hash stored in the simulation
   * result does not match the hash of the current configuration. This covers
   * all changes that affect simulation output (everything except timezone and
   * floorColor), including changes to walls, site coordinates, albedo, panel
   * geometry, strings, and optimizer assignments.
   */
  const isSelectedGroupOutdated = useMemo((): boolean => {
    if (!selectedGroup || !currentSimulationInputHash) return false;
    return selectedGroup.simulationInputHash !== currentSimulationInputHash;
  }, [selectedGroup, currentSimulationInputHash]);

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
    isSelectedGroupOutdated,
  };
}