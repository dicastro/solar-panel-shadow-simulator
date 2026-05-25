import { jsPDF } from 'jspdf';
import { GenerateReportOptions, ReportDay, PdfLabels } from './PdfTypes';
import { Cursor, MARGIN, PAGE_H, PAGE_W, C_MUTED, font } from './PdfLayout';
import { drawCover, drawAnnualSection, drawHeatmapsSection, drawMonthlySection, drawDailySection } from './PdfSections';

// Re-export public types so callers only need to import from this file.
export type { ReportDay, PdfLabels, GenerateReportOptions };

// ── Footer ────────────────────────────────────────────────────────────────────

const drawFooters = (doc: jsPDF, appVersion: string, appName: string): void => {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    font(doc, 7, 'normal', C_MUTED);
    doc.text(`${appName} v${appVersion}`, MARGIN, PAGE_H - 6);
    doc.text(`${i} / ${total}`, PAGE_W - MARGIN, PAGE_H - 6, { align: 'right' });
  }
};

// ── Filename ──────────────────────────────────────────────────────────────────

const encodeCoord = (v: number): string => {
  const sign = v >= 0 ? 'p' : 'n';
  return sign + Math.abs(v).toFixed(4).replace('.', 'd');
};

const buildFilename = (opts: GenerateReportOptions): string => {
  const ts = new Date()
    .toISOString()
    .slice(0, 19)
    .replace('T', '')
    .replace(/-/g, '')
    .replace(/:/g, '');
  return `solarsim-${encodeCoord(opts.latitude)}-${encodeCoord(opts.longitude)}-sim-${opts.simulationCode}-${ts}.pdf`;
};

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Generates and downloads a PDF report for the given simulation results.
 *
 * Document structure:
 *   Page 1         — Cover (simulation parameters)
 *   Page 2         — Annual section (bar chart + totals table)
 *   Pages 3..N     — Shadow heat maps (one page per setup)
 *   Page N+1       — Monthly section (grouped bar chart + monthly table)
 *   Pages N+2..M   — Daily sections (one pair of pages per selected day:
 *                      page 1 = charts, page 2 = hourly data table)
 *
 * Charts are rendered via ECharts SSR (no DOM) and embedded via svg2pdf.js.
 * Heat maps are drawn with jsPDF rectangle primitives. No html2canvas, no
 * timing dependencies, no off-screen React components.
 */
export const generatePdfReport = async (opts: GenerateReportOptions): Promise<void> => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Cover.
  drawCover(doc, opts);

  // Annual section.
  doc.addPage();
  await drawAnnualSection(doc, new Cursor(doc), opts);

  // Heat maps: one page per setup.
  drawHeatmapsSection(doc, opts);

  // Monthly section.
  await drawMonthlySection(doc, opts);

  // Daily sections.
  for (const reportDay of opts.selectedDays) {
    await drawDailySection(doc, opts, reportDay);
  }

  // Footers on every page.
  drawFooters(doc, opts.appVersion, opts.labels.appName);

  doc.save(buildFilename(opts));
};