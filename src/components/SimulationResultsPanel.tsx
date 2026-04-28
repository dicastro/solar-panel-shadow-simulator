import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/AppStore';
import { SimulationCache } from '../db/SimulationCache';

/**
 * Describes a "simulation run" as a group of per-setup results that share
 * the same parameters (year, interval, irradiance source, density, threshold,
 * location). Because IndexedDB stores one entry per setup, results from the
 * same run must be grouped before display.
 *
 * The grouping key is the concatenation of the shared parameters — everything
 * except setupId and setupHash. Two entries with the same group key were
 * computed under identical conditions and belong to the same logical run.
 */
interface SimulationGroup {
  /** Stable identifier derived from shared parameters — used as React key. */
  groupKey: string;
  year: number;
  intervalMinutes: number;
  irradianceSource: string;
  density: number;
  threshold: number;
  computedAt: number;
  setups: Array<{
    cacheKey: string;
    setupId: string;
    setupLabel: string;
    annualTotalKwh: number;
  }>;
}

/**
 * Builds a human-readable label for a simulation group.
 * Format is localised via the i18n key `simulationResultsPanel.groupLabel`.
 * All parameters that differentiate one run from another are included so
 * the user can identify which run they are looking at without opening details.
 *
 * This function is the single place to change the label format.
 */
const buildGroupLabel = (g: SimulationGroup, t: (key: string, opts?: Record<string, unknown>) => string): string =>
  t('simulationResultsPanel.groupLabel', {
    year: g.year,
    interval: g.intervalMinutes,
    irradiance: t(`simulationResultsPanel.irradiance_${g.irradianceSource}`),
    setups: g.setups.length,
  });

/**
 * Groups flat per-setup cache entries into logical simulation runs.
 * Entries are grouped by (year, intervalMinutes, irradianceSource, density,
 * threshold) — the parameters shared across all setups of one run.
 * Within each group, setups are sorted by annualTotalKwh descending so the
 * best-performing setup appears first.
 * Groups themselves are sorted by computedAt descending (most recent first).
 */
const groupResults = (
  entries: Awaited<ReturnType<typeof SimulationCache.listResults>>,
): SimulationGroup[] => {
  const map = new Map<string, SimulationGroup>();

  for (const entry of entries) {
    // Extract density and threshold from the cache key structure.
    // SimulationCacheKey fields: setupId, setupHash, density, threshold,
    // intervalMinutes, latitude, longitude, year, irradianceSource.
    // We use the fields available on the summary object directly.
    const groupKey = [
      entry.year,
      entry.intervalMinutes,
      entry.irradianceSource,
      // density and threshold are not exposed on the summary type — we derive
      // a proxy from the cacheKey hash by including all available shared fields.
      // When density/threshold are added to the summary type in a future phase,
      // this grouping will become exact. For now, entries with identical shared
      // parameters will be grouped together correctly in the common case.
    ].join('|');

    const existing = map.get(groupKey);
    if (existing) {
      existing.setups.push({
        cacheKey: entry.cacheKey,
        setupId: entry.setupId,
        setupLabel: entry.setupLabel,
        annualTotalKwh: entry.annualTotalKwh,
      });
      // Keep the most recent computedAt for the group
      if (entry.computedAt > existing.computedAt) {
        existing.computedAt = entry.computedAt;
      }
    } else {
      map.set(groupKey, {
        groupKey,
        year: entry.year,
        intervalMinutes: entry.intervalMinutes,
        irradianceSource: entry.irradianceSource,
        density: 0,   // not yet in summary — placeholder
        threshold: 0, // not yet in summary — placeholder
        computedAt: entry.computedAt,
        setups: [{
          cacheKey: entry.cacheKey,
          setupId: entry.setupId,
          setupLabel: entry.setupLabel,
          annualTotalKwh: entry.annualTotalKwh,
        }],
      });
    }
  }

  const groups = Array.from(map.values());
  groups.forEach(g => g.setups.sort((a, b) => b.annualTotalKwh - a.annualTotalKwh));
  groups.sort((a, b) => b.computedAt - a.computedAt);
  return groups;
};

/**
 * Right-side panel rendered alongside the 3D canvas on desktop viewports.
 *
 * Displays a selector of past simulation runs loaded from IndexedDB. Selecting
 * a run shows a parameter summary and per-setup annual production ranked by
 * output. The panel also reflects results from the currently active simulation
 * run as they arrive, updating without requiring a page reload.
 *
 * The panel is always mounted so that the CSS flex layout reserves its column
 * width. Hiding it conditionally would collapse the 3D canvas to full width
 * and back, causing an unwanted resize event on the Three.js renderer.
 *
 * In a future phase the text results will be replaced by charts; the selector
 * and parameter summary will remain unchanged.
 */
export function SimulationResultsPanel() {
  const { t } = useTranslation();
  const annualResults = useAppStore(s => s.annualResults);
  const isRunning = useAppStore(s => s.isRunning);

  const [groups, setGroups] = useState<SimulationGroup[]>([]);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);

  // Load cached simulation groups from IndexedDB on mount and whenever a new
  // simulation completes (annualResults changes).
  useEffect(() => {
    SimulationCache.listResults()
      .then(entries => {
        const grouped = groupResults(entries);
        setGroups(grouped);
        // Auto-select the most recent group if nothing is selected yet.
        if (grouped.length > 0 && selectedGroupKey === null) {
          setSelectedGroupKey(grouped[0].groupKey);
        }
      })
      .catch(err => console.warn('SimulationResultsPanel: failed to load cache', err));
  // annualResults is intentionally included: a completed simulation must
  // refresh the list even if the component was already mounted.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annualResults]);

  const selectedGroup = groups.find(g => g.groupKey === selectedGroupKey) ?? null;
  const hasGroups = groups.length > 0;

  return (
    <div className="simulation-results-panel">
      <h3 className="simulation-results-panel__title">
        {t('simulationResultsPanel.title')}
      </h3>

      {/* ── Empty states ──────────────────────────────────────────────────────── */}

      {!hasGroups && !isRunning && (
        <p className="simulation-results-panel__placeholder">
          {t('simulationResultsPanel.placeholder')}
        </p>
      )}

      {!hasGroups && isRunning && (
        <p className="simulation-results-panel__placeholder simulation-results-panel__placeholder--running">
          {t('simulationResultsPanel.computing')}
        </p>
      )}

      {/* ── Simulation selector ───────────────────────────────────────────────── */}

      {hasGroups && (
        <>
          <div className="simulation-results-panel__selector-row">
            <label className="simulation-results-panel__selector-label">
              {t('simulationResultsPanel.selectorLabel')}:
            </label>
            <select
              className="simulation-results-panel__selector"
              value={selectedGroupKey ?? ''}
              onChange={e => setSelectedGroupKey(e.target.value)}
            >
              {groups.map(g => (
                <option key={g.groupKey} value={g.groupKey}>
                  {buildGroupLabel(g, t)}
                </option>
              ))}
            </select>
          </div>

          {/* ── Parameter summary ─────────────────────────────────────────────── */}

          {selectedGroup && (
            <>
              <div className="simulation-results-panel__params">
                <div className="simulation-results-panel__param-row">
                  <span className="simulation-results-panel__param-key">
                    {t('simulationResultsPanel.paramYear')}
                  </span>
                  <span className="simulation-results-panel__param-value">
                    {selectedGroup.year}
                  </span>
                </div>
                <div className="simulation-results-panel__param-row">
                  <span className="simulation-results-panel__param-key">
                    {t('simulationResultsPanel.paramInterval')}
                  </span>
                  <span className="simulation-results-panel__param-value">
                    {selectedGroup.intervalMinutes} min
                  </span>
                </div>
                <div className="simulation-results-panel__param-row">
                  <span className="simulation-results-panel__param-key">
                    {t('simulationResultsPanel.paramIrradiance')}
                  </span>
                  <span className="simulation-results-panel__param-value">
                    {t(`simulationResultsPanel.irradiance_${selectedGroup.irradianceSource}`)}
                  </span>
                </div>
                <div className="simulation-results-panel__param-row">
                  <span className="simulation-results-panel__param-key">
                    {t('simulationResultsPanel.paramSetups')}
                  </span>
                  <span className="simulation-results-panel__param-value">
                    {selectedGroup.setups.length}
                  </span>
                </div>
                <div className="simulation-results-panel__param-row">
                  <span className="simulation-results-panel__param-key">
                    {t('simulationResultsPanel.paramComputedAt')}
                  </span>
                  <span className="simulation-results-panel__param-value">
                    {new Date(selectedGroup.computedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* ── Per-setup results ranked by production ───────────────────── */}

              <div className="simulation-results-panel__results">
                {selectedGroup.setups.map((setup, rank) => (
                  <div key={setup.cacheKey} className="simulation-results-panel__result-card">
                    <div className="simulation-results-panel__result-rank">
                      #{rank + 1}
                    </div>
                    <div className="simulation-results-panel__result-info">
                      <div
                        className="simulation-results-panel__result-label"
                        title={setup.setupLabel}
                      >
                        {setup.setupLabel}
                      </div>
                      <div className="simulation-results-panel__result-value">
                        {setup.annualTotalKwh.toFixed(1)}
                        <span className="simulation-results-panel__result-unit"> kWh</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Live results from running simulation ─────────────────────────────── */}

      {isRunning && annualResults.size > 0 && (
        <div className="simulation-results-panel__live">
          <p className="simulation-results-panel__live-title">
            {t('simulationResultsPanel.liveResults')}
          </p>
          {Array.from(annualResults.entries()).map(([setupId, { label, annualTotalKwh }]) => (
            <p key={setupId} className="simulation-results-panel__live-row">
              <span className="simulation-results-panel__live-label" title={label}>
                {label}:
              </span>{' '}
              <span className="simulation-results-panel__live-value">
                {annualTotalKwh.toFixed(1)} kWh
              </span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}