import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ReactECharts from 'echarts-for-react';
import { LoadedSetupResult } from '../../types/results';
import { SetupColoursUtils } from '../../utils/SetupColoursUtils';
import { DailyLineChart } from './DailyLineChart';
import { PanelShadowHeatmap } from './PanelShadowHeatmap';

interface Props {
  results: LoadedSetupResult[];
  activeSetupIds: Set<string>;
  timezone: string;
  /** Calendar year of the simulation run. */
  year: number;
}

function DailyTotalBarChart({ results, activeSetupIds, month, day }: Omit<Props, 'timezone' | 'year'> & { month: number; day: number }) {
  const visible = results.filter(r => activeSetupIds.has(r.setupId));
  if (visible.length === 0) return null;

  const labels = visible.map(r => r.result.setupLabel);
  const values = visible.map(r =>
    parseFloat(
      r.result.panels
        .reduce((sum, p) => sum + p.energyKwh[month][day].reduce((s, h) => s + h, 0), 0)
        .toFixed(3),
    ),
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
    xAxis: { type: 'value', axisLabel: { fontSize: 9 }, splitLine: { lineStyle: { color: '#f0f0f0' } } },
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

export function DailyTab({ results, activeSetupIds, timezone, year }: Props) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(new Date().getMonth());
  const [day, setDay] = useState(new Date().getDate() - 1);

  const monthNames: string[] = t('months.long', { returnObjects: true });
  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);
  const clampedDay = Math.min(day, daysInMonth - 1);

  const nextDay = () => {
    if (clampedDay < new Date(year, month + 1, 0).getDate() - 1) {
      setDay(clampedDay + 1);
    } else {
      setMonth(m => (m + 1) % 12);
      setDay(0);
    }
  };

  const prevDay = () => {
    if (clampedDay > 0) {
      setDay(clampedDay - 1);
    } else {
      const prevMonth = (month - 1 + 12) % 12;
      setMonth(prevMonth);
      setDay(new Date(year, prevMonth + 1, 0).getDate() - 1);
    }
  };

  const handleMonthChange = (newMonth: number) => {
    setMonth(newMonth);
    if (day >= new Date(year, newMonth + 1, 0).getDate()) {
      setDay(new Date(year, newMonth + 1, 0).getDate() - 1);
    }
  };

  return (
    <>
      <div className="results-selector-row">
        <label>{t('resultsPanel.month')}:</label>
        <select value={month} onChange={e => handleMonthChange(Number(e.target.value))}>
          {monthNames.map((name, i) => <option key={i} value={i}>{name}</option>)}
        </select>
        <label>{t('resultsPanel.day')}:</label>
        <button className="results-nav-btn" onClick={prevDay}>‹</button>
        <select value={clampedDay} onChange={e => setDay(Number(e.target.value))}>
          {Array.from({ length: daysInMonth }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}
        </select>
        <button className="results-nav-btn" onClick={nextDay}>›</button>
      </div>

      <div className="results-section">
        <h4 className="results-section__title">{t('resultsPanel.production')}</h4>
        <DailyTotalBarChart results={results} activeSetupIds={activeSetupIds} month={month} day={clampedDay} />
        <DailyLineChart
          results={results}
          activeSetupIds={activeSetupIds}
          month={month}
          day={clampedDay}
          timezone={timezone}
          year={year}
        />
      </div>

      <div className="results-section">
        <h4 className="results-section__title">{t('resultsPanel.shadows')}</h4>
        <PanelShadowHeatmap results={results} activeSetupIds={activeSetupIds} month={month} day={clampedDay} />
      </div>
    </>
  );
}