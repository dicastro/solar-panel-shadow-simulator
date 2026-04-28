import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';

/**
 * Right-side panel rendered alongside the 3D canvas on desktop viewports.
 *
 * In this phase the panel displays annual simulation results in plain text,
 * grouped by setup. When no results are available yet it shows a prompt
 * directing the user to run the simulation. Charts will replace the plain-text
 * output in a subsequent phase without changing this component's position or
 * mounting logic.
 *
 * The panel is always mounted so that the CSS flex layout reserves its column
 * width. Hiding it conditionally would collapse the 3D canvas to full width
 * and back, causing an unwanted resize event on the Three.js renderer.
 */
export function ResultsPanel() {
  const { t } = useTranslation();
  const annualResults = useAppStore(s => s.annualResults);
  const isRunning = useAppStore(s => s.isRunning);

  const hasResults = annualResults.size > 0;

  return (
    <div className="results-panel">
      <h3 className="results-panel__title">{t('resultsPanel.title')}</h3>

      {!hasResults && !isRunning && (
        <p className="results-panel__placeholder">
          {t('resultsPanel.placeholder')}
        </p>
      )}

      {!hasResults && isRunning && (
        <p className="results-panel__placeholder results-panel__placeholder--running">
          {t('resultsPanel.computing')}
        </p>
      )}

      {hasResults && (
        <div className="results-panel__results">
          {Array.from(annualResults.entries()).map(([setupId, { label, annualTotalKwh }]) => (
            <div key={setupId} className="results-panel__result-card">
              <div className="results-panel__result-label" title={label}>
                {label}
              </div>
              <div className="results-panel__result-value">
                {annualTotalKwh.toFixed(1)}
                <span className="results-panel__result-unit"> kWh</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}