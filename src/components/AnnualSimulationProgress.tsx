import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';

/**
 * Formats a remaining-seconds estimate into a human-readable string.
 * Displays minutes and seconds once the value is below one hour,
 * hours and minutes above that.
 */
const formatEta = (seconds: number): string => {
  const s = Math.round(seconds);
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `~${m}m ${sec}s`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `~${h}h ${m}m`;
};

/**
 * Renders the annual simulation progress section inside SimulationControls.
 *
 * Shows one progress bar per active setup with its label, percentage, and
 * smoothed ETA. When setups are waiting in the worker queue, a single line
 * reports the pending count to avoid cluttering the panel with rows for
 * setups that have not started yet.
 *
 * Setup labels are truncated with CSS ellipsis to prevent long names from
 * breaking the panel layout. The full label is always available as the
 * element's `title` attribute, shown by the browser on hover.
 */
export function AnnualSimulationProgress() {
  const { t } = useTranslation();
  const activeProgress = useAppStore(s => s.activeProgress);
  const pendingSetups = useAppStore(s => s.pendingSetups);

  const entries = Array.from(activeProgress.values());

  if (entries.length === 0 && pendingSetups === 0) return null;

  return (
    <div className="simulation-progress">
      {entries.map(p => {
        const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
        const showEta = p.smoothedRemainingSeconds !== null;

        return (
          <div key={p.setupId} className="simulation-progress__item">
            <div className="simulation-progress__header">
              <span
                className="simulation-progress__label"
                title={p.setupLabel}
              >
                {p.setupLabel}
              </span>
              <span className="simulation-progress__pct">
                {pct}%
                {showEta && (
                  <span className="simulation-progress__eta">
                    {' '}{formatEta(p.smoothedRemainingSeconds!)}
                  </span>
                )}
              </span>
            </div>
            <div className="simulation-progress__bar-track">
              <div
                className="simulation-progress__bar-fill"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}

      {pendingSetups > 0 && (
        <p className="simulation-progress__pending">
          {t('simulationControls.pending', { count: pendingSetups })}
        </p>
      )}
    </div>
  );
}