import ReactECharts from 'echarts-for-react';
import { LoadedSetupResult } from '../../types/results';
import { SetupColoursUtils } from '../../utils/SetupColoursUtils';

interface Props {
  results: LoadedSetupResult[];
  activeSetupIds: Set<string>;
  month: number;
  /** 0-based day-of-month index */
  day: number;
  /** IANA timezone identifier used to shift UTC hour buckets to local time. */
  timezone: string;
}

/**
 * Returns the UTC-to-local hour offset for a given timezone on a specific date.
 *
 * Strategy: format noon UTC (12:00) in the target timezone. The resulting local
 * hour minus 12 gives the offset. Using a fixed reference point (noon) avoids
 * DST edge cases that occur near midnight.
 *
 * The "24" edge case (some Intl engines return "24" for midnight) is handled
 * by the modulo.
 */
const getUtcOffsetHours = (timezone: string, year: number, month: number, day: number): number => {
  try {
    const utcMs = Date.UTC(year, month, day + 1, 12, 0, 0);
    const localStr = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).format(new Date(utcMs));
    const localH = parseInt(localStr, 10) % 24;
    return localH - 12;
  } catch {
    return 0;
  }
};

/**
 * Line chart showing hourly production (kWh) for a selected day.
 *
 * The X axis always shows sequential local hour labels (00:00–23:00).
 * The data array is rotated so that position i carries the production for
 * local hour i: data[i] = energyKwh[month][day][(startUtc + i) % 24]
 * where startUtc is the UTC hour corresponding to local midnight.
 *
 * Example — Europe/Madrid in May (UTC+2):
 *   startUtc = 22  (local 00:00 = UTC 22:00)
 *   data[0]  = energyKwh[m][d][22]  → 00:00 local
 *   data[8]  = energyKwh[m][d][6]   → 08:00 local  (production starts here)
 *   data[20] = energyKwh[m][d][18]  → 20:00 local  (production ends here)
 */
export function DailyLineChart({ results, activeSetupIds, month, day, timezone }: Props) {
  const visible = results.filter(r => activeSetupIds.has(r.setupId));
  if (visible.length === 0) return null;

  const year = visible[0].result.year;
  const offsetHours = getUtcOffsetHours(timezone, year, month, day);
  const startUtc = ((-offsetHours) + 24) % 24;

  // Sequential local hour labels — always 00:00 to 23:00.
  const localLabels = Array.from({ length: 24 }, (_, i) =>
    `${String(i).padStart(2, '0')}:00`,
  );

  const series = visible.map(r => {
    // Rotate the UTC array so index 0 = local midnight.
    const data = Array.from({ length: 24 }, (_, localH) =>
      parseFloat(
        r.result.panels
          .reduce((sum, p) => sum + p.energyKwh[month][day][(startUtc + localH) % 24], 0)
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
      data: localLabels,
      axisLabel: { fontSize: 9, interval: 3, rotate: 30 },
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