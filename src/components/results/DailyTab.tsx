import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadedSetupResult } from '../../types/results';
import { DailyLineChart } from './DailyLineChart';
import { PanelShadowHeatmap } from './PanelShadowHeatmap';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface Props {
  results: LoadedSetupResult[];
  activeSetupIds: Set<string>;
}

export function DailyTab({ results, activeSetupIds }: Props) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(new Date().getMonth());
  const [day, setDay] = useState(new Date().getDate() - 1);

  const year = results[0]?.result.year ?? new Date().getFullYear();

  const daysInMonth = useMemo(
    () => new Date(year, month + 1, 0).getDate(),
    [year, month],
  );

  // Clamp the selected day when the month changes to fewer days.
  const clampedDay = Math.min(day, daysInMonth - 1);

  const handleMonthChange = (newMonth: number) => {
    setMonth(newMonth);
    const daysInNew = new Date(year, newMonth + 1, 0).getDate();
    if (day >= daysInNew) setDay(daysInNew - 1);
  };

  return (
    <>
      <div className="results-selector-row">
        <label>{t('resultsPanel.month')}:</label>
        <select value={month} onChange={e => handleMonthChange(Number(e.target.value))}>
          {MONTH_NAMES.map((name, i) => (
            <option key={i} value={i}>{name}</option>
          ))}
        </select>

        <label>{t('resultsPanel.day')}:</label>
        <select value={clampedDay} onChange={e => setDay(Number(e.target.value))}>
          {Array.from({ length: daysInMonth }, (_, i) => (
            <option key={i} value={i}>{i + 1}</option>
          ))}
        </select>
      </div>

      <div className="results-section">
        <h4 className="results-section__title">{t('resultsPanel.production')}</h4>
        <DailyLineChart
          results={results}
          activeSetupIds={activeSetupIds}
          month={month}
          day={clampedDay}
        />
      </div>

      <div className="results-section">
        <h4 className="results-section__title">{t('resultsPanel.shadows')}</h4>
        <PanelShadowHeatmap
          results={results}
          activeSetupIds={activeSetupIds}
          month={month}
          day={clampedDay}
        />
      </div>
    </>
  );
}