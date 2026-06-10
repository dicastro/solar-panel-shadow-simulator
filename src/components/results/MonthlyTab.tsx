import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactECharts from 'echarts-for-react';
import { LoadedSetupResult } from '../../types/results';
import { SetupColoursUtils } from '../../utils/SetupColoursUtils';
import { MonthlyLineChart } from './MonthlyLineChart';
import { PanelShadowHeatmap } from './PanelShadowHeatmap';

interface Props {
  results: LoadedSetupResult[];
  activeSetupIds: Set<string>;
  /** Calendar year of the simulation run. */
  year: number;
}

function MonthlyTotalBarChart({ results, activeSetupIds, month }: Omit<Props, 'year'> & { month: number }) {
  const visible = results.filter(r => activeSetupIds.has(r.setupId));
  if (visible.length === 0) return null;

  const labels = visible.map(r => r.result.setupLabel);
  const values = visible.map(r =>
    parseFloat(r.result.monthlyTotalKwh[month].toFixed(1)),
  );
  const colours = visible.map(r => SetupColoursUtils.getSetupColour(r.colourIndex));

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: { name: string; value: number }[]) =>
        `<b>${params[0].name}</b><br/>${params[0].value.toLocaleString()} kWh`,
    },
    grid: { left: 16, right: 24, top: 8, bottom: 8, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { fontSize: 9, formatter: (v: number) => `${v}` },
      splitLine: { lineStyle: { color: '#f0f0f0' } },
    },
    yAxis: {
      type: 'category',
      data: labels,
      axisLabel: { fontSize: 9, width: 100, overflow: 'truncate', ellipsis: '…' },
    },
    series: [{
      type: 'bar',
      data: values.map((v, i) => ({ value: v, itemStyle: { color: colours[i] } })),
      label: {
        show: true, position: 'right', fontSize: 9,
        formatter: (p: { value: number }) => `${p.value.toLocaleString()} kWh`,
      },
    }],
  };

  return (
    <div className="results-chart">
      <ReactECharts option={option} style={{ height: Math.max(80, visible.length * 36 + 24) }} notMerge />
    </div>
  );
}

export function MonthlyTab({ results, activeSetupIds, year }: Props) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(new Date().getMonth());

  const monthNames: string[] = t('months.long', { returnObjects: true });

  const prevMonth = () => setMonth(m => (m - 1 + 12) % 12);
  const nextMonth = () => setMonth(m => (m + 1) % 12);

  return (
    <>
      <div className="results-selector-row">
        <label>{t('resultsPanel.month')}:</label>
        <button className="results-nav-btn" onClick={prevMonth} title="Previous month">‹</button>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}>
          {monthNames.map((name, i) => (
            <option key={i} value={i}>{name}</option>
          ))}
        </select>
        <button className="results-nav-btn" onClick={nextMonth} title="Next month">›</button>
      </div>

      <div className="results-section">
        <h4 className="results-section__title">{t('resultsPanel.production')}</h4>
        <MonthlyTotalBarChart results={results} activeSetupIds={activeSetupIds} month={month} />
        <MonthlyLineChart results={results} activeSetupIds={activeSetupIds} month={month} year={year} />
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