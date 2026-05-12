import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useAppStore, makeDateInTimezone } from '../store/AppStore';
import { TimeUtils } from '../utils/TimeUtils';

const CURRENT_YEAR = dayjs().year();

const ALL_TIMEZONES = TimeUtils.getAllTimezones();

interface RenderControlsProps {
  /**
   * When true, adds a top-offset modifier class so the panel clears the
   * gear button that sits at the same top-left anchor point.
   */
  offsetTop: boolean;
}

/**
 * Top-left control panel for the 3D interactive view.
 *
 * Covers setup selection, date/time pickers, playback controls, timezone and
 * language selection, and the rendering-specific sampling controls (showPoints,
 * renderDensity, renderThreshold). Changes to these controls affect only the
 * 3D visualisation and the instant production readout — they are completely
 * independent of the annual simulation parameters in SimulationControls.
 *
 * Setup selector is only rendered when more than one setup is defined in the
 * config. Switching setup triggers a full PanelSetup rebuild (geometry +
 * sample points) via the store action setActiveSetupIndex.
 *
 * All date construction goes through makeDateInTimezone(), which calls
 * dayjs.tz(isoString, timezone). This interprets the components as local
 * time in the configured timezone — not the browser timezone. This ensures
 * that what the user types in the inputs always matches what is displayed,
 * regardless of the configured timezone or DST transitions.
 *
 * The `offsetTop` prop adds a CSS modifier class that shifts the panel down
 * by the height of the gear button + gap (68px total from viewport top) so
 * the two elements do not overlap.
 */
export function RenderControls({ offsetTop }: RenderControlsProps) {
  const { t, i18n } = useTranslation();

  const date = useAppStore(s => s.date);
  const timezone = useAppStore(s => s.timezone);
  const isPlaying = useAppStore(s => s.isPlaying);
  const config = useAppStore(s => s.config);
  const activeSetupIndex = useAppStore(s => s.activeSetupIndex);
  const showPoints = useAppStore(s => s.showPoints);
  const renderDensity = useAppStore(s => s.renderDensity);
  const renderThreshold = useAppStore(s => s.renderThreshold);
  const instantProductionResult = useAppStore(s => s.instantProductionResult);
  const activeSetup = useAppStore(s => s.activeSetup);

  const setDate = useAppStore(s => s.setDate);
  const setIsPlaying = useAppStore(s => s.setIsPlaying);
  const adjustDate = useAppStore(s => s.adjustDate);
  const setTimezone = useAppStore(s => s.setTimezone);
  const setActiveSetupIndex = useAppStore(s => s.setActiveSetupIndex);
  const setShowPoints = useAppStore(s => s.setShowPoints);
  const setRenderDensity = useAppStore(s => s.setRenderDensity);
  const setRenderThreshold = useAppStore(s => s.setRenderThreshold);

  const displayDate = date;

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [y, m, d] = e.target.value.split('-').map(Number);
    setDate(makeDateInTimezone(y, m - 1, d, displayDate.hour(), displayDate.minute(), timezone));
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [h, m] = e.target.value.split(':').map(Number);
    setDate(makeDateInTimezone(
      displayDate.year(), displayDate.month(), displayDate.date(), h, m, timezone,
    ));
  };

  const hasMultipleSetups = (config?.setups.length ?? 0) > 1;

  const instantPower = instantProductionResult?.power ?? 0;
  const allPanels = activeSetup?.panelArrays.flatMap(pa => pa.panels) ?? [];
  const theoreticalPeak = allPanels.reduce((sum, p) => sum + p.peakPower / 1000, 0);
  const maxPointsPerZone = renderDensity * renderDensity;

  const panelClass = `controls-panel render-controls${offsetTop ? ' controls-panel--offset-top' : ''}`;

  return (
    <div className={panelClass}>

      <div className="control-row">
        <h2 className="controls-title">{t('title')}</h2>
        <select
          value={i18n.language}
          onChange={e => i18n.changeLanguage(e.target.value)}
        >
          <option value="en">EN</option>
          <option value="es">ES</option>
        </select>
      </div>

      {hasMultipleSetups && (
        <div className="control-row">
          <label className="setup-label">
            {t('renderControls.setupLabel')}:
          </label>
          <select
            value={activeSetupIndex ?? 0}
            onChange={e => setActiveSetupIndex(Number(e.target.value))}
            className="setup-select"
          >
            {config!.setups.map((s, i) => (
              <option key={i} value={i}>{s.label}</option>
            ))}
          </select>
        </div>
      )}

      <div className="control-row">
        <div className="date-input-group">
          <label className="date-input-label">{t('renderControls.dateLabel')}</label>
          <input
            type="date"
            value={displayDate.format('YYYY-MM-DD')}
            min={`${CURRENT_YEAR}-01-01`}
            max={`${CURRENT_YEAR}-12-31`}
            onChange={handleDateChange}
          />
        </div>
        <div className="date-input-group">
          <label className="date-input-label">{t('renderControls.timeLabel')}</label>
          <input
            type="time"
            value={displayDate.format('HH:mm')}
            onChange={handleTimeChange}
          />
        </div>
      </div>

      <div className="control-row">
        <label className="setup-label">
          {t('renderControls.timezoneLabel')}:
        </label>
        <select
          value={timezone}
          onChange={e => setTimezone(e.target.value)}
          className="timezone-select"
        >
          {ALL_TIMEZONES.map(tz => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>

      <div className="button-group">
        <button onClick={() => adjustDate(-1, 'month')}>-1M</button>
        <button onClick={() => adjustDate(-1, 'day')}>-1D</button>
        <button onClick={() => adjustDate(-1, 'hour')}>-1H</button>
        <button
          className={isPlaying ? 'pause-btn' : 'play-btn'}
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? '❙❙' : '▶'}
        </button>
        <button onClick={() => adjustDate(1, 'hour')}>+1H</button>
        <button onClick={() => adjustDate(1, 'day')}>+1D</button>
        <button onClick={() => adjustDate(1, 'month')}>+1M</button>
      </div>

      <div className="date-display">
        {displayDate.locale(i18n.language).format('DD MMM YYYY - HH:mm')}
      </div>

      {/* ── Render sampling controls ─────────────────────────────────────────── */}

      <div className="control-row">
        <label>{t('renderControls.pointsPerZone')}:</label>
        <input
          type="number"
          value={renderDensity}
          min={2}
          max={16}
          onChange={e => setRenderDensity(Number(e.target.value))}
        />
      </div>

      <div className="control-row checkbox-row">
        <label>{t('renderControls.showPoints')}:</label>
        <input
          type="checkbox"
          checked={showPoints}
          onChange={e => setShowPoints(e.target.checked)}
        />
      </div>

      <div className="control-row">
        <label title={t('renderControls.thresholdTooltip')}>
          {t('renderControls.threshold')}:
        </label>
        <input
          type="number"
          value={renderThreshold}
          min={1}
          max={maxPointsPerZone}
          onChange={e =>
            setRenderThreshold(Math.max(1, Math.min(maxPointsPerZone, Number(e.target.value))))
          }
        />
        <span className="simulation-threshold-max">/ {maxPointsPerZone}</span>
      </div>

      {/* ── Instant production readout ────────────────────────────────────────── */}

      <div className="instant-results">
        <p>
          {t('renderControls.instantPower')}:{' '}
          <strong className="instant-power-value">
            {instantPower.toFixed(2)} kW
          </strong>
        </p>
        <p className="theoretical-peak">
          {t('renderControls.theoreticalPeak')}: {theoreticalPeak.toFixed(2)} kW
        </p>
      </div>
    </div>
  );
}