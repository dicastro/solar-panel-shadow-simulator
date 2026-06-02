import { jsPDF } from 'jspdf';
import { LoadedSetupResult } from '../types/results';
import { MARGIN, CONTENT_W, C_DARK, C_MUTED, font, Cursor } from './PdfLayout';
import { SetupColoursUtils } from '../utils/SetupColoursUtils';
import { StringColoursUtils } from '../utils/StringColourUtils';
import { drawScaleBar } from './PdfPrimitives';

// ── Shade colour interpolation ────────────────────────────────────────────────

/**
 * Maps a shade fraction (0–1) to an RGB tuple using the same
 * green → yellow → red interpolation as the web UI heat maps.
 */
export const shadeToRgb = (f: number): [number, number, number] => {
  const c = Math.max(0, Math.min(1, f));
  if (c < 0.5) {
    const t = c * 2;
    return [Math.round(46 + 195 * t), Math.round(204 - 8 * t), Math.round(113 - 98 * t)];
  }
  const t = (c - 0.5) * 2;
  return [Math.round(241 - 10 * t), Math.round(196 - 120 * t), Math.round(15 + 45 * t)];
};

// ── Zone average shade ────────────────────────────────────────────────────────

/**
 * Computes the average shade fraction for one zone over the selected time window.
 * When month or day is null, averages across all months or days respectively.
 */
export const zoneAvgShade = (
  zf: number[][][][],
  zIdx: number,
  month: number | null,
  day: number | null,
): number => {
  const months = month !== null ? [month] : Array.from({ length: 12 }, (_, i) => i);
  const days = day !== null ? [day] : Array.from({ length: 31 }, (_, i) => i);
  let total = 0, count = 0;
  for (const m of months) {
    for (const d of days) {
      for (let h = 0; h < 24; h++) {
        total += zf[zIdx]?.[m]?.[d]?.[h] ?? 0;
        count++;
      }
    }
  }
  return count > 0 ? total / count : 0;
};

// ── Heat map drawing ──────────────────────────────────────────────────────────

const CELL_GAP = 1.5;   // mm between panels in a row
const ARRAY_GAP = 6;    // mm between consecutive arrays

/**
 * Draws the shadow heat map for a single setup on the current PDF page.
 *
 * Array ordering: highest arrayIndex at the top (rendered first), array 0
 * at the bottom. This matches the physical installation perspective where
 * array 0 is the southernmost.
 *
 * Row ordering within each array: highest rowIdx at the top (northernmost
 * panels), row 0 at the bottom (southernmost panels).
 *
 * Each zone cell shows two text elements:
 *  - Zone ID (e.g. "a0-r0-c0-z1") in the upper half, smaller font.
 *  - Shade percentage in the lower half, larger font for emphasis.
 * Both font sizes scale with the zone cell's smaller dimension.
 */
export const drawSetupHeatmap = (
  doc: jsPDF,
  cursor: Cursor,
  result: LoadedSetupResult,
  month: number | null,
  day: number | null,
): void => {
  const panels = result.result.panels;
  const colour = SetupColoursUtils.getSetupColour(result.colourIndex);

  // Group panels by arrayIndex.
  const byArray = new Map<number, typeof panels[number][]>();
  panels.forEach(p => {
    const arr = byArray.get(p.arrayIndex) ?? [];
    arr.push(p);
    byArray.set(p.arrayIndex, arr);
  });

  // Highest arrayIndex rendered first (top of page), array 0 last (bottom).
  const sortedArrays = Array.from(byArray.entries()).sort(([a], [b]) => b - a);

  // Cell size: fit the widest array into CONTENT_W, cap at 28 mm.
  const maxCols = Math.max(...sortedArrays.map(([, ps]) =>
    Math.max(...ps.map(p => p.col)) + 1,
  ));
  const sample = sortedArrays[0][1][0];
  const panelAspect = sample.actualHeight / sample.actualWidth;
  const cellW = Math.min(28, (CONTENT_W - (maxCols - 1) * CELL_GAP) / maxCols);
  const cellH = cellW * panelAspect;

  // Setup label.
  font(doc, 8, 'bold', colour);
  cursor.ensureSpace(8);
  doc.text(result.result.setupLabel, MARGIN, cursor.y + 6);
  cursor.advance(8);

  // String legend.
  const stringLegend = new Map<string, number>();
  for (const panel of panels) {
    if (!stringLegend.has(panel.string)) {
      stringLegend.set(panel.string, panel.stringColorIndex);
    }
  }

  if (stringLegend.size > 0) {
    cursor.ensureSpace(8);
    let lx = MARGIN;
    const SWATCH = 3;
    const GAP = 2;
    const LABEL_W = 16;
    const ITEM_W = SWATCH + GAP + LABEL_W + 4;

    for (const [string, colorIndex] of stringLegend.entries()) {
      const hex = StringColoursUtils.getStringColour(colorIndex);
      doc.setFillColor(hex);
      doc.rect(lx, cursor.y + 1, SWATCH, SWATCH, 'F');
      font(doc, 6.5, 'bold', C_DARK);
      doc.text(string, lx + SWATCH + GAP, cursor.y + SWATCH);
      lx += ITEM_W;
    }
    cursor.advance(7);
  }

  sortedArrays.forEach(([arrayIndex, arrPanels]) => {
    const rows = Math.max(...arrPanels.map(p => p.row)) + 1;
    const cols = Math.max(...arrPanels.map(p => p.col)) + 1;

    // Build a row×col lookup grid.
    const grid: (typeof panels[number] | null)[][] = Array.from(
      { length: rows }, () => new Array(cols).fill(null),
    );
    arrPanels.forEach(p => { grid[p.row][p.col] = p; });

    // Array label.
    font(doc, 7, 'normal', C_MUTED);
    cursor.ensureSpace(6);
    doc.text(`Array ${arrayIndex}`, MARGIN, cursor.y + 4.5);
    cursor.advance(6);

    const arrayBlockH = rows * cellH + (rows - 1) * CELL_GAP;
    cursor.ensureSpace(arrayBlockH + ARRAY_GAP);
    const arrayTop = cursor.y;

    // Iterate rows in reverse: rowIdx = rows-1 is drawn at yOff=0 (top),
    // rowIdx = 0 is drawn last (bottom), matching physical orientation.
    for (let rowIdx = rows - 1; rowIdx >= 0; rowIdx--) {
      const yOff = (rows - 1 - rowIdx) * (cellH + CELL_GAP);

      for (let colIdx = 0; colIdx < cols; colIdx++) {
        const panel = grid[rowIdx][colIdx];
        if (!panel) continue;

        const cx = MARGIN + colIdx * (cellW + CELL_GAP);
        const cy = arrayTop + yOff;
        const isHoriz = panel.zonesDisposition === 'horizontal';
        const zCount = panel.zones;

        for (let zIdx = 0; zIdx < zCount; zIdx++) {
          const frac = zoneAvgShade(panel.zoneShadeFraction, zIdx, month, day);
          const [r, g, b] = shadeToRgb(frac);
          doc.setFillColor(r, g, b);

          let zx: number, zy: number, zw: number, zh: number;
          if (isHoriz) {
            const zh0 = cellH / zCount;
            zx = cx; zy = cy + zIdx * zh0; zw = cellW; zh = zh0 - 0.3;
          } else {
            const zw0 = cellW / zCount;
            zx = cx + zIdx * zw0; zy = cy; zw = zw0 - 0.3; zh = cellH;
          }
          doc.rect(zx, zy, zw, zh, 'F');

          // Font sizes scale with the smaller zone dimension.
          const minDim = Math.min(zw, zh);
          const pctFs = Math.max(4, Math.min(8, minDim * 1.6));
          const idFs = Math.max(3, Math.min(5.5, pctFs * 0.65));
          const textColor = frac > 0.55 ? '#ffffff' : '#111111';

          // Zone ID in the upper half of the cell (smaller font).
          const zoneId = `${panel.panelId}-z${zIdx}`;
          font(doc, idFs, 'normal', textColor);
          doc.text(zoneId, zx + zw / 2, zy + zh * 0.35, { align: 'center' });

          // Shade % in the lower half of the cell (larger, bold).
          const pct = `${(frac * 100).toFixed(0)}%`;
          font(doc, pctFs, 'bold', textColor);
          doc.text(pct, zx + zw / 2, zy + zh * 0.72, { align: 'center' });
        }

        // Panel border.
        const borderHex = StringColoursUtils.getStringColour(panel.stringColorIndex);
        doc.setDrawColor(borderHex);
        doc.setLineWidth(0.15);
        doc.rect(cx, cy, cellW, cellH, 'S');
      }
    }

    cursor.advance(arrayBlockH + ARRAY_GAP);
  });

  drawScaleBar(doc, cursor, shadeToRgb);
};