import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';

/**
 * Displays a prominent warning banner when the loaded configuration contains
 * wall angles that are not 90°.
 *
 * Each warning entry shows the three config-space coordinates that form the
 * incorrect angle: the previous point, the vertex itself, and the next point.
 * Coordinates match the values in config.json so the user can locate and fix
 * them directly.
 *
 * Renders nothing when all angles are valid.
 */
export function AngleWarningBanner() {
  const { t } = useTranslation();
  const angleWarnings = useAppStore(s => s.angleWarnings);

  if (angleWarnings.length === 0) return null;

  const formatPoint = (p: readonly [number, number]) => `[${p[0]}, ${p[1]}]`;

  return (
    <div className="angle-warning-banner">
      <div className="angle-warning-banner__title">
        <span>⚠</span>
        <span>{t('angleWarning.title')}</span>
      </div>
      <div className="angle-warning-banner__message">
        {t('angleWarning.message')}
      </div>
      <ul className="angle-warning-banner__list">
        {angleWarnings.map((w, i) => (
          <li key={i} className="angle-warning-banner__list-item">
            {t('angleWarning.tripletLabel', {
              prev: formatPoint(w.pointPrev),
              point: formatPoint(w.point),
              next: formatPoint(w.pointNext),
            })}
          </li>
        ))}
      </ul>
    </div>
  );
}