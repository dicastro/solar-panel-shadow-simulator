import ReactECharts from 'echarts-for-react';
import { LoadedSetupResult } from '../../types/results';
import { SetupColoursUtils } from '../../utils/SetupColoursUtils';

interface Props {
  results: LoadedSetupResult[];
  activeSetupIds: Set<string>;
  /** 0-based month index */
  month: number;
}

/**
 * Line chart showing daily production totals (kWh) for a selected month.
 * One line per setup. The X axis covers all days of the month (1–28/29/30/31).
 * Each point is the sum of all hours for that day across all panels.
 */
export function MonthlyLineChart({ results, activeSetupIds, month }: Props) {
  const visible = results.filter(r => activeSetupIds.has(r.setupId));
  if (visible.length === 0) return null;

  const daysInMonth = new Date(
    visible[0].result.year,
    month + 1,
    0,
  ).getDate();

  const xData = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const series = visible.map(r => {
    const data = xData.map(day => {
      const dayIdx = day - 1;
      return parseFloat(
        r.result.panels
          .reduce((sum, p) =>
            sum + p.energyKwh[month][dayIdx].reduce((s, h) => s + h, 0), 0)
          .toFixed(2),
      );
    });
    return {
      name: r.result.setupLabel,
      type: 'line',
      data,
      smooth: true,
      lineStyle: { color: SetupColoursUtils.getSetupColour(r.colourIndex), width: 2 },
      itemStyle: { color: SetupColoursUtils.getSetupColour(r.colourIndex) },
      symbol: 'circle',
      symbolSize: 4,
    };
  });

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: { seriesName: string; value: number; axisValue: number }[]) => {
        const lines = params.map(p =>
          `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${SetupColoursUtils.getSetupColour(
            visible.find(r => r.result.setupLabel === p.seriesName)?.colourIndex ?? 0,
          )};margin-right:4px;"></span>${p.seriesName}: <b>${p.value} kWh</b>`,
        ).join('<br/>');
        return `Day ${params[0]?.axisValue}<br/>${lines}`;
      },
    },
    grid: { left: 12, right: 12, top: 12, bottom: 12, containLabel: true },
    xAxis: {
      type: 'category',
      data: xData,
      axisLabel: { fontSize: 9 },
      name: 'Day',
      nameTextStyle: { fontSize: 9 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 9, formatter: (v: number) => `${v}` },
      name: 'kWh',
      nameTextStyle: { fontSize: 9 },
      splitLine: { lineStyle: { color: '#f0f0f0' } },
    },
    series,
  };

  return (
    <div className="results-chart">
      <ReactECharts option={option} style={{ height: 220 }} notMerge />
    </div>
  );
}