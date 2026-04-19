import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';

const CURRENT_YEAR = dayjs().year();

/**
 * Top-left panel: date/time pickers, play/pause and step buttons,
 * language selector, and a formatted date display.
 */
export function MainControls() {
  const { t, i18n } = useTranslation();

  const date = useAppStore(s => s.date);
  const isPlaying = useAppStore(s => s.isPlaying);
  const config = useAppStore(s => s.config);
  const setDate = useAppStore(s => s.setDate);
  const setIsPlaying = useAppStore(s => s.setIsPlaying);
  const adjustDate = useAppStore(s => s.adjustDate);

  const displayDate = config ? date.tz(config.site.timezone) : date;

  return (
    <div className="controls-panel main-controls">
      <div className="control-row">
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{t('title')}</h2>
        <select
          value={i18n.language}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
        >
          <option value="en">EN</option>
          <option value="es">ES</option>
        </select>
      </div>

      <div className="control-row">
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '0.7rem' }}>{t('date_label')}</label>
          <input
            type="date"
            value={date.format('YYYY-MM-DD')}
            min={`${CURRENT_YEAR}-01-01`}
            max={`${CURRENT_YEAR}-12-31`}
            onChange={(e) =>
              setDate(dayjs(e.target.value).hour(date.hour()).minute(date.minute()).second(0))
            }
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '0.7rem' }}>{t('time_label')}</label>
          <input
            type="time"
            value={date.format('HH:mm')}
            onChange={(e) => {
              const [h, m] = e.target.value.split(':').map(Number);
              setDate(date.hour(h).minute(m).second(0));
            }}
          />
        </div>
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