import { useTranslation } from 'react-i18next';
import { useAppStore, SimulationInterval } from '../store/useAppStore';

/**
 * Bottom-left panel: simulation settings and instant production readout.
 *
 * The "interval" selector was previously broken (setter was a no-op).
 * It now reads from and writes to the store via `simulationInterval`.
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
  const config = useAppStore(s => s.config);
  const activeSetup = useAppStore(s => s.activeSetup);
  const simulationResult = useAppStore(s => s.simulationResult);

  const instantPower = simulationResult?.instantPower ?? 0;
  const maxPointsPerZone = density * density;

  // Derived counters for the info block
  const totalPanels = activeSetup?.panelArrays.flatMap(pa => pa.panels).length ?? 0;
  const zonesPerPanel = config?.setups[0].panelDefaults.zones ?? 0;
  const pointsPerZone = density * density;
  const timeSteps = Math.floor((365 * 24 * 60) / simulationInterval);
  const totalRays = timeSteps * totalPanels * zonesPerPanel * pointsPerZone;

  const theoreticalPeak = (
    activeSetup?.panelArrays
      .flatMap(pa => pa.panels)
      .reduce((sum, p) => sum + p.peakPower / 1000, 0) ?? 0
  );

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
        <p>{t('simulationControls.pointsPerPanel')}: {zonesPerPanel * pointsPerZone}</p>
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