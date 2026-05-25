import { jsPDF } from 'jspdf';
import { GenerateReportOptions, ReportDay } from './PdfTypes';
import {
  PAGE_W, PAGE_H, MARGIN, CONTENT_W,
  C_ACCENT, C_DARK, C_MUTED, C_PARAM_BG,
  font, Cursor,
} from './PdfLayout';
import { drawSectionHeading, drawSubHeading, drawLegend, drawTable } from './PdfPrimitives';
import {
  renderChartSvg, embedSvg,
  getUtcOffsetHours, localMidnightUtcHour, buildLocalHourLabels,
  buildAnnualBarOption, buildMonthlyGroupedBarOption,
  buildDailyBarOption, buildDailyLineOption,
} from './PdfCharts';
import { drawSetupHeatmap } from './PdfHeatmap';
import { setupLetter } from './PdfLayout';

// ── Timestamp helper ──────────────────────────────────────────────────────────

export const formatTimestamp = (ts: number): string =>
  new Date(ts).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

// ── Cover page ────────────────────────────────────────────────────────────────

export const drawCover = (doc: jsPDF, opts: GenerateReportOptions): void => {
  const L = opts.labels;
  const midY = PAGE_H / 2 - 50;

  font(doc, 22, 'bold', C_DARK);
  doc.text(L.appName, PAGE_W / 2, midY, { align: 'center' });

  font(doc, 13, 'normal', C_ACCENT);
  doc.text(L.subtitle, PAGE_W / 2, midY + 12, { align: 'center' });

  doc.setDrawColor(C_ACCENT);
  doc.setLineWidth(0.4);
  doc.line(MARGIN + 20, midY + 17, PAGE_W - MARGIN - 20, midY + 17);

  const KEY_W = 58;
  const ROW = 7;
  let py = midY + 26;

  const params: [string, string][] = [
    [L.labelLocation, `${opts.latitude.toFixed(4)}, ${opts.longitude.toFixed(4)}`],
    [L.labelTimezone, opts.timezone],
    [L.labelYear, String(opts.year)],
    [L.labelInterval, `${opts.intervalMinutes} ${L.unitMin}`],
    [L.labelIrradiance, opts.irradianceSource === 'open-meteo' ? L.irradianceOpenMeteo : L.irradianceGeometric],
    [L.labelPointsPerZone, `${opts.density}×${opts.density} (${opts.density * opts.density} pts/zone)`],
    [L.labelThreshold, String(opts.threshold)],
    [L.labelSetupsCompared, String(opts.results.length)],
    [L.labelComputedAt, formatTimestamp(opts.computedAt)],
  ];

  params.forEach(([key, value], i) => {
    if (i % 2 === 0) {
      doc.setFillColor(C_PARAM_BG);
      doc.rect(MARGIN, py - ROW + 1.5, CONTENT_W, ROW, 'F');
    }
    font(doc, 8, 'bold', C_MUTED);
    doc.text(key, MARGIN + 2, py);
    font(doc, 8, 'normal', C_DARK);
    doc.text(value, MARGIN + KEY_W, py, { maxWidth: CONTENT_W - KEY_W - 2 });
    py += ROW;
  });
};

// ── Annual section ────────────────────────────────────────────────────────────

export const drawAnnualSection = async (
  doc: jsPDF,
  cursor: Cursor,
  opts: GenerateReportOptions,
): Promise<void> => {
  const L = opts.labels;

  drawSectionHeading(doc, cursor, L.sectionAnnual);
  drawSubHeading(doc, cursor, L.subLegend);
  drawLegend(doc, cursor, opts.results);

  // Annual bar chart.
  const chartHmm = 10 + opts.results.length * 13;
  const svgStr = renderChartSvg(buildAnnualBarOption(opts.results), CONTENT_W, chartHmm);
  cursor.ensureSpace(chartHmm + 6);
  await embedSvg(doc, svgStr, MARGIN, cursor.y, CONTENT_W, chartHmm);
  cursor.advance(chartHmm + 6);

  // Annual totals table.
  drawSubHeading(doc, cursor, L.subAnnualTotals);
  const col0W = 18;
  const colN = (CONTENT_W - col0W) / opts.results.length;
  drawTable(
    doc, cursor,
    ['', ...opts.results.map((_, i) => setupLetter(i))],
    [['Total', ...opts.results.map(r => `${r.result.annualTotalKwh.toFixed(1)} kWh`)]],
    [col0W, ...opts.results.map(() => colN)],
  );
};

// ── Heat maps section (one page per setup) ────────────────────────────────────

export const drawHeatmapsSection = (
  doc: jsPDF,
  opts: GenerateReportOptions,
): void => {
  for (const result of opts.results) {
    const cursor = new Cursor(doc);
    cursor.newPage();
    drawSectionHeading(doc, cursor, opts.labels.sectionHeatmaps);
    drawSetupHeatmap(doc, cursor, result, null, null);
  }
};

// ── Monthly section ───────────────────────────────────────────────────────────

export const drawMonthlySection = async (
  doc: jsPDF,
  opts: GenerateReportOptions,
): Promise<void> => {
  const L = opts.labels;
  const cursor = new Cursor(doc);
  cursor.newPage();

  drawSectionHeading(doc, cursor, L.sectionMonthly);
  drawSubHeading(doc, cursor, L.subLegend);
  drawLegend(doc, cursor, opts.results);

  const chartHmm = 78;
  const svgStr = renderChartSvg(
    buildMonthlyGroupedBarOption(opts.results, L.monthsShort),
    CONTENT_W, chartHmm,
  );
  cursor.ensureSpace(chartHmm + 6);
  await embedSvg(doc, svgStr, MARGIN, cursor.y, CONTENT_W, chartHmm);
  cursor.advance(chartHmm + 6);

  drawSubHeading(doc, cursor, L.subMonthlyTotals);
  const col0W = 16;
  const colN = (CONTENT_W - col0W) / opts.results.length;
  drawTable(
    doc, cursor,
    ['', ...opts.results.map((_, i) => setupLetter(i))],
    L.monthsShort.map((m, mIdx) => [
      m,
      ...opts.results.map(r => `${(r.result.monthlyTotalKwh[mIdx] ?? 0).toFixed(1)} kWh`),
    ]),
    [col0W, ...opts.results.map(() => colN)],
  );
};

// ── Daily section (two pages per selected day) ────────────────────────────────

export const drawDailySection = async (
  doc: jsPDF,
  opts: GenerateReportOptions,
  reportDay: ReportDay,
): Promise<void> => {
  const L = opts.labels;
  const { month, day, label } = reportDay;

  const offsetHours = getUtcOffsetHours(opts.timezone, opts.year, month, day);
  const startUtc = localMidnightUtcHour(offsetHours);
  const localLabels = buildLocalHourLabels();

  // ── Page 1: charts ──────────────────────────────────────────────────────────
  const cursor1 = new Cursor(doc);
  cursor1.newPage();
  drawSectionHeading(doc, cursor1, `${L.sectionDaily} — ${label}`);
  drawSubHeading(doc, cursor1, L.subLegend);
  drawLegend(doc, cursor1, opts.results);

  drawSubHeading(doc, cursor1, L.subDailyTotals);
  const barHmm = 10 + opts.results.length * 11;
  const barSvg = renderChartSvg(buildDailyBarOption(opts.results, month, day), CONTENT_W, barHmm);
  cursor1.ensureSpace(barHmm + 6);
  await embedSvg(doc, barSvg, MARGIN, cursor1.y, CONTENT_W, barHmm);
  cursor1.advance(barHmm + 6);

  drawSubHeading(doc, cursor1, L.subHourlyProduction);
  const lineHmm = 68;
  const lineSvg = renderChartSvg(
    buildDailyLineOption(opts.results, month, day, startUtc),
    CONTENT_W, lineHmm,
  );
  cursor1.ensureSpace(lineHmm + 6);
  await embedSvg(doc, lineSvg, MARGIN, cursor1.y, CONTENT_W, lineHmm);
  cursor1.advance(lineHmm + 6);

  // ── Page 2: hourly data table ───────────────────────────────────────────────
  const cursor2 = new Cursor(doc);
  cursor2.newPage();
  drawSubHeading(doc, cursor2, `${L.subHourlyData} — ${label}`);

  const col0W = 14;
  const colN = (CONTENT_W - col0W) / opts.results.length;
  drawTable(
    doc, cursor2,
    [L.colHour, ...opts.results.map((_, i) => setupLetter(i))],
    localLabels.map((localHLabel, localH) => {
      const utcH = (startUtc + localH) % 24;
      return [
        localHLabel,
        ...opts.results.map(r => {
          const val = r.result.panels.reduce(
            (s, p) => s + (p.energyKwh[month]?.[day]?.[utcH] ?? 0), 0,
          );
          return val > 0.0005 ? `${val.toFixed(3)} kWh` : L.zeroSymbol;
        }),
      ];
    }),
    [col0W, ...opts.results.map(() => colN)],
  );
};