import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';

/**
 * Displays a prominent warning banner when the loaded configuration contains
 * wall angles that are not 90°. The banner lists the config-space point
 * indices where the violation was detected.
 *
 * The application only supports 90° wall angles. Non-right angles produce
 * incorrect wall and intersection geometry, inaccurate shadow raycasting,
 * and unreliable production estimates. The warning is intentionally styled
 * to be impossible to miss.
 *
 * Renders nothing when all angles are valid.
 */
export function AngleWarningBanner() {
  const { t } = useTranslation();
  const angleWarnings = useAppStore(s => s.angleWarnings);

  if (angleWarnings.length === 0) return null;

  return (
    <div className="angle-warning-banner">
      <div className="angle-warning-banner__title">
        <span>⚠</span>
        <span>{t('angleWarning.title')}</span>
      </div>
      <div className="angle-warning-banner__message">
        {t('angleWarning.message')}
      </div>
      <div className="angle-warning-banner__points">
        {angleWarnings.map(idx => (
          <span key={idx} className="angle-warning-banner__point-badge">
            {t('angleWarning.pointLabel')} {idx}
          </span>
        ))}
      </div>
    </div>
  );
}
