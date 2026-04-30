import { useTranslation } from 'react-i18next';
import { LoadedSetupResult } from '../../types/results';
import { AnnualBarChart } from './AnnualBarChart';
import { MonthlyRadarChart } from './MonthlyRadarChart';
import { PanelShadowHeatmap } from './PanelShadowHeatmap';

interface Props {
  results: LoadedSetupResult[];
  activeSetupIds: Set<string>;
}

export function AnnualTab({ results, activeSetupIds }: Props) {
  const { t } = useTranslation();

  return (
    <>
      <div className="results-section">
        <h4 className="results-section__title">{t('resultsPanel.production')}</h4>
        <AnnualBarChart results={results} activeSetupIds={activeSetupIds} />
        <MonthlyRadarChart results={results} activeSetupIds={activeSetupIds} />
      </div>

      <div className="results-section">
        <h4 className="results-section__title">{t('resultsPanel.shadows')}</h4>
        <PanelShadowHeatmap
          results={results}
          activeSetupIds={activeSetupIds}
          month={null}
          day={null}
        />
      </div>
    </>
  );
}