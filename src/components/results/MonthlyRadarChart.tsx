import ReactECharts from 'echarts-for-react';
import { useTranslation } from 'react-i18next';
import { LoadedSetupResult } from '../../types/results';
import { SetupColoursUtils } from '../../utils/SetupColoursUtils';

interface Props {
  results: LoadedSetupResult[];
  activeSetupIds: Set<string>;
}

/**
 * Radar / spider chart showing monthly production distribution for each setup.
 * The 12 axes represent the 12 months of the year (labels localised to the
 * active language). Each setup is rendered as a filled polygon, making
 * seasonal strengths and weaknesses easy to compare visually.
 */
export function MonthlyRadarChart({ results, activeSetupIds }: Props) {
  const { t } = useTranslation();
  const visible = results.filter(r => activeSetupIds.has(r.setupId));
  if (visible.length === 0) return null;

  const monthLabels: string[] = t('months.short', { returnObjects: true });

  const allMonthlyValues = visible.flatMap(r => r.result.monthlyTotalKwh);
  const maxVal = Math.max(...allMonthlyValues, 1);
  const radarMax = Math.ceil(maxVal * 1.1);

  const indicator = monthLabels.map(name => ({ name, max: radarMax }));

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
      confine: true,
      formatter: (params: { name: string; value: number[] }) => {
        const lines = monthLabels.map((m, i) =>
          `${m}: <b>${params.value[i].toLocaleString()} kWh</b>`,
        ).join('<br/>');
        return `<b>${params.name}</b><br/>${lines}`;
      },
    },
    radar: {
      indicator,
      radius: '60%',
      center: ['50%', '52%'],
      axisName: { fontSize: 10, color: '#666' },
      splitLine: { lineStyle: { color: '#eee' } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: '#ddd' } },
    },
    series: [{ type: 'radar', data: series }],
  };

  return (
    <div className="results-chart">
      <ReactECharts option={option} style={{ height: 340 }} notMerge />
    </div>
  );
}