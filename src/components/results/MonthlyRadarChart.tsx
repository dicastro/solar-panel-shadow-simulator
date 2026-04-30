import ReactECharts from 'echarts-for-react';
import { LoadedSetupResult } from '../../types/results';
import { SetupColoursUtils } from '../../utils/SetupColoursUtils';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Props {
  results: LoadedSetupResult[];
  activeSetupIds: Set<string>;
}

/**
 * Radar / spider chart showing monthly production distribution for each setup.
 * The 12 axes represent the 12 months of the year. Each setup is rendered as
 * a polygon, making seasonal strengths and weaknesses easy to compare.
 *
 * The radar max value is the largest monthly total across all visible setups,
 * so polygons are always relative to the best month in the dataset.
 */
export function MonthlyRadarChart({ results, activeSetupIds }: Props) {
  const visible = results.filter(r => activeSetupIds.has(r.setupId));

  if (visible.length === 0) return null;

  const allMonthlyValues = visible.flatMap(r => r.result.monthlyTotalKwh);
  const maxVal = Math.max(...allMonthlyValues, 1);
  const radarMax = Math.ceil(maxVal * 1.1);

  const indicator = MONTH_LABELS.map(name => ({ name, max: radarMax }));

  const series = visible.map(r => ({
    name: r.result.setupLabel,
    value: r.result.monthlyTotalKwh.map(v => parseFloat(v.toFixed(1))),
    lineStyle: { color: SetupColoursUtils.getSetupColour(r.colourIndex), width: 2 },
    areaStyle: { color: SetupColoursUtils.getSetupColour(r.colourIndex), opacity: 0.12 },
    itemStyle: { color: SetupColoursUtils.getSetupColour(r.colourIndex) },
  }));

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (params: { name: string; value: number[] }) => {
        const lines = MONTH_LABELS.map((m, i) =>
          `${m}: <b>${params.value[i].toLocaleString()} kWh</b>`,
        ).join('<br/>');
        return `<b>${params.name}</b><br/>${lines}`;
      },
    },
    radar: {
      indicator,
      radius: '68%',
      axisName: { fontSize: 10, color: '#666' },
      splitLine: { lineStyle: { color: '#eee' } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: '#ddd' } },
    },
    series: [{ type: 'radar', data: series }],
  };

  return (
    <div className="results-chart">
      <ReactECharts option={option} style={{ height: 280 }} notMerge />
    </div>
  );
}