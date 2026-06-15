import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadedSetupResult } from '../../types/results';
import { PanelAnnualData } from '../../types/simulation';
import { ZonesDisposition } from '../../types/config';
import { SetupColoursUtils } from '../../utils/SetupColoursUtils';
import { StringColoursUtils } from '../../utils/StringColourUtils';

interface Props {
  results: LoadedSetupResult[];
  activeSetupIds: Set<string>;
  month: number | null;
  day: number | null;
}

const MAX_PANEL_PX = 88;
const MAX_CONTAINER_W = 520;
const PANEL_GAP_PX = 3;
const LABEL_H_PX = 18;
/**
 * Minimum block width in px to fit "Array XX" (two-digit) label on one line.
 * At ~10px/char, "Array 00" ≈ 56px. Panel grid is centred within this width.
 */
const MIN_BLOCK_W_PX = 56;

const shadeToColour = (fraction: number): string => {
  const clamped = Math.max(0, Math.min(1, fraction));
  if (clamped < 0.5) {
    const t = clamped * 2;
    return `rgb(${Math.round(46 + 195 * t)},${Math.round(204 - 8 * t)},${Math.round(113 - 98 * t)})`;
  }
  const t = (clamped - 0.5) * 2;
  return `rgb(${Math.round(241 - 10 * t)},${Math.round(196 - 120 * t)},${Math.round(15 + 45 * t)})`;
};

const zoneAvgShade = (
  zoneShadeFraction: number[][][][],
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
        total += zoneShadeFraction[zIdx][m][d][h];
        count++;
      }
    }
  }
  return count > 0 ? total / count : 0;
};

const zoneCssLayouts = (
  zones: number,
  disposition: ZonesDisposition,
): { top: string; left: string; width: string; height: string }[] =>
  Array.from({ length: zones }, (_, i) => {
    const pct = 100 / zones;
    return disposition === 'horizontal'
      ? { top: `${i * pct}%`, left: '0%', width: '100%', height: `${pct}%` }
      : { top: '0%', left: `${i * pct}%`, width: `${pct}%`, height: '100%' };
  });

interface PanelGroup {
  arrayIndex: number;
  rows: number;
  cols: number;
  grid: (PanelAnnualData | null)[][];
  configPosition: [number, number];
}

const buildGroups = (panels: PanelAnnualData[]): PanelGroup[] => {
  const byArray = new Map<number, PanelAnnualData[]>();
  panels.forEach(p => {
    const arr = byArray.get(p.arrayIndex) ?? [];
    arr.push(p);
    byArray.set(p.arrayIndex, arr);
  });
  return Array.from(byArray.entries())
    .sort(([a], [b]) => a - b)
    .map(([arrayIndex, arrPanels]) => {
      const rows = Math.max(...arrPanels.map(p => p.row)) + 1;
      const cols = Math.max(...arrPanels.map(p => p.col)) + 1;
      const grid: (PanelAnnualData | null)[][] = Array.from(
        { length: rows }, () => new Array<PanelAnnualData | null>(cols).fill(null),
      );
      arrPanels.forEach(p => { grid[p.row][p.col] = p; });
      return { arrayIndex, rows, cols, grid, configPosition: arrPanels[0].arrayConfigPosition };
    });
};

/**
 * Computes cell dimensions and px-per-metre scale.
 * pxPerMetre = min(naturalScale, hFitScale).
 * naturalScale = min(cellW/panelW, cellH/panelH) bounds spacing on both axes.
 */
const computeLayout = (groups: PanelGroup[]): {
  cellW: number;
  cellH: number;
  pxPerMetre: number;
} => {
  const fallback = { cellW: MAX_PANEL_PX, cellH: MAX_PANEL_PX, pxPerMetre: 1 };
  if (groups.length === 0) return fallback;

  const samplePanel = groups.flatMap(g => g.grid.flat()).find(p => p !== null);
  if (!samplePanel) return fallback;

  const w = samplePanel.actualWidth;
  const h = samplePanel.actualHeight;
  const scaleToCell = MAX_PANEL_PX / Math.max(w, h);
  const cellW = Math.round(w * scaleToCell);
  const cellH = Math.round(h * scaleToCell);

  if (groups.length === 1) {
    return { cellW, cellH, pxPerMetre: Math.min(cellW / w, cellH / h) };
  }

  const naturalScale = Math.min(cellW / w, cellH / h);
  const minX = Math.min(...groups.map(g => g.configPosition[0]));
  const maxRightM = Math.max(
    ...groups.map(g => (g.configPosition[0] - minX) + g.cols * w),
  );
  const hFitScale = maxRightM > 0 ? MAX_CONTAINER_W / maxRightM : naturalScale;
  const pxPerMetre = Math.min(naturalScale, hFitScale);

  return { cellW, cellH, pxPerMetre };
};

function PanelCell({ panel, month, day, cellW, cellH }: {
  panel: PanelAnnualData;
  month: number | null;
  day: number | null;
  cellW: number;
  cellH: number;
}) {
  const layouts = zoneCssLayouts(panel.zones, panel.zonesDisposition);
  const stringColour = StringColoursUtils.getStringColour(panel.stringColorIndex);

  return (
    <div
      style={{
        width: cellW, height: cellH, position: 'relative', borderRadius: 2,
        overflow: 'hidden', flexShrink: 0,
        border: `2px solid ${stringColour}`,
      }}
      title={panel.panelId}
    >
      {layouts.map((layout, zIdx) => {
        const fraction = zoneAvgShade(panel.zoneShadeFraction, zIdx, month, day);
        const pct = (fraction * 100).toFixed(1);
        const zoneId = `${panel.panelId}-z${zIdx}`;
        return (
          <div
            key={zIdx}
            style={{
              position: 'absolute', top: layout.top, left: layout.left,
              width: layout.width, height: layout.height,
              background: shadeToColour(fraction), boxSizing: 'border-box',
              borderBottom:
                panel.zones > 1 && panel.zonesDisposition === 'horizontal' && zIdx < panel.zones - 1
                  ? '0.5px solid rgba(0,0,0,0.12)' : undefined,
              borderRight:
                panel.zones > 1 && panel.zonesDisposition === 'vertical' && zIdx < panel.zones - 1
                  ? '0.5px solid rgba(0,0,0,0.12)' : undefined,
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            }}
            title={`${zoneId} — ${pct}% shaded`}
          >
            <span style={{
              fontSize: '0.38rem', fontFamily: 'monospace',
              color: 'rgba(255,255,255,0.92)', textShadow: '0 0 2px rgba(0,0,0,0.8)',
              lineHeight: 1, userSelect: 'none', whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'clip', padding: '0 1px',
            }}>
              {zoneId}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Renders one array block: label centred above the panel grid.
 * blockW = max(arrayGridW, MIN_BLOCK_W_PX). The label spans blockW.
 * The panel grid is centred within blockW via margin-left.
 */
function ArrayBlock({ group, month, day, cellW, cellH, blockW }: {
  group: PanelGroup;
  month: number | null;
  day: number | null;
  cellW: number;
  cellH: number;
  blockW: number;
}) {
  const { t } = useTranslation();
  const arrayGridH = group.rows * cellH + (group.rows - 1) * PANEL_GAP_PX;
  const arrayGridW = group.cols * cellW + (group.cols - 1) * PANEL_GAP_PX;
  const gridOffsetLeft = Math.round((blockW - arrayGridW) / 2);

  return (
    <div style={{ width: blockW, display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div
        className="heatmap-array__label"
        style={{ width: blockW, whiteSpace: 'nowrap', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {t('resultsPanel.array')} {group.arrayIndex}
      </div>
      <div style={{ position: 'relative', width: arrayGridW, height: arrayGridH, marginLeft: gridOffsetLeft }}>
        {Array.from({ length: group.rows }, (_, i) => group.rows - 1 - i).map(rowIdx => (
          <div
            key={rowIdx}
            style={{
              position: 'absolute',
              bottom: rowIdx * (cellH + PANEL_GAP_PX),
              left: 0,
              display: 'flex',
              gap: PANEL_GAP_PX,
            }}
          >
            {Array.from({ length: group.cols }, (_, colIdx) => {
              const panel = group.grid[rowIdx][colIdx];
              return panel
                ? <PanelCell key={colIdx} panel={panel} month={month} day={day} cellW={cellW} cellH={cellH} />
                : <div key={colIdx} style={{ width: cellW, height: cellH }} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function SingleHeatmap({ result, month, day }: {
  result: LoadedSetupResult;
  month: number | null;
  day: number | null;
}) {
  const groups = useMemo(
    () => buildGroups(result.result.panels as PanelAnnualData[]),
    [result.result.panels],
  );
  const setupColour = SetupColoursUtils.getSetupColour(result.colourIndex);
  const { cellW, cellH, pxPerMetre } = useMemo(() => computeLayout(groups), [groups]);

  const stringLegend = useMemo(() => {
    const seen = new Map<string, number>();
    for (const panel of result.result.panels) {
      if (!seen.has(panel.string)) seen.set(panel.string, panel.stringColorIndex);
    }
    return Array.from(seen.entries()).map(([string, colorIndex]) => ({ string, colorIndex }));
  }, [result.result.panels]);

  /**
   * Positions are proportional to config-space coordinates.
   * blockW = max(arrayGridW, MIN_BLOCK_W_PX) — for label fit and centering.
   * blockH = LABEL_H_PX + arrayGridH — label is part of the block.
   *
   * pixelBottom is from config-space Z. Because blockH includes LABEL_H_PX,
   * two blocks in the same column will not overlap as long as the proportional
   * gap between them (pxPerMetre × Z-separation) >= LABEL_H_PX.
   * For Z-separation = 4.1m and pxPerMetre = 44: gap = 180px >> LABEL_H_PX.
   * For very close arrays we add a vertical post-pass (additive only) to
   * ensure the gap is at least LABEL_H_PX without inflating pxPerMetre.
   */
  const { positionedGroups, containerW, containerH } = useMemo(() => {
    if (groups.length === 0) return { positionedGroups: [], containerW: 0, containerH: 0 };

    const minX = Math.min(...groups.map(g => g.configPosition[0]));
    const minZ = Math.min(...groups.map(g => g.configPosition[1]));

    const items = groups.map(g => {
      const arrayGridW = g.cols * cellW + (g.cols - 1) * PANEL_GAP_PX;
      const arrayGridH = g.rows * cellH + (g.rows - 1) * PANEL_GAP_PX;
      const blockW = Math.max(arrayGridW, MIN_BLOCK_W_PX);
      const blockH = LABEL_H_PX + arrayGridH;
      return {
        group: g,
        pixelLeft: Math.round((g.configPosition[0] - minX) * pxPerMetre),
        pixelBottom: Math.round((g.configPosition[1] - minZ) * pxPerMetre),
        blockW,
        blockH,
      };
    });

    /**
     * Vertical post-pass: within each column (same pixelLeft), ensure the
     * gap between adjacent blocks is at least LABEL_H_PX. This handles the
     * case where arrays are very close in Z so the proportional gap is < label
     * height. We only push north blocks up — never reduce gaps.
     * This does NOT affect pxPerMetre so horizontal positions are unchanged.
     */
    const byCol = new Map<number, typeof items>();
    for (const item of items) {
      const col = byCol.get(item.pixelLeft) ?? [];
      col.push(item);
      byCol.set(item.pixelLeft, col);
    }
    for (const col of byCol.values()) {
      col.sort((a, b) => a.pixelBottom - b.pixelBottom); // south first
      for (let i = 1; i < col.length; i++) {
        const south = col[i - 1];
        const north = col[i];
        // gap = north.bottom - (south.bottom + south.blockH)
        // north block's label sits at the top of north.blockH, so the visual
        // bottom of north's label is at north.bottom + north.blockH.
        // We need: north.bottom >= south.bottom + south.blockH + LABEL_H_PX
        const minNorthBottom = south.pixelBottom + south.blockH + LABEL_H_PX;
        if (north.pixelBottom < minNorthBottom) {
          north.pixelBottom = minNorthBottom;
        }
      }
    }

    const containerW = Math.max(...items.map(p => p.pixelLeft + p.blockW));
    const containerH = Math.max(...items.map(p => p.pixelBottom + p.blockH));

    return { positionedGroups: items, containerW, containerH };
  }, [groups, cellW, cellH, pxPerMetre]);

  return (
    <div className="heatmap-container" style={{ borderTop: `3px solid ${setupColour}` }}>
      <div style={{
        fontFamily: 'sans-serif', fontSize: '0.75rem', fontWeight: 700,
        color: setupColour, marginBottom: 4, maxWidth: '144px', whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis',
      }} title={result.result.setupLabel}>
        {result.result.setupLabel}
      </div>

      <div className="heatmap-string-legend">
        {stringLegend.map(({ string, colorIndex }) => (
          <div key={string} className="heatmap-string-legend__item">
            <span
              className="heatmap-string-legend__swatch"
              style={{ background: StringColoursUtils.getStringColour(colorIndex) }}
            />
            <span className="heatmap-string-legend__label">{string}</span>
          </div>
        ))}
      </div>

      <div style={{ position: 'relative', width: containerW, height: containerH, minHeight: 40 }}>
        {positionedGroups.map(({ group, pixelLeft, pixelBottom, blockW, blockH }) => (
          <div
            key={group.arrayIndex}
            style={{
              position: 'absolute',
              left: pixelLeft,
              bottom: pixelBottom,
              height: blockH,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
            }}
          >
            <ArrayBlock
              group={group} month={month} day={day}
              cellW={cellW} cellH={cellH} blockW={blockW}
            />
          </div>
        ))}
      </div>

      <div className="heatmap-scale" style={{ marginTop: 8 }}>
        <span>0%</span>
        <div className="heatmap-scale__bar" />
        <span>100%</span>
      </div>
    </div>
  );
}

export function PanelShadowHeatmap({ results, activeSetupIds, month, day }: Props) {
  const visible = results.filter(r => activeSetupIds.has(r.setupId));
  if (visible.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 }}>
      {visible.map(r => (
        <SingleHeatmap key={r.setupId} result={r} month={month} day={day} />
      ))}
    </div>
  );
}