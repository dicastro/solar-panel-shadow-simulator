import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/AppStore';
import { useResultsPanel } from '../hooks/useResultsPanel';
import { useResizablePanel } from '../hooks/useResizablePanel';
import { SetupColoursUtils } from '../utils/SetupColoursUtils';
import { AnnualTab } from './results/AnnualTab';
import { MonthlyTab } from './results/MonthlyTab';
import { DailyTab } from './results/DailyTab';

/**
 * Builds the compact label shown in the simulation run selector dropdown.
 * Format: "2026 · 60 min · Geometric · 16p1t · 3 setup(s)"
 */
const buildGroupLabel = (
  g: { year: number; intervalMinutes: number; irradianceSource: string; density: number; threshold: number; setups: { setupId: string }[] },
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
 * The results panel floats as a fixed overlay on the right side of the screen,
 * on top of the 3D canvas. The drag handle on the left edge lets the user resize
 * it freely. Four buttons control its state: minimise, restore, fullscreen, reset.
 *
 * Content is organised into three tabs (Annual, Monthly, Daily), each with a
 * Production section and a Shadows section. A shared legend above the tabs lets
 * the user toggle individual setups on/off; all charts update accordingly.
 *
 * Full result data (per-panel energy and shade fractions) is loaded lazily from
 * IndexedDB when the selected simulation group changes, so the summary list
 * remains fast even with many cached runs.
 */
export function SimulationResultsPanel() {
  const { t } = useTranslation();
  const isRunning = useAppStore(s => s.isRunning);

  const {
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
  } = useResultsPanel(isRunning);

  const {
    width,
    panelState,
    isDragging,
    dragHandleProps,
    minimise,
    restore,
    fullscreen,
    resetWidth,
  } = useResizablePanel();

  const hasGroups = groups.length > 0;
  const hasActiveSetups = activeSetupIds.size > 0;

  const tabLabels: { key: typeof activeTab; label: string }[] = [
    { key: 'annual', label: t('resultsPanel.tabAnnual') },
    { key: 'monthly', label: t('resultsPanel.tabMonthly') },
    { key: 'daily', label: t('resultsPanel.tabDaily') },
  ];

  return (
    <>
      {/* Restore button — only visible when minimised */}
      {panelState === 'minimised' && (
        <button
          className="results-overlay__restore-btn"
          onClick={restore}
          title={t('resultsPanel.restore')}
        >
          {t('resultsPanel.title')}
        </button>
      )}

      {/* Overlay wrapper */}
      <div
        className="results-overlay"
        style={{ width: panelState === 'minimised' ? 0 : width }}
      >
        {/* Drag handle */}
        {panelState !== 'minimised' && (
          <div
            className={`results-overlay__drag-handle${isDragging ? ' results-overlay__drag-handle--dragging' : ''}`}
            {...dragHandleProps}
            title={t('resultsPanel.dragHint')}
          />
        )}

        {/* Panel body */}
        {panelState !== 'minimised' && (
          <div className="results-overlay__panel">

            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="results-panel__header">
              <span className="results-panel__header-title">
                {t('resultsPanel.title')}
              </span>

              {hasGroups && (
                <select
                  className="results-panel__selector"
                  value={selectedGroupKey ?? ''}
                  onChange={e => setSelectedGroupKey(e.target.value)}
                >
                  {groups.map(g => (
                    <option key={g.groupKey} value={g.groupKey}>
                      {buildGroupLabel(g, t)}
                    </option>
                  ))}
                </select>
              )}

              <div className="results-panel__header-btns">
                <button
                  className="results-panel__icon-btn"
                  onClick={resetWidth}
                  title={t('resultsPanel.resetWidth')}
                >
                  ⟳
                </button>
                <button
                  className="results-panel__icon-btn"
                  onClick={fullscreen}
                  title={panelState === 'fullscreen'
                    ? t('resultsPanel.exitFullscreen')
                    : t('resultsPanel.fullscreen')}
                >
                  {panelState === 'fullscreen' ? '⊠' : '⛶'}
                </button>
                <button
                  className="results-panel__icon-btn"
                  onClick={minimise}
                  title={t('resultsPanel.minimise')}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* ── No data states ────────────────────────────────────────────── */}
            {!hasGroups && (
              <div className="results-panel__empty">
                {isRunning
                  ? t('simulationResultsPanel.computing')
                  : t('simulationResultsPanel.placeholder')}
              </div>
            )}

            {/* ── Content when groups exist ──────────────────────────────────── */}
            {hasGroups && selectedGroup && (
              <>
                {/* Shared setup legend */}
                <div className="results-panel__legend">
                  {selectedGroup.setups.map(setup => (
                    <button
                      key={setup.setupId}
                      className={`results-panel__legend-item${
                        activeSetupIds.has(setup.setupId) ? '' : ' results-panel__legend-item--inactive'
                      }`}
                      onClick={() => toggleSetup(setup.setupId)}
                      title={setup.setupLabel}
                    >
                      <span
                        className="results-panel__legend-dot"
                        style={{ background: SetupColoursUtils.getSetupColour(setup.colourIndex) }}
                      />
                      {setup.setupLabel}
                    </button>
                  ))}
                </div>

                {/* Tab bar */}
                <div className="results-panel__tabs">
                  {tabLabels.map(({ key, label }) => (
                    <button
                      key={key}
                      className={`results-panel__tab${activeTab === key ? ' results-panel__tab--active' : ''}`}
                      onClick={() => setActiveTab(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="results-panel__content">
                  {isLoadingResults ? (
                    <div className="results-panel__loading">
                      <div className="results-panel__spinner" />
                      <span>{t('resultsPanel.loading')}</span>
                    </div>
                  ) : !hasActiveSetups ? (
                    <div className="results-panel__empty">
                      {t('resultsPanel.noActiveSetups')}
                    </div>
                  ) : (
                    <>
                      {activeTab === 'annual' && (
                        <AnnualTab
                          results={loadedResults}
                          activeSetupIds={activeSetupIds}
                        />
                      )}
                      {activeTab === 'monthly' && (
                        <MonthlyTab
                          results={loadedResults}
                          activeSetupIds={activeSetupIds}
                        />
                      )}
                      {activeTab === 'daily' && (
                        <DailyTab
                          results={loadedResults}
                          activeSetupIds={activeSetupIds}
                        />
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}