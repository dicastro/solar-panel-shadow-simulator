import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadedSetupResult } from '../../types/results';
import { MonthlyLineChart } from './MonthlyLineChart';
import { PanelShadowHeatmap } from './PanelShadowHeatmap';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface Props {
  results: LoadedSetupResult[];
  activeSetupIds: Set<string>;
}

export function MonthlyTab({ results, activeSetupIds }: Props) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(new Date().getMonth());

  return (
    <>
      <div className="results-selector-row">
        <label>{t('resultsPanel.month')}:</label>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTH_NAMES.map((name, i) => (
            <option key={i} value={i}>{name}</option>
          ))}
        </select>
      </div>

      <div className="results-section">
        <h4 className="results-section__title">{t('resultsPanel.production')}</h4>
        <MonthlyLineChart results={results} activeSetupIds={activeSetupIds} month={month} />
      </div>

      <div className="results-section">
        <h4 className="results-section__title">{t('resultsPanel.shadows')}</h4>
        <PanelShadowHeatmap
          results={results}
          activeSetupIds={activeSetupIds}
          month={month}
          day={null}
        />
      </div>
    </>
  );
}