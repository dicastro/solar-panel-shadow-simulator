import ReactECharts from 'echarts-for-react';
import { LoadedSetupResult } from '../../types/results';
import { SetupColoursUtils } from '../../utils/SetupColoursUtils';

interface Props {
  results: LoadedSetupResult[];
  activeSetupIds: Set<string>;
}

/**
 * Horizontal bar chart comparing annual total production (kWh) across setups.
 * Each bar represents one setup. Inactive setups (toggled off in the legend)
 * are filtered out so the chart always reflects the legend selection.
 */
export function AnnualBarChart({ results, activeSetupIds }: Props) {
  const visible = results.filter(r => activeSetupIds.has(r.setupId));

  if (visible.length === 0) return null;

  const labels = visible.map(r => r.result.setupLabel);
  const values = visible.map(r => parseFloat(r.result.annualTotalKwh.toFixed(1)));
  const colours = visible.map(r => SetupColoursUtils.getSetupColour(r.colourIndex));

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: { name: string; value: number }[]) => {
        const p = params[0];
        return `<b>${p.name}</b><br/>${p.value.toLocaleString()} kWh`;
      },
    },
    grid: { left: 16, right: 24, top: 12, bottom: 12, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { fontSize: 10, formatter: (v: number) => `${v} kWh` },
      splitLine: { lineStyle: { color: '#f0f0f0' } },
    },
    yAxis: {
      type: 'category',
      data: labels,
      axisLabel: {
        fontSize: 10,
        width: 100,
        overflow: 'truncate',
        ellipsis: '…',
      },
    },
    series: [{
      type: 'bar',
      data: values.map((v, i) => ({ value: v, itemStyle: { color: colours[i] } })),
      label: {
        show: true,
        position: 'right',
        fontSize: 10,
        formatter: (p: { value: number }) => `${p.value.toLocaleString()} kWh`,
      },
    }],
  };

  const height = Math.max(120, visible.length * 48 + 40);

  return (
    <div className="results-chart">
      <ReactECharts option={option} style={{ height }} notMerge />
    </div>
  );
}