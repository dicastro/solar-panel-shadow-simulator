import { SimulationGroup, SimulationGroupSetup } from '../types/results';
import { SimulationCache } from '../db/SimulationCache';

type CacheEntry = Awaited<ReturnType<typeof SimulationCache.listResults>>[number];

/**
 * Groups flat per-setup cache entries into logical simulation runs.
 *
 * Entries sharing the same parameters (year, interval, irradiance source,
 * density, threshold) form one group. Within a group, setups are ordered by
 * annualTotalKwh descending so the ranking is already applied. Groups are
 * ordered by computedAt descending (most recent first).
 *
 * Extracted here so both the results panel and the settings sidebar cache
 * management UI can consume the same grouping logic without duplication.
 */
export const buildSimulationGroups = (entries: CacheEntry[]): SimulationGroup[] => {
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
    g.setups.forEach((s, i) => {
      (s as { colourIndex: number }).colourIndex = i;
    });
  });
  groups.sort((a, b) => b.computedAt - a.computedAt);
  return groups;
};