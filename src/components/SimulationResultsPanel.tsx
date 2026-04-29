import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/AppStore';
import { SimulationCache } from '../db/SimulationCache';

/**
 * Describes a "simulation run" as a group of per-setup results that share
 * the same parameters (year, interval, irradiance source, density, threshold).
 * Because IndexedDB stores one entry per setup, results from the same run
 * must be grouped before display.
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
 * Builds a compact, human-readable label for a simulation group shown in the
 * selector dropdown. The density×density value and threshold are encoded as
 * e.g. "16p1t" (16 points per zone, threshold 1) to keep the label short.
 *
 * Format: "2026 · 60 min · Geometric · 16p1t · 3 setup(s)"
 *
 * This function is the single place to change the label format.
 */
const buildGroupLabel = (
  g: SimulationGroup,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string =>
  t('simulationResultsPanel.groupLabel', {
    year: g.year,
    interval: g.intervalMinutes,
    irradiance: t(`simulationResultsPanel.irradiance_${g.irradianceSource}`),
    samplingCode: `${g.density * g.density}p${g.threshold}t`,
    setups: g.setups.length,
  });

/**
 * Groups flat per-setup cache entries into logical simulation runs.
 * Entries are grouped by all parameters that are shared across setups of
 * one run: year, intervalMinutes, irradianceSource, density, threshold.
 * Within each group, setups are sorted by annualTotalKwh descending.
 * Groups themselves are sorted by computedAt descending (most recent first).
 */
const groupResults = (
  entries: Awaited<ReturnType<typeof SimulationCache.listResults>>,
): SimulationGroup[] => {
  const map = new Map<string, SimulationGroup>();

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
      });
      if (entry.computedAt > existing.computedAt) {
        existing.computedAt = entry.computedAt;
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
 * output.
 *
 * The panel is always mounted so that the CSS flex layout reserves its column
 * width. Hiding it conditionally would collapse the 3D canvas to full width
 * and back, causing an unwanted resize event on the Three.js renderer.
 *
 * When a simulation completes (`isRunning` transitions false), the panel
 * reloads IndexedDB and auto-selects the most recently computed group.
 * Partial results during an active run are not shown here — they are
 * communicated via the progress bars in SimulationControls.
 */
export function SimulationResultsPanel() {
  const { t } = useTranslation();
  const isRunning = useAppStore(s => s.isRunning);

  const [groups, setGroups] = useState<SimulationGroup[]>([]);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);

  // Track the previous isRunning value to detect the running→complete transition.
  const prevIsRunning = useRef(isRunning);

  const loadGroups = (autoSelect: boolean) => {
    SimulationCache.listResults()
      .then(entries => {
        const grouped = groupResults(entries);
        setGroups(grouped);
        if (grouped.length > 0 && (autoSelect || selectedGroupKey === null)) {
          setSelectedGroupKey(grouped[0].groupKey);
        }
      })
      .catch(err => console.warn('SimulationResultsPanel: failed to load cache', err));
  };

  // Load on mount.
  useEffect(() => {
    loadGroups(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload and auto-select when a simulation run completes.
  useEffect(() => {
    if (prevIsRunning.current && !isRunning) {
      loadGroups(true);
    }
    prevIsRunning.current = isRunning;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

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
                    {t('simulationResultsPanel.paramDensity')}
                  </span>
                  <span className="simulation-results-panel__param-value">
                    {selectedGroup.density}×{selectedGroup.density}
                  </span>
                </div>
                <div className="simulation-results-panel__param-row">
                  <span className="simulation-results-panel__param-key">
                    {t('simulationResultsPanel.paramThreshold')}
                  </span>
                  <span className="simulation-results-panel__param-value">
                    {selectedGroup.threshold}
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
    </div>
  );
}