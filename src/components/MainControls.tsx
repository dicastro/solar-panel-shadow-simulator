import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useAppStore, makeDateInTimezone } from '../store/useAppStore';
import { getAllTimezones } from '../utils/TimezoneUtils';

const CURRENT_YEAR = dayjs().year();

const ALL_TIMEZONES = getAllTimezones();

/**
 * Top-left panel: setup selector, date/time pickers, play/pause and step
 * buttons, timezone selector, language selector, and a formatted date display.
 *
 * ## Setup selector
 *
 * Only rendered when more than one setup is defined in the config. Switching
 * setup triggers a full PanelSetup rebuild (geometry + sample points) via
 * the store action setActiveSetupIndex.
 *
 * ## DST-safe date construction
 *
 * All date construction goes through makeDateInTimezone(), which calls
 * dayjs.tz(isoString, timezone). This interprets the components as local
 * time in the configured timezone — not the browser timezone. This ensures
 * that what the user types in the inputs always matches what is displayed,
 * regardless of the configured timezone or DST transitions.
 */
export function MainControls() {
  const { t, i18n } = useTranslation();

  const date = useAppStore(s => s.date);
  const timezone = useAppStore(s => s.timezone);
  const isPlaying = useAppStore(s => s.isPlaying);
  const config = useAppStore(s => s.config);
  const activeSetupIndex = useAppStore(s => s.activeSetupIndex);

  const setDate = useAppStore(s => s.setDate);
  const setIsPlaying = useAppStore(s => s.setIsPlaying);
  const adjustDate = useAppStore(s => s.adjustDate);
  const setTimezone = useAppStore(s => s.setTimezone);
  const setActiveSetupIndex = useAppStore(s => s.setActiveSetupIndex);

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

  return (
    <div className="controls-panel main-controls">

      <div className="control-row">
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{t('title')}</h2>
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
          <label style={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
            {t('setup_label')}:
          </label>
          <select
            value={activeSetupIndex ?? 0}
            onChange={e => setActiveSetupIndex(Number(e.target.value))}
            style={{ flex: 1 }}
          >
            {config!.setups.map((s, i) => (
              <option key={i} value={i}>{s.label}</option>
            ))}
          </select>
        </div>
      )}

      <div className="control-row">
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '0.7rem' }}>{t('date_label')}</label>
          <input
            type="date"
            value={displayDate.format('YYYY-MM-DD')}
            min={`${CURRENT_YEAR}-01-01`}
            max={`${CURRENT_YEAR}-12-31`}
            onChange={handleDateChange}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '0.7rem' }}>{t('time_label')}</label>
          <input
            type="time"
            value={displayDate.format('HH:mm')}
            onChange={handleTimeChange}
          />
        </div>
      </div>

      <div className="control-row">
        <label style={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
          {t('timezone_label')}:
        </label>
        <select
          value={timezone}
          onChange={e => setTimezone(e.target.value)}
          style={{ flex: 1, fontSize: '0.75rem' }}
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
    </div>
  );
}