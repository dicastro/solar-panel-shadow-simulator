import { jsPDF } from 'jspdf';
import { LoadedSetupResult } from '../types/results';
import { MARGIN, CONTENT_W, PAGE_H, C_DARK, font, Cursor } from './PdfLayout';
import { SetupColoursUtils } from '../utils/SetupColoursUtils';
import { StringColoursUtils } from '../utils/StringColourUtils';
import { drawScaleBar } from './PdfPrimitives';

export const shadeToRgb = (f: number): [number, number, number] => {
  const c = Math.max(0, Math.min(1, f));
  if (c < 0.5) {
    const t = c * 2;
    return [Math.round(46 + 195 * t), Math.round(204 - 8 * t), Math.round(113 - 98 * t)];
  }
  const t = (c - 0.5) * 2;
  return [Math.round(241 - 10 * t), Math.round(196 - 120 * t), Math.round(15 + 45 * t)];
};

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

const CELL_GAP_MM = 1.0;
const ARRAY_LABEL_H_MM = 5.5;
const SCALE_BAR_H_MM = 12;
const MAX_CELL_W_MM = 28;

interface ArrayEntry {
  arrayIndex: number;
  rows: number;
  cols: number;
  configPosition: [number, number];
  panels: LoadedSetupResult['result']['panels'][number][];
}

const buildArrayEntries = (
  panels: LoadedSetupResult['result']['panels'],
): ArrayEntry[] => {
  const byArray = new Map<number, LoadedSetupResult['result']['panels'][number][]>();
  for (const p of panels) {
    const entry = byArray.get(p.arrayIndex);
    if (entry) { entry.push(p); } else { byArray.set(p.arrayIndex, [p]); }
  }
  return Array.from(byArray.entries())
    .sort(([a], [b]) => a - b)
    .map(([arrayIndex, arrPanels]) => ({
      arrayIndex,
      rows: Math.max(...arrPanels.map(p => p.row)) + 1,
      cols: Math.max(...arrPanels.map(p => p.col)) + 1,
      configPosition: arrPanels[0].arrayConfigPosition,
      panels: arrPanels,
    }));
};

interface PositionedEntry {
  entry: ArrayEntry;
  xMm: number;
  yMm: number;
  gridW: number;
  gridH: number;
  blockW: number;
  blockH: number;
}

const computePdfPositions = (
  entries: ArrayEntry[],
  panelW: number,
  panelH: number,
  availableH: number,
): { positioned: PositionedEntry[]; totalH: number; cellW: number; cellH: number } => {
  const minX = Math.min(...entries.map(e => e.configPosition[0]));
  const maxZ = Math.max(...entries.map(e => e.configPosition[1]));
  const minZ = Math.min(...entries.map(e => e.configPosition[1]));

  const maxRightM = Math.max(...entries.map(e => (e.configPosition[0] - minX) + e.cols * panelW));
  const maxTopM = (maxZ - minZ) + Math.max(...entries.map(e => e.rows)) * panelH;

  const naturalScale = MAX_CELL_W_MM / Math.max(panelW, panelH);
  const hFitScale = maxRightM > 0 ? CONTENT_W / maxRightM : naturalScale;
  const vFitScale = maxTopM > 0 ? (availableH - ARRAY_LABEL_H_MM) / maxTopM : naturalScale;

  const mmPerMetre = Math.min(naturalScale, hFitScale, vFitScale);
  const cellW = panelW * mmPerMetre;
  const cellH = panelH * mmPerMetre;

  const raw: PositionedEntry[] = entries.map(e => {
    const gridW = e.cols * cellW + (e.cols - 1) * CELL_GAP_MM;
    const gridH = e.rows * cellH + (e.rows - 1) * CELL_GAP_MM;
    const blockW = gridW;
    const blockH = gridH;
    const xMm = (e.configPosition[0] - minX) * mmPerMetre;
    const yMm = (maxZ - e.configPosition[1]) * mmPerMetre;
    return { entry: e, xMm, yMm, gridW, gridH, blockW, blockH };
  });

  const totalH = Math.max(...raw.map(p => p.yMm + p.blockH));
  return { positioned: raw, totalH, cellW, cellH };
};

const drawArrayBlock = (
  doc: jsPDF,
  entry: ArrayEntry,
  xMm: number,
  yMm: number,
  cellW: number,
  cellH: number,
  blockW: number,
  month: number | null,
  day: number | null,
): void => {
  const { rows, cols, panels } = entry;

  const grid: (typeof panels[number] | null)[][] = Array.from(
    { length: rows }, () => new Array(cols).fill(null),
  );
  panels.forEach(p => { grid[p.row][p.col] = p; });

  const gridW = cols * cellW + (cols - 1) * CELL_GAP_MM;
  const gridOffsetX = (blockW - gridW) / 2;
  const gridTop = yMm;

  for (let rowIdx = rows - 1; rowIdx >= 0; rowIdx--) {
    const yRow = gridTop + (rows - 1 - rowIdx) * (cellH + CELL_GAP_MM);

    for (let colIdx = 0; colIdx < cols; colIdx++) {
      const panel = grid[rowIdx][colIdx];
      if (!panel) continue;

      const xCell = xMm + gridOffsetX + colIdx * (cellW + CELL_GAP_MM);
      const isHoriz = panel.zonesDisposition === 'horizontal';
      const zCount = panel.zones;

      for (let zIdx = 0; zIdx < zCount; zIdx++) {
        const frac = zoneAvgShade(panel.zoneShadeFraction, zIdx, month, day);
        const [r, g, b] = shadeToRgb(frac);
        doc.setFillColor(r, g, b);

        let zx: number, zy: number, zw: number, zh: number;
        if (isHoriz) {
          const zh0 = cellH / zCount;
          zx = xCell; zy = yRow + zIdx * zh0; zw = cellW; zh = zh0 - 0.3;
        } else {
          const zw0 = cellW / zCount;
          zx = xCell + zIdx * zw0; zy = yRow; zw = zw0 - 0.3; zh = cellH;
        }
        doc.rect(zx, zy, zw, zh, 'F');

        const minDim = Math.min(zw, zh);
        const pctFs = Math.max(3.5, Math.min(8, minDim * 1.6));
        const idFs = Math.max(2.5, Math.min(5.5, pctFs * 0.65));
        const textColor = frac > 0.55 ? '#ffffff' : '#111111';

        font(doc, idFs, 'normal', textColor);
        doc.text(`${panel.panelId}-z${zIdx}`, zx + zw / 2, zy + zh * 0.35, { align: 'center' });
        font(doc, pctFs, 'bold', textColor);
        doc.text(`${(frac * 100).toFixed(0)}%`, zx + zw / 2, zy + zh * 0.72, { align: 'center' });
      }

      doc.setDrawColor(StringColoursUtils.getStringColour(panel.stringColorIndex));
      doc.setLineWidth(0.40);
      doc.rect(xCell, yRow, cellW, cellH, 'S');
    }
  }
};

export const drawSetupHeatmap = (
  doc: jsPDF,
  cursor: Cursor,
  result: LoadedSetupResult,
  month: number | null,
  day: number | null,
): void => {
  const panels = result.result.panels;
  const colour = SetupColoursUtils.getSetupColour(result.colourIndex);

  const entries = buildArrayEntries(panels);
  const samplePanel = panels[0];
  if (!samplePanel || entries.length === 0) return;

  font(doc, 8, 'bold', colour);
  cursor.ensureSpace(8);
  doc.text(result.result.setupLabel, MARGIN, cursor.y + 6);
  cursor.advance(8);

  const stringLegend = new Map<string, number>();
  for (const panel of panels) {
    if (!stringLegend.has(panel.string)) stringLegend.set(panel.string, panel.stringColorIndex);
  }
  if (stringLegend.size > 0) {
    cursor.ensureSpace(7);
    let lx = MARGIN;
    const SWATCH = 3;
    const GAP = 1.5;
    for (const [string, colorIndex] of stringLegend.entries()) {
      doc.setFillColor(StringColoursUtils.getStringColour(colorIndex));
      doc.rect(lx, cursor.y + 1, SWATCH, SWATCH, 'F');
      font(doc, 6.5, 'bold', C_DARK);
      const labelW = doc.getTextWidth(string);
      doc.text(string, lx + SWATCH + GAP, cursor.y + SWATCH);
      lx += SWATCH + GAP + labelW + 4;
    }
    cursor.advance(7);
  }

  const availableH = PAGE_H - 14 - cursor.y - SCALE_BAR_H_MM;
  const { positioned, totalH, cellW, cellH } = computePdfPositions(
    entries,
    samplePanel.actualWidth,
    samplePanel.actualHeight,
    availableH,
  );

  const blockTop = cursor.y;
  for (const { entry, xMm, yMm, blockW } of positioned) {
    drawArrayBlock(doc, entry, MARGIN + xMm, blockTop + yMm, cellW, cellH, blockW, month, day);
  }

  cursor.advance(totalH + 4);
  drawScaleBar(doc, cursor, shadeToRgb);
};