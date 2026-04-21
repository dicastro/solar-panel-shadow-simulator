import { useTranslation } from 'react-i18next';
import { useAppStore, SimulationInterval } from '../store/useAppStore';

/**
 * Bottom-left panel: simulation settings and instant production readout.
 *
 * Derivation of panel/zone/point counters:
 *  - All counters are derived from `activeSetup` (the currently selected setup)
 *    rather than from `config.setups[0]`. This matters when multiple setups
 *    are defined and the user switches between them — each setup can have a
 *    different panel count, zone count, or per-panel overrides.
 *  - `zonesPerPanel` uses the maximum zones across all panels in the active
 *    setup, since individual arrays can override the default zone count.
 *    Showing the max gives a conservative (upper-bound) estimate of ray count.
 */
export function SimulationControls() {
  const { t } = useTranslation();

  const showPoints = useAppStore(s => s.showPoints);
  const setShowPoints = useAppStore(s => s.setShowPoints);
  const density = useAppStore(s => s.density);
  const setDensity = useAppStore(s => s.setDensity);
  const threshold = useAppStore(s => s.threshold);
  const setThreshold = useAppStore(s => s.setThreshold);
  const isRunning = useAppStore(s => s.isRunning);
  const setIsRunning = useAppStore(s => s.setIsRunning);
  const simulationInterval = useAppStore(s => s.simulationInterval);
  const setSimulationInterval = useAppStore(s => s.setSimulationInterval);
  const activeSetup = useAppStore(s => s.activeSetup);
  const simulationResult = useAppStore(s => s.simulationResult);

  const instantPower = simulationResult?.instantPower ?? 0;
  const maxPointsPerZone = density * density;

  // Derive all counters from the active setup, not from config.setups[0].
  // Different setups (and even different arrays within a setup) can have
  // different panel/zone configurations.
  const allPanels = activeSetup?.panelArrays.flatMap(pa => pa.panels) ?? [];
  const totalPanels = allPanels.length;

  // Use the maximum zone count across all panels as a conservative estimate.
  // If all panels have the same zone count this is exact; if some arrays
  // override it, this gives the upper bound for the ray count display.
  const maxZonesPerPanel = allPanels.length > 0
    ? Math.max(...allPanels.map(p => p.zones))
    : 0;

  const pointsPerZone = density * density;
  const timeSteps = Math.floor((365 * 24 * 60) / simulationInterval);
  const totalRays = timeSteps * totalPanels * maxZonesPerPanel * pointsPerZone;

  const theoreticalPeak = allPanels.reduce((sum, p) => sum + p.peakPower / 1000, 0);

  return (
    <div className="controls-panel simulation-panel" style={{ top: 'auto', bottom: '20px' }}>
      <h3>{t('simulationControls.title')}</h3>

      <div className="control-row">
        <label>{t('simulationControls.interval')}:</label>
        <select
          value={simulationInterval}
          onChange={e => setSimulationInterval(Number(e.target.value) as SimulationInterval)}
          disabled={isRunning}
        >
          <option value={15}>15 min</option>
          <option value={30}>30 min</option>
          <option value={60}>1 h</option>
        </select>
      </div>

      <div className="control-row">
        <label>{t('simulationControls.pointsPerZone')}:</label>
        <input
          type="number"
          value={density}
          min={2}
          max={16}
          onChange={e => setDensity(Number(e.target.value))}
          disabled={isRunning}
        />
      </div>

      <div className="control-row checkbox-row">
        <label>{t('simulationControls.showPoints')}:</label>
        <input
          type="checkbox"
          checked={showPoints}
          onChange={e => setShowPoints(e.target.checked)}
        />
      </div>

      <div className="control-row">
        <label title={t('simulationControls.thresholdTooltip')}>
          {t('simulationControls.threshold')}:
        </label>
        <input
          type="number"
          value={threshold}
          min={1}
          max={maxPointsPerZone}
          onChange={e =>
            setThreshold(Math.max(1, Math.min(maxPointsPerZone, Number(e.target.value))))
          }
          disabled={isRunning}
        />
        <span style={{ fontSize: '0.7rem' }}>/ {maxPointsPerZone}</span>
      </div>

      <div className="status-info" style={{ fontSize: '0.8rem', opacity: 0.8 }}>
        <p>{t('simulationControls.pointsPerPanel')}: {maxZonesPerPanel * pointsPerZone}</p>
        <p>{t('simulationControls.timeSteps')}: {timeSteps.toLocaleString()}</p>
        <p><strong>{t('simulationControls.totalRays')}: {totalRays.toLocaleString()}</strong></p>
        {isRunning && <progress value={0} max={100} style={{ width: '100%' }} />}
      </div>

      <div
        className="instant-results"
        style={{ marginTop: '10px', borderTop: '1px solid #444', paddingTop: '10px' }}
      >
        <p>
          {t('simulationControls.instantPower')}:{' '}
          <strong style={{ color: '#4caf50' }}>
            {instantPower.toFixed(2)} kW
          </strong>
        </p>
        <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>
          {t('simulationControls.theoreticalPeak')}: {theoreticalPeak.toFixed(2)} kW
        </p>
      </div>

      <div className="button-group">
        {!isRunning
          ? <button className="play-btn" onClick={() => setIsRunning(true)}>
            {t('simulationControls.run')}
          </button>
          : <button className="pause-btn" onClick={() => setIsRunning(false)}>
            {t('simulationControls.stop')}
          </button>
        }
      </div>
    </div>
  );
}