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
}

function DailyTotalBarChart({ results, activeSetupIds, month, day }: Props & { month: number; day: number }) {
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

export function DailyTab({ results, activeSetupIds }: Props) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(new Date().getMonth());
  const [day, setDay] = useState(new Date().getDate() - 1);

  const year = results[0]?.result.year ?? new Date().getFullYear();
  const monthNames: string[] = t('months.long', { returnObjects: true });

  const daysInMonth = useMemo(
    () => new Date(year, month + 1, 0).getDate(),
    [year, month],
  );

  const clampedDay = Math.min(day, daysInMonth - 1);

  /**
   * Advances to the next day, wrapping to the next month (and next year boundary)
   * when the last day of the month is reached.
   */
  const nextDay = () => {
    const currentDays = new Date(year, month + 1, 0).getDate();
    if (clampedDay < currentDays - 1) {
      setDay(clampedDay + 1);
    } else {
      const nextMonth = (month + 1) % 12;
      setMonth(nextMonth);
      setDay(0);
    }
  };

  /**
   * Moves to the previous day, wrapping to the last day of the previous month
   * when the first day of the month is reached.
   */
  const prevDay = () => {
    if (clampedDay > 0) {
      setDay(clampedDay - 1);
    } else {
      const prevMonth = (month - 1 + 12) % 12;
      const daysInPrev = new Date(year, prevMonth + 1, 0).getDate();
      setMonth(prevMonth);
      setDay(daysInPrev - 1);
    }
  };

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
          {monthNames.map((name, i) => (
            <option key={i} value={i}>{name}</option>
          ))}
        </select>

        <label>{t('resultsPanel.day')}:</label>
        <button className="results-nav-btn" onClick={prevDay} title="Previous day">‹</button>
        <select value={clampedDay} onChange={e => setDay(Number(e.target.value))}>
          {Array.from({ length: daysInMonth }, (_, i) => (
            <option key={i} value={i}>{i + 1}</option>
          ))}
        </select>
        <button className="results-nav-btn" onClick={nextDay} title="Next day">›</button>
      </div>

      <div className="results-section">
        <h4 className="results-section__title">{t('resultsPanel.production')}</h4>
        <DailyTotalBarChart
          results={results}
          activeSetupIds={activeSetupIds}
          month={month}
          day={clampedDay}
        />
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