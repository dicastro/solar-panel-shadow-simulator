import ReactECharts from 'echarts-for-react';
import { LoadedSetupResult } from '../../types/results';
import { SetupColoursUtils } from '../../utils/SetupColoursUtils';

interface Props {
  results: LoadedSetupResult[];
  activeSetupIds: Set<string>;
  month: number;
  /** 0-based day-of-month index */
  day: number;
}

const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

/**
 * Line chart showing hourly production (kWh) for a selected day across all panels.
 * One line per setup. The X axis runs from 00:00 to 23:00.
 */
export function DailyLineChart({ results, activeSetupIds, month, day }: Props) {
  const visible = results.filter(r => activeSetupIds.has(r.setupId));
  if (visible.length === 0) return null;

  const series = visible.map(r => {
    const data = HOURS.map((_, h) =>
      parseFloat(
        r.result.panels
          .reduce((sum, p) => sum + p.energyKwh[month][day][h], 0)
          .toFixed(3),
      ),
    );
    return {
      name: r.result.setupLabel,
      type: 'line',
      data,
      smooth: true,
      lineStyle: { color: SetupColoursUtils.getSetupColour(r.colourIndex), width: 2 },
      areaStyle: { color: SetupColoursUtils.getSetupColour(r.colourIndex), opacity: 0.08 },
      itemStyle: { color: SetupColoursUtils.getSetupColour(r.colourIndex) },
      symbol: 'none',
    };
  });

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: { seriesName: string; value: number; axisValue: string }[]) => {
        const lines = params.map(p =>
          `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${SetupColoursUtils.getSetupColour(
            visible.find(r => r.result.setupLabel === p.seriesName)?.colourIndex ?? 0,
          )};margin-right:4px;"></span>${p.seriesName}: <b>${p.value.toFixed(3)} kWh</b>`,
        ).join('<br/>');
        return `${params[0]?.axisValue}<br/>${lines}`;
      },
    },
    grid: { left: 12, right: 12, top: 12, bottom: 12, containLabel: true },
    xAxis: {
      type: 'category',
      data: HOURS,
      axisLabel: {
        fontSize: 9,
        interval: 3,
        rotate: 30,
      },
    },
    yAxis: {
      type: 'value',
      name: 'kWh',
      nameTextStyle: { fontSize: 9 },
      axisLabel: { fontSize: 9 },
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