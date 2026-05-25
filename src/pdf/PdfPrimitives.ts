import { jsPDF } from 'jspdf';
import { LoadedSetupResult } from '../types/results';
import { SetupColoursUtils } from '../utils/SetupColoursUtils';
import {
  MARGIN, CONTENT_W, PAGE_W,
  C_DARK, C_ACCENT, C_MUTED, C_BORDER, C_ROW_ODD, C_HEADER_BG,
  font, setupLetter, Cursor,
} from './PdfLayout';

// ── Section / sub-section headings ────────────────────────────────────────────

/** Green-underlined section heading. Consumes ~14 mm of vertical space. */
export const drawSectionHeading = (doc: jsPDF, cursor: Cursor, title: string): void => {
  cursor.ensureSpace(12);
  font(doc, 13, 'bold', C_ACCENT);
  doc.text(title, MARGIN, cursor.y + 8);
  cursor.advance(9);
  doc.setDrawColor(C_ACCENT);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, cursor.y, PAGE_W - MARGIN, cursor.y);
  cursor.advance(5);
};

/** Bold sub-section label. Consumes ~8 mm of vertical space. */
export const drawSubHeading = (doc: jsPDF, cursor: Cursor, title: string): void => {
  cursor.ensureSpace(9);
  font(doc, 9, 'bold', C_DARK);
  doc.text(title, MARGIN, cursor.y + 6);
  cursor.advance(8);
};

// ── Legend ────────────────────────────────────────────────────────────────────

/**
 * Draws a colour-swatch + letter + full label row for each setup.
 * Uses the same colour palette as the web UI legend.
 */
export const drawLegend = (doc: jsPDF, cursor: Cursor, results: LoadedSetupResult[]): void => {
  const LINE_H = 5.5;
  const SWATCH_W = 4;
  const SWATCH_H = 3;

  cursor.ensureSpace(results.length * LINE_H + 4);

  results.forEach((r, i) => {
    const colour = SetupColoursUtils.getSetupColour(r.colourIndex);
    const top = cursor.y;

    doc.setFillColor(colour);
    doc.rect(MARGIN, top + (LINE_H - SWATCH_H) / 2, SWATCH_W, SWATCH_H, 'F');

    font(doc, 7, 'bold', colour);
    doc.text(setupLetter(i), MARGIN + SWATCH_W + 2, top + LINE_H - 1.2);

    font(doc, 7, 'normal', C_DARK);
    doc.text(r.result.setupLabel, MARGIN + SWATCH_W + 8, top + LINE_H - 1.2, {
      maxWidth: CONTENT_W - SWATCH_W - 10,
    });

    cursor.advance(LINE_H);
  });

  cursor.advance(3);
};

// ── Table ─────────────────────────────────────────────────────────────────────

const ROW_H = 5.5;
const HEADER_H = 6.5;

/**
 * Draws a data table starting at `cursor.y`.
 *
 * `cursor.y` is the TOP of the header row when this function is called.
 * The cursor is advanced past the full table height including a 5 mm gap.
 *
 * Column widths (mm) must sum to at most CONTENT_W.
 * Text is left-aligned with 1.5 mm left padding per cell.
 */
export const drawTable = (
  doc: jsPDF,
  cursor: Cursor,
  headers: string[],
  rows: string[][],
  colWidths: number[],
): void => {
  const totalW = colWidths.reduce((a, b) => a + b, 0);

  cursor.ensureSpace(HEADER_H + ROW_H * 2);

  // Header background.
  doc.setFillColor(C_HEADER_BG);
  doc.rect(MARGIN, cursor.y, totalW, HEADER_H, 'F');

  // Header text.
  font(doc, 7.5, 'bold', C_DARK);
  let x = MARGIN;
  headers.forEach((h, i) => {
    doc.text(h, x + 1.5, cursor.y + HEADER_H - 1.8);
    x += colWidths[i];
  });

  doc.setDrawColor(C_BORDER);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, cursor.y + HEADER_H, MARGIN + totalW, cursor.y + HEADER_H);
  cursor.advance(HEADER_H);

  // Data rows.
  font(doc, 7, 'normal', C_DARK);
  rows.forEach((row, rowIdx) => {
    cursor.ensureSpace(ROW_H + 1);
    if (rowIdx % 2 !== 0) {
      doc.setFillColor(C_ROW_ODD);
      doc.rect(MARGIN, cursor.y, totalW, ROW_H, 'F');
    }
    let cx = MARGIN;
    row.forEach((cell, ci) => {
      doc.text(cell, cx + 1.5, cursor.y + ROW_H - 1.5);
      cx += colWidths[ci];
    });
    cursor.advance(ROW_H);
  });

  cursor.advance(5);
};

// ── Colour scale bar ──────────────────────────────────────────────────────────

/**
 * Draws the green→yellow→red gradient scale bar used below heat maps.
 * Consumes ~8 mm of vertical space.
 */
export const drawScaleBar = (doc: jsPDF, cursor: Cursor, shadeToRgb: (f: number) => [number, number, number]): void => {
  cursor.ensureSpace(8);
  font(doc, 6.5, 'normal', C_MUTED);
  doc.text('0%', MARGIN, cursor.y + 4);
  const BAR_START = MARGIN + 7;
  const BAR_W = 40;
  const STEPS = BAR_W * 2;
  for (let i = 0; i < STEPS; i++) {
    const [r, g, b] = shadeToRgb(i / STEPS);
    doc.setFillColor(r, g, b);
    doc.rect(BAR_START + i * (BAR_W / STEPS), cursor.y, BAR_W / STEPS + 0.1, 3, 'F');
  }
  doc.text('100%', BAR_START + BAR_W + 2, cursor.y + 4);
  cursor.advance(8);
};