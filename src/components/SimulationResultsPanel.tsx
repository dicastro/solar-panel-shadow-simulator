import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { useAppStore } from '../store/AppStore';
import { useResultsPanel } from '../hooks/useResultsPanel';
import { useResizablePanel } from '../hooks/useResizablePanel';
import { SetupColoursUtils } from '../utils/SetupColoursUtils';
import { AnnualTab } from './results/AnnualTab';
import { MonthlyTab } from './results/MonthlyTab';
import { DailyTab } from './results/DailyTab';

import iconResetWidth from '../assets/icons/panel-reset-width.svg';
import iconExpand from '../assets/icons/panel-expand.svg';
import iconCollapse from '../assets/icons/panel-collapse.svg';
import iconMinimise from '../assets/icons/panel-minimise.svg';

const RESULTS_PANEL_DEFAULT_WIDTH = 420;
const RESULTS_PANEL_MIN_WIDTH = 280;

/**
 * Formats a Unix timestamp (ms) as a short locale date+time string.
 */
const formatComputedAt = (ts: number): string =>
  new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

/**
 * Builds the compact label shown in the simulation run selector dropdown.
 * Format: "2026 · 60 min · Geometric · 16p1t · 3 setup(s)"
 */
const buildGroupLabel = (
  g: { year: number; intervalMinutes: number; irradianceSource: string; density: number; threshold: number; setups: { setupId: string }[] },
  t: TFunction,
): string =>
  t('simulationResultsPanel.groupLabel', {
    year: g.year,
    interval: g.intervalMinutes,
    irradiance: t(`simulationResultsPanel.irradiance_${g.irradianceSource}` as any),
    samplingCode: `${g.density * g.density}p${g.threshold}t`,
    setups: g.setups.length,
  });

/**
 * The results panel floats as a fixed overlay on the right side of the screen,
 * on top of the 3D canvas. The drag handle on the left edge lets the user resize
 * it freely. Three icon buttons in the header control panel state:
 *  - Reset width (double arrow): restores default width
 *  - Expand/collapse (corner arrows): toggles fullscreen (100vw)
 *  - Minimise (arrow-to-edge): collapses the panel; a vertical restore button appears
 *
 * Below the header a parameter summary row shows the key attributes of the
 * selected simulation run (year, interval, irradiance, density, threshold).
 * Below that, the shared setup legend lets the user toggle individual setups
 * on/off across all charts simultaneously.
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
  } = useResizablePanel({
    defaultWidth: RESULTS_PANEL_DEFAULT_WIDTH,
    minWidth: RESULTS_PANEL_MIN_WIDTH,
    dragDirection: 'left',
  });

  const hasGroups = groups.length > 0;
  const hasActiveSetups = activeSetupIds.size > 0;

  const tabLabels: { key: typeof activeTab; label: string }[] = [
    { key: 'annual', label: t('resultsPanel.tabAnnual') },
    { key: 'monthly', label: t('resultsPanel.tabMonthly') },
    { key: 'daily', label: t('resultsPanel.tabDaily') },
  ];

  return (
    <>
      {panelState === 'minimised' && (
        <button
          className="results-overlay__restore-btn"
          onClick={restore}
          title={t('resultsPanel.restore')}
        >
          {t('resultsPanel.title')}
        </button>
      )}

      <div
        className="results-overlay"
        style={{ width: panelState === 'minimised' ? 0 : width }}
      >
        {panelState !== 'minimised' && (
          <div
            className={`results-overlay__drag-handle${isDragging ? ' results-overlay__drag-handle--dragging' : ''}`}
            {...dragHandleProps}
            title={t('resultsPanel.dragHint')}
          />
        )}

        {panelState !== 'minimised' && (
          <div className="results-overlay__panel">

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
                  <img src={iconResetWidth} alt="" width={16} height={16} />
                </button>
                <button
                  className="results-panel__icon-btn"
                  onClick={fullscreen}
                  title={panelState === 'fullscreen'
                    ? t('resultsPanel.exitFullscreen')
                    : t('resultsPanel.fullscreen')}
                >
                  <img
                    src={panelState === 'fullscreen' ? iconCollapse : iconExpand}
                    alt=""
                    width={16}
                    height={16}
                  />
                </button>
                <button
                  className="results-panel__icon-btn"
                  onClick={minimise}
                  title={t('resultsPanel.minimise')}
                >
                  <img src={iconMinimise} alt="" width={16} height={16} />
                </button>
              </div>
            </div>

            {!hasGroups && (
              <div className="results-panel__empty">
                {isRunning
                  ? t('simulationResultsPanel.computing')
                  : t('simulationResultsPanel.placeholder')}
              </div>
            )}

            {hasGroups && selectedGroup && (
              <>
                <div className="results-panel__params">
                  <div className="results-panel__param-row">
                    <span className="results-panel__param-key">{t('simulationResultsPanel.paramYear')}</span>
                    <span className="results-panel__param-value">{selectedGroup.year}</span>
                  </div>
                  <div className="results-panel__param-row">
                    <span className="results-panel__param-key">{t('simulationResultsPanel.paramInterval')}</span>
                    <span className="results-panel__param-value">{selectedGroup.intervalMinutes} min</span>
                  </div>
                  <div className="results-panel__param-row">
                    <span className="results-panel__param-key">{t('simulationResultsPanel.paramIrradiance')}</span>
                    <span className="results-panel__param-value">
                      {t(`simulationResultsPanel.irradiance_${selectedGroup.irradianceSource}` as any)}
                    </span>
                  </div>
                  <div className="results-panel__param-row">
                    <span className="results-panel__param-key">{t('simulationResultsPanel.paramDensity')}</span>
                    <span className="results-panel__param-value">
                      {selectedGroup.density}×{selectedGroup.density} ({selectedGroup.density * selectedGroup.density} pts/zone)
                    </span>
                  </div>
                  <div className="results-panel__param-row">
                    <span className="results-panel__param-key">{t('simulationResultsPanel.paramThreshold')}</span>
                    <span className="results-panel__param-value">{selectedGroup.threshold}</span>
                  </div>
                  <div className="results-panel__param-row">
                    <span className="results-panel__param-key">{t('simulationResultsPanel.paramComputedAt')}</span>
                    <span className="results-panel__param-value">{formatComputedAt(selectedGroup.computedAt)}</span>
                  </div>
                </div>

                <div className="results-panel__legend">
                  {selectedGroup.setups.map(setup => (
                    <button
                      key={setup.setupId}
                      className={`results-panel__legend-item${activeSetupIds.has(setup.setupId) ? '' : ' results-panel__legend-item--inactive'
                        }`}
                      onClick={() => toggleSetup(setup.setupId)}
                      title={setup.setupLabel}
                    >
                      <span
                        className="results-panel__legend-dot"
                        style={{ background: SetupColoursUtils.getSetupColour(setup.colourIndex) }}
                      />
                      <span className="results-panel__legend-label">{setup.setupLabel}</span>
                    </button>
                  ))}
                </div>

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
                        <AnnualTab results={loadedResults} activeSetupIds={activeSetupIds} />
                      )}
                      {activeTab === 'monthly' && (
                        <MonthlyTab results={loadedResults} activeSetupIds={activeSetupIds} />
                      )}
                      {activeTab === 'daily' && (
                        <DailyTab results={loadedResults} activeSetupIds={activeSetupIds} />
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