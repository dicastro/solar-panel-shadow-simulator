import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';
import { LoadedSetupResult } from '../types/results';
import { SetupColoursUtils } from '../utils/SetupColoursUtils';
import { CONTENT_W, setupLetter } from './PdfLayout';

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, SVGRenderer]);

// ── SSR rendering ─────────────────────────────────────────────────────────────

/**
 * Renders an ECharts option to an SVG string using ECharts SSR mode.
 * No DOM element, no canvas, no async timing required.
 * Width and height are given in mm; rendered at 4 px/mm for crisp output.
 */
export const renderChartSvg = (option: EChartsOption, widthMm: number, heightMm: number): string => {
  const PX = 4;
  const chart = echarts.init(null as unknown as HTMLElement, null, {
    renderer: 'svg',
    ssr: true,
    width: Math.round(widthMm * PX),
    height: Math.round(heightMm * PX),
  });
  chart.setOption(option);
  const svg = chart.renderToSVGString();
  chart.dispose();
  return svg;
};

/**
 * Embeds an SVG string into the current PDF page at the specified position
 * and size using svg2pdf.js. Creates a temporary DOM div to obtain an
 * SVGElement, which is what svg2pdf expects.
 */
export const embedSvg = async (
  doc: jsPDF,
  svgString: string,
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<void> => {
  const div = document.createElement('div');
  div.innerHTML = svgString;
  const svgEl = div.firstElementChild as SVGElement;
  await doc.svg(svgEl, { x, y, width, height });
};

// ── Timezone helpers ──────────────────────────────────────────────────────────

/**
 * Returns the UTC-to-local hour offset for the given IANA timezone on a
 * specific date. Formats noon UTC (12:00) in the target timezone and derives
 * the offset from the resulting local hour. Using noon avoids DST edge cases
 * that occur near midnight.
 */
export const getUtcOffsetHours = (
  timezone: string,
  year: number,
  month: number,
  day: number,
): number => {
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
 * Returns the UTC hour index corresponding to local midnight (00:00).
 *
 * Example: Europe/Madrid in May (UTC+2) → local 00:00 = UTC 22:00 → returns 22.
 *
 * To map a local hour to its UTC array index:
 *   utcIndex = (startUtc + localH) % 24
 */
export const localMidnightUtcHour = (offsetHours: number): number =>
  ((-offsetHours) + 24) % 24;

/** Sequential local hour labels: ["00:00", "01:00", ..., "23:00"]. */
export const buildLocalHourLabels = (): string[] =>
  Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

// ── ECharts option builders ───────────────────────────────────────────────────

export const buildAnnualBarOption = (results: LoadedSetupResult[]): EChartsOption => ({
  backgroundColor: '#ffffff',
  animation: false,
  grid: { left: 30, right: 90, top: 10, bottom: 14 },
  xAxis: {
    type: 'value',
    axisLabel: { fontSize: 10 },
    splitLine: { lineStyle: { color: '#eeeeee' } },
  },
  yAxis: {
    type: 'category',
    data: results.map((_, i) => setupLetter(i)),
    axisLabel: { fontSize: 12, fontWeight: 'bold' },
    axisTick: { show: false },
  },
  series: [{
    type: 'bar',
    barMaxWidth: 28,
    data: results.map((r, i) => ({
      value: parseFloat(r.result.annualTotalKwh.toFixed(1)),
      itemStyle: { color: SetupColoursUtils.getSetupColour(r.colourIndex) },
    })),
    label: {
      show: true,
      position: 'right',
      fontSize: 10,
      formatter: (p: { value: unknown }) => `${(p.value as number).toLocaleString()} kWh`,
    },
  }],
});

export const buildMonthlyGroupedBarOption = (
  results: LoadedSetupResult[],
  monthLabels: string[],
): EChartsOption => ({
  backgroundColor: '#ffffff',
  animation: false,
  grid: { left: 10, right: 10, top: 16, bottom: 36, containLabel: true },
  xAxis: {
    type: 'category',
    data: monthLabels,
    axisLabel: { fontSize: 9, interval: 0, rotate: 30 },
  },
  yAxis: {
    type: 'value',
    axisLabel: { fontSize: 8 },
    splitLine: { lineStyle: { color: '#eeeeee' } },
  },
  series: results.map((r, i) => ({
    name: setupLetter(i),
    type: 'bar' as const,
    barGap: '8%',
    data: r.result.monthlyTotalKwh.map(v => parseFloat(v.toFixed(1))),
    itemStyle: { color: SetupColoursUtils.getSetupColour(r.colourIndex) },
  })),
});

export const buildDailyBarOption = (
  results: LoadedSetupResult[],
  month: number,
  day: number,
): EChartsOption => ({
  backgroundColor: '#ffffff',
  animation: false,
  grid: { left: 30, right: 90, top: 10, bottom: 14 },
  xAxis: {
    type: 'value',
    axisLabel: { fontSize: 9 },
    splitLine: { lineStyle: { color: '#eeeeee' } },
  },
  yAxis: {
    type: 'category',
    data: results.map((_, i) => setupLetter(i)),
    axisLabel: { fontSize: 12, fontWeight: 'bold' },
    axisTick: { show: false },
  },
  series: [{
    type: 'bar',
    barMaxWidth: 22,
    data: results.map((r, i) => ({
      value: parseFloat(
        r.result.panels
          .reduce((s, p) => s + p.energyKwh[month][day].reduce((a, b) => a + b, 0), 0)
          .toFixed(3),
      ),
      itemStyle: { color: SetupColoursUtils.getSetupColour(r.colourIndex) },
    })),
    label: {
      show: true,
      position: 'right',
      fontSize: 9,
      formatter: (p: { value: unknown }) => `${p.value} kWh`,
    },
  }],
});

/**
 * Builds the hourly line chart option for a single day.
 *
 * X axis: sequential local hour labels (00:00–23:00).
 * Data: rotated so index i = production at local hour i.
 *   data[i] = sum of energyKwh[month][day][(startUtc + i) % 24] across all panels.
 */
export const buildDailyLineOption = (
  results: LoadedSetupResult[],
  month: number,
  day: number,
  startUtc: number,
): EChartsOption => ({
  backgroundColor: '#ffffff',
  animation: false,
  grid: { left: 10, right: 10, top: 10, bottom: 36, containLabel: true },
  xAxis: {
    type: 'category',
    data: buildLocalHourLabels(),
    axisLabel: { fontSize: 8, interval: 3, rotate: 30 },
  },
  yAxis: {
    type: 'value',
    axisLabel: { fontSize: 8 },
    splitLine: { lineStyle: { color: '#eeeeee' } },
  },
  series: results.map((r, i) => ({
    name: setupLetter(i),
    type: 'line' as const,
    smooth: true,
    symbol: 'none',
    lineStyle: { color: SetupColoursUtils.getSetupColour(r.colourIndex), width: 1.5 },
    areaStyle: { color: SetupColoursUtils.getSetupColour(r.colourIndex), opacity: 0.08 },
    data: Array.from({ length: 24 }, (_, localH) =>
      parseFloat(
        r.result.panels
          .reduce((s, p) => s + p.energyKwh[month][day][(startUtc + localH) % 24], 0)
          .toFixed(3),
      ),
    ),
  })),
});

// ── Chart embed helper (SVG rendered at CONTENT_W) ────────────────────────────

/**
 * Renders a chart option to SVG, embeds it in the PDF at the current cursor
 * position, and advances the cursor past the chart plus a 6 mm gap.
 */
export const renderAndEmbed = async (
  doc: jsPDF,
  option: EChartsOption,
  heightMm: number,
  cursorY: number,
): Promise<void> => {
  const svgStr = renderChartSvg(option, CONTENT_W, heightMm);
  await embedSvg(doc, svgStr, 14, cursorY, CONTENT_W, heightMm);
};