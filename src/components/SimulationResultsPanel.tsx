import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { useAppStore } from '../store/AppStore';
import { useResultsPanel } from '../hooks/useResultsPanel';
import { useResizablePanel } from '../hooks/useResizablePanel';
import { SetupColoursUtils } from '../utils/SetupColoursUtils';
import { AnnualTab } from './results/AnnualTab';
import { MonthlyTab } from './results/MonthlyTab';
import { DailyTab } from './results/DailyTab';
import { ReportModal } from './results/ReportModal';
import { generatePdfReport, ReportDay, PdfLabels } from '../pdf/PdfReportGenerator';

import iconResetWidth from '../assets/icons/panel-reset-width.svg';
import iconExpand from '../assets/icons/panel-expand.svg';
import iconCollapse from '../assets/icons/panel-collapse.svg';
import iconMinimise from '../assets/icons/panel-minimise.svg';

const RESULTS_PANEL_DEFAULT_WIDTH = 420;
const RESULTS_PANEL_MIN_WIDTH = 280;

const formatComputedAt = (ts: number): string =>
  new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const buildGroupLabel = (
  g: { year: number; intervalMinutes: number; irradianceSource: string; density: number; threshold: number },
  t: TFunction,
): string =>
  t('simulationResultsPanel.groupLabel', {
    year: g.year,
    interval: g.intervalMinutes,
    irradiance: t(`simulationResultsPanel.irradiance_${g.irradianceSource}` as any),
    samplingCode: `${g.density * g.density}p${g.threshold}t`,
  });

const buildSimulationCode = (
  g: { year: number; intervalMinutes: number; irradianceSource: string; density: number; threshold: number },
): string => {
  const src = g.irradianceSource === 'open-meteo' ? 'openmeteo' : g.irradianceSource;
  return `${g.year}-${g.intervalMinutes}m-${src}-${g.density * g.density}p${g.threshold}t`;
};

const buildPdfLabels = (t: TFunction): PdfLabels => ({
  title: t('report.pdfTitle'),
  subtitle: t('report.pdfSubtitle'),
  appName: t('title'),
  labelLocation: t('report.labelLocation'),
  labelTimezone: t('report.labelTimezone'),
  labelYear: t('simulationResultsPanel.paramYear'),
  labelInterval: t('simulationResultsPanel.paramInterval'),
  labelIrradiance: t('simulationResultsPanel.paramIrradiance'),
  labelPointsPerZone: t('simulationResultsPanel.paramDensity'),
  labelThreshold: t('simulationResultsPanel.paramThreshold'),
  labelSetupsCompared: t('report.labelSetupsCompared'),
  labelComputedAt: t('simulationResultsPanel.paramComputedAt'),
  sectionAnnual: t('resultsPanel.tabAnnual'),
  sectionMonthly: t('resultsPanel.tabMonthly'),
  sectionDaily: t('resultsPanel.tabDaily'),
  sectionHeatmaps: t('report.sectionHeatmaps'),
  subLegend: t('report.subLegend'),
  subAnnualTotals: t('report.subAnnualTotals'),
  subMonthlyTotals: t('report.subMonthlyTotals'),
  subHourlyProduction: t('report.subHourlyProduction'),
  subHourlyData: t('report.subHourlyData'),
  subDailyTotals: t('report.subDailyTotals'),
  colHour: t('report.colHour'),
  colSetup: t('report.colSetup'),
  monthsShort: t('months.short', { returnObjects: true }) as string[],
  unitMin: t('report.unitMin'),
  irradianceGeometric: t('simulationResultsPanel.irradiance_geometric'),
  irradianceOpenMeteo: t('simulationResultsPanel.irradiance_open-meteo'),
  zeroSymbol: '—',
});

type ReportState = 'idle' | 'modal' | 'generating';

export function SimulationResultsPanel() {
  const { t } = useTranslation();
  const isRunning = useAppStore(s => s.isRunning);
  const timezone = useAppStore(s => s.timezone);
  const config = useAppStore(s => s.config);

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
    isSelectedGroupOutdated,
  } = useResultsPanel();

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

  const [reportState, setReportState] = useState<ReportState>('idle');
  const [reportError, setReportError] = useState<string | null>(null);

  const handleReportClick = () => {
    setReportError(null);
    setReportState('modal');
  };

  const handleModalCancel = () => setReportState('idle');

  const handleModalGenerate = async (days: ReportDay[]) => {
    if (!selectedGroup || !config) return;
    setReportState('generating');
    setReportError(null);
    try {
      await generatePdfReport({
        results: loadedResults,
        year: selectedGroup.year,
        intervalMinutes: selectedGroup.intervalMinutes,
        irradianceSource: selectedGroup.irradianceSource,
        density: selectedGroup.density,
        threshold: selectedGroup.threshold,
        latitude: config.site.location.latitude,
        longitude: config.site.location.longitude,
        timezone,
        appVersion: __APP_VERSION__,
        computedAt: selectedGroup.computedAt,
        selectedDays: days,
        labels: buildPdfLabels(t),
        simulationCode: buildSimulationCode(selectedGroup),
      });
    } catch (err) {
      setReportError(err instanceof Error ? err.message : String(err));
    } finally {
      setReportState('idle');
    }
  };

  const hasGroups = groups.length > 0;
  const hasActiveSetups = activeSetupIds.size > 0;
  const canGenerateReport = loadedResults.length > 0 && !isLoadingResults && reportState === 'idle';

  const tabLabels: { key: typeof activeTab; label: string }[] = [
    { key: 'annual', label: t('resultsPanel.tabAnnual') },
    { key: 'monthly', label: t('resultsPanel.tabMonthly') },
    { key: 'daily', label: t('resultsPanel.tabDaily') },
  ];

  return (
    <>
      {reportState === 'modal' && selectedGroup && (
        <ReportModal
          year={selectedGroup.year}
          onGenerate={handleModalGenerate}
          onCancel={handleModalCancel}
        />
      )}

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
                    <option key={g.cacheKey} value={g.cacheKey}>
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

                  {canGenerateReport && (
                    <button
                      className="results-panel__report-btn"
                      onClick={handleReportClick}
                      title={t('report.generateTitle')}
                    >
                      {t('report.generateBtn')}
                    </button>
                  )}
                  {reportState === 'generating' && (
                    <p className="results-panel__report-status">{t('report.generating')}</p>
                  )}
                  {reportError && (
                    <p className="results-panel__report-error">{reportError}</p>
                  )}
                </div>

                {isSelectedGroupOutdated && (
                  <div className="results-panel__outdated-banner">
                    <span className="results-panel__outdated-banner-icon">⚠</span>
                    <span>{t('resultsPanel.outdatedWarning')}</span>
                  </div>
                )}

                <div className="results-panel__legend">
                  {selectedGroup.setups.map(setup => (
                    <button
                      key={setup.setupId}
                      className={`results-panel__legend-item${activeSetupIds.has(setup.setupId) ? '' : ' results-panel__legend-item--inactive'}`}
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
                        <MonthlyTab results={loadedResults} activeSetupIds={activeSetupIds} year={selectedGroup.year} />
                      )}
                      {activeTab === 'daily' && (
                        <DailyTab
                          results={loadedResults}
                          activeSetupIds={activeSetupIds}
                          timezone={timezone}
                          year={selectedGroup.year}
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