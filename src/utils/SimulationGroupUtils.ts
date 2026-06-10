import { SimulationGroup } from '../types/results';
import { SimulationRunSummary } from '../types/results';

/**
 * Converts flat SimulationRunSummary records from IndexedDB into the
 * SimulationGroup shape consumed by the results panel UI.
 *
 * One SimulationRunSummary maps directly to one SimulationGroup — there is
 * no grouping step because each IDB record already represents a complete run
 * (all setups together). Groups are sorted by computedAt descending so the
 * most recent run appears first in the selector.
 *
 * Setup colour indices are assigned by annualTotalKwh descending so the
 * highest-producing setup always receives colour index 0 (green).
 */
export const buildSimulationGroups = (summaries: SimulationRunSummary[]): SimulationGroup[] => {
  const groups: SimulationGroup[] = summaries
    .map((summary): SimulationGroup => {
      const sortedSetups = [...summary.setups]
        .sort((a, b) => b.annualTotalKwh - a.annualTotalKwh)
        .map((s, i) => ({
          setupId: s.setupId,
          setupLabel: s.setupLabel,
          annualTotalKwh: s.annualTotalKwh,
          colourIndex: i,
        }));

      return {
        cacheKey: summary.cacheKey,
        simulationInputHash: summary.simulationInputHash,
        year: summary.year,
        intervalMinutes: summary.intervalMinutes,
        irradianceSource: summary.irradianceSource,
        density: summary.density,
        threshold: summary.threshold,
        computedAt: summary.computedAt,
        setups: sortedSetups,
      };
    })
    .sort((a, b) => b.computedAt - a.computedAt);

  return groups;
};