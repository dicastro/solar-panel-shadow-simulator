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
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 20,
      background: 'rgba(180, 30, 30, 0.97)',
      color: '#fff',
      padding: '14px 20px',
      borderRadius: '8px',
      border: '2px solid #ff6b6b',
      fontFamily: 'sans-serif',
      fontSize: '0.85rem',
      maxWidth: '480px',
      boxShadow: '0 0 24px rgba(255, 80, 80, 0.5)',
      lineHeight: 1.5,
    }}>
      <div style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>⚠</span>
        <span>{t('angleWarning.title')}</span>
      </div>
      <div style={{ marginBottom: '8px' }}>
        {t('angleWarning.message')}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {angleWarnings.map(idx => (
          <span key={idx} style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: '4px',
            padding: '2px 8px',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
          }}>
            {t('angleWarning.pointLabel')} {idx}
          </span>
        ))}
      </div>
    </div>
  );
}