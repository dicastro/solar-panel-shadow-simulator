import { useTranslation } from 'react-i18next';
import { useAppStore, SimulationInterval } from '../store/useAppStore';
import { runPhase0Validations } from '../_annual_simulation_validation/Phase0Validations';

/**
 * Bottom-left panel: simulation settings and instant production readout.
 *
 * Ray count derivation:
 *   totalZones        = sum of zone counts across every panel in the active setup
 *   totalSamplePoints = totalZones × density²
 *   totalRays         = totalSamplePoints × timeSteps
 *
 * Using the actual total zone count (rather than max zones × panel count) gives
 * an exact figure even when individual arrays override the default zone count.
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

  const allPanels = activeSetup?.panelArrays.flatMap(pa => pa.panels) ?? [];
  const theoreticalPeak = allPanels.reduce((sum, p) => sum + p.peakPower / 1000, 0);

  const totalZones = allPanels.reduce((sum, p) => sum + p.zones, 0);
  const pointsPerZone = density * density;
  const totalSamplePoints = totalZones * pointsPerZone;
  const timeSteps = Math.floor((365 * 24 * 60) / simulationInterval);
  const totalRays = totalSamplePoints * timeSteps;

  return (
    <div className="controls-panel simulation-panel">
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
        <span className="simulation-threshold-max">/ {maxPointsPerZone}</span>
      </div>

      <div className="simulation-status">
        <p>{t('simulationControls.totalSamplePoints')}: {totalSamplePoints.toLocaleString()}</p>
        <p>{t('simulationControls.timeSteps')}: {timeSteps.toLocaleString()}</p>
        <p><strong>{t('simulationControls.totalRays')}: {totalRays.toLocaleString()}</strong></p>
        {isRunning && <progress value={0} max={100} style={{ width: '100%' }} />}
      </div>

      <div className="instant-results">
        <p>
          {t('simulationControls.instantPower')}:{' '}
          <strong className="instant-power-value">
            {instantPower.toFixed(2)} kW
          </strong>
        </p>
        <p className="theoretical-peak">
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

      {/* TEMPORARY — Phase 0 validation. Delete this block and the
          _phase0_validation folder when Phase 1 begins. */}
      <div className="button-group" style={{ marginTop: 8 }}>
        <button onClick={runPhase0Validations} style={{ background: '#555', fontSize: '0.75rem' }}>
          Phase 0 — Run validations (console)
        </button>
      </div>
    </div>
  );
}