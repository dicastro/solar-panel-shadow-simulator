import { useTranslation } from 'react-i18next';
import { useAppStore, availableSimulationYears, availableIntervals, SimulationInterval } from '../store/AppStore';
import { IrradianceSource } from '../types/simulation';
import { AnnualSimulationProgress } from './AnnualSimulationProgress';

/**
 * Bottom-left panel: annual simulation parameters, run/stop control,
 * per-setup progress bars, and annual results summary.
 *
 * All sampling parameters here (simulationDensity, simulationThreshold) are
 * independent of the render controls in RenderControls. Changing them only
 * affects future simulation runs — the 3D view is unaffected.
 *
 * Both the interval selector and the year selector are conditioned to the
 * selected irradiance source:
 *
 * - Open-Meteo only provides DNI at hourly resolution, so intervals below
 *   60 min are hidden.
 * - Open-Meteo only covers completed past years via its historical archive.
 *   The current year is excluded to prevent the user from obtaining results
 *   where all future hours are 0 W/m².
 *
 * Switching the irradiance source resets both interval and year to valid
 * defaults atomically in the store (SimulationSlice.setIrradianceSource).
 *
 * Ray count derivation:
 *   totalZones        = sum of zone counts across every panel in the active setup
 *   totalSamplePoints = totalZones × simulationDensity²
 *   totalRays         = totalSamplePoints × timeSteps
 */
export function SimulationControls() {
  const { t } = useTranslation();

  const simulationDensity = useAppStore(s => s.simulationDensity);
  const setSimulationDensity = useAppStore(s => s.setSimulationDensity);
  const simulationThreshold = useAppStore(s => s.simulationThreshold);
  const setSimulationThreshold = useAppStore(s => s.setSimulationThreshold);
  const isRunning = useAppStore(s => s.isRunning);
  const simulationInterval = useAppStore(s => s.simulationInterval);
  const setSimulationInterval = useAppStore(s => s.setSimulationInterval);
  const activeSetup = useAppStore(s => s.activeSetup);
  const simulationYear = useAppStore(s => s.simulationYear);
  const setSimulationYear = useAppStore(s => s.setSimulationYear);
  const irradianceSource = useAppStore(s => s.irradianceSource);
  const setIrradianceSource = useAppStore(s => s.setIrradianceSource);
  const startSimulation = useAppStore(s => s.startSimulation);
  const stopSimulation = useAppStore(s => s.stopSimulation);

  const maxPointsPerZone = simulationDensity * simulationDensity;
  const allPanels = activeSetup?.panelArrays.flatMap(pa => pa.panels) ?? [];
  const totalZones = allPanels.reduce((sum, p) => sum + p.zones, 0);
  const totalSamplePoints = totalZones * simulationDensity * simulationDensity;
  const timeSteps = Math.floor((365 * 24 * 60) / simulationInterval);
  const totalRays = totalSamplePoints * timeSteps;

  const intervals = availableIntervals(irradianceSource);
  const years = availableSimulationYears(irradianceSource);

  const handleRunStop = () => {
    if (isRunning) {
      if (window.confirm(t('simulationControls.stopConfirm'))) {
        stopSimulation();
      }
    } else {
      startSimulation();
    }
  };

  return (
    <div className="controls-panel simulation-panel">
      <h3>{t('simulationControls.title')}</h3>

      <div className="control-row">
        <label>{t('simulationControls.irradianceSource')}:</label>
        <select
          value={irradianceSource}
          onChange={e => setIrradianceSource(e.target.value as IrradianceSource)}
          disabled={isRunning}
        >
          <option value="geometric">{t('simulationControls.irradianceGeometric')}</option>
          <option value="open-meteo">Open-Meteo</option>
        </select>
      </div>

      <div className="control-row">
        <label>{t('simulationControls.interval')}:</label>
        <select
          value={simulationInterval}
          onChange={e => setSimulationInterval(Number(e.target.value) as SimulationInterval)}
          disabled={isRunning || intervals.length === 1}
        >
          {intervals.includes(15) && <option value={15}>15 min</option>}
          {intervals.includes(30) && <option value={30}>30 min</option>}
          <option value={60}>1 h</option>
        </select>
      </div>

      <div className="control-row">
        <label>{t('simulationControls.year')}:</label>
        <select
          value={simulationYear}
          onChange={e => setSimulationYear(Number(e.target.value))}
          disabled={isRunning}
        >
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="control-row">
        <label>{t('simulationControls.pointsPerZone')}:</label>
        <input
          type="number"
          value={simulationDensity}
          min={2}
          max={16}
          onChange={e => setSimulationDensity(Number(e.target.value))}
          disabled={isRunning}
        />
      </div>

      <div className="control-row">
        <label title={t('simulationControls.thresholdTooltip')}>
          {t('simulationControls.threshold')}:
        </label>
        <input
          type="number"
          value={simulationThreshold}
          min={1}
          max={maxPointsPerZone}
          onChange={e =>
            setSimulationThreshold(Math.max(1, Math.min(maxPointsPerZone, Number(e.target.value))))
          }
          disabled={isRunning}
        />
        <span className="simulation-threshold-max">/ {maxPointsPerZone}</span>
      </div>

      <div className="simulation-status">
        <p>{t('simulationControls.totalSamplePoints')}: {totalSamplePoints.toLocaleString()}</p>
        <p>{t('simulationControls.timeSteps')}: {timeSteps.toLocaleString()}</p>
        <p><strong>{t('simulationControls.totalRays')}: {totalRays.toLocaleString()}</strong></p>
      </div>

      <AnnualSimulationProgress />

      <div className="button-group">
        <button
          className={isRunning ? 'pause-btn' : 'play-btn'}
          onClick={handleRunStop}
        >
          {isRunning ? t('simulationControls.stop') : t('simulationControls.run')}
        </button>
      </div>
    </div>
  );
}